// GameState: single source of truth. All mutations happen in applyEvent (pure).
// No DOM access, no Date.now() — time arrives inside events as `event.at`.
// Every tuning number comes from content.json.

import content from './content.json' with { type: 'json' };
import { EventTypes } from './events.js';
import {
  EVENT_PAYLOAD_VALIDATORS,
  captureCareState,
  createPlayerAccess,
  creatureIdForIdentity,
  isCreatureRecord
} from './contracts.js';
import { freshCareState, selectActiveCreature } from './systems/collection.js';
import { shouldMarkFinished } from './systems/relationship.js';
import { applyGrant, applyUse } from './systems/care-items.js';
import {
  applyDelivery,
  applyDismiss,
  applyRequest,
  applyReset,
  applySave
} from './systems/recommendations.js';

const STATS = content.stats;

// Local calendar date key ("YYYY-M-D"). Deterministic for a given `ms` on a given device.
export function dayKeyOf(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function clampStat(value) {
  return Math.min(STATS.max, Math.max(STATS.min, value));
}

function addBookRecords(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.BookAdded(payload)) return state;
  const existingEdition = state.books.editions[payload.editionId];
  if (existingEdition && (existingEdition.workId !== payload.workId
    || existingEdition.isbn13 !== payload.edition.isbn13)) return state;
  for (const alias of payload.aliases) {
    const routedWorkId = state.books.aliases[alias.key];
    if (routedWorkId && routedWorkId !== payload.workId) return state;
  }
  for (const alias of payload.editionAliases) {
    const routedEditionId = state.books.editionAliases?.[alias.key];
    if (routedEditionId && routedEditionId !== payload.editionId) return state;
  }

  const existingWork = state.books.works[payload.workId];
  const existingProvenance = state.books.provenance?.[payload.workId];
  const rank = { unknown: 0, partial: 1, resolved: 2 };
  const preferIncoming = !existingWork
    || rank[payload.work.metadataStatus] > rank[existingWork.metadataStatus]
    || (rank[payload.work.metadataStatus] === rank[existingWork.metadataStatus]
      && (!existingProvenance || payload.provenance.fetchedAt >= existingProvenance.fetchedAt));
  const work = {
    ...(preferIncoming ? payload.work : existingWork),
    editionIds: [...new Set([
      ...(existingWork?.editionIds ?? []),
      ...payload.work.editionIds,
      payload.editionId
    ])]
  };
  return {
    ...state,
    books: {
      works: { ...state.books.works, [work.id]: structuredClone(work) },
      editions: {
        ...state.books.editions,
        [payload.editionId]: structuredClone((preferIncoming || !existingEdition) ? payload.edition : existingEdition)
      },
      aliases: {
        ...state.books.aliases,
        ...Object.fromEntries(payload.aliases.map(({ key, workId }) => [key, workId]))
      },
      editionAliases: {
        ...(state.books.editionAliases ?? {}),
        ...Object.fromEntries(payload.editionAliases.map(({ key, editionId }) => [key, editionId]))
      },
      provenance: {
        ...(state.books.provenance ?? {}),
        [work.id]: structuredClone(preferIncoming ? payload.provenance : state.books.provenance?.[work.id] ?? payload.provenance)
      }
    }
  };
}

function reconcileBookWork(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.BookWorkReconciled(payload)) return state;
  const canonical = state.books.works[payload.canonicalWorkId];
  if (!canonical) return state;
  const aliasedIds = payload.aliasedWorkIds.filter((id) => id !== canonical.id);
  const suppliedEditionIds = new Set(payload.editionIds);
  for (const workId of aliasedIds) {
    const work = state.books.works[workId];
    if (work && !work.editionIds.every((editionId) => suppliedEditionIds.has(editionId))) return state;
  }

  const works = structuredClone(state.books.works);
  const editions = structuredClone(state.books.editions);
  const aliases = structuredClone(state.books.aliases);
  const provenance = structuredClone(state.books.provenance ?? {});
  const editionIds = new Set(canonical.editionIds);
  for (const workId of aliasedIds) {
    const work = works[workId];
    if (!work) continue;
    for (const editionId of work.editionIds) {
      if (!editions[editionId]) return state;
      editions[editionId].workId = canonical.id;
      editionIds.add(editionId);
    }
    for (const [key, routedWorkId] of Object.entries(aliases)) {
      if (routedWorkId === workId) aliases[key] = canonical.id;
    }
    delete works[workId];
    delete provenance[workId];
  }
  works[canonical.id] = { ...works[canonical.id], editionIds: [...editionIds] };

  const creatures = Object.fromEntries(Object.entries(state.collection.creatures).map(([id, creature]) => [
    id,
    aliasedIds.includes(creature.workId) ? { ...structuredClone(creature), workId: canonical.id } : structuredClone(creature)
  ]));
  const readingRecords = Object.fromEntries(Object.entries(state.reading.records).map(([id, record]) => [
    id,
    aliasedIds.includes(record.workId) ? { ...structuredClone(record), workId: canonical.id } : structuredClone(record)
  ]));
  const bookStatuses = structuredClone(state.reading.bookStatuses ?? {});
  for (const workId of aliasedIds) {
    if (!bookStatuses[canonical.id] && bookStatuses[workId]) bookStatuses[canonical.id] = bookStatuses[workId];
    delete bookStatuses[workId];
  }
  const counts = Object.values(creatures).reduce((result, creature) => {
    result[creature.workId] = (result[creature.workId] ?? 0) + 1;
    return result;
  }, {});
  const reconciledDuplicateWorkIds = (state.collection.reconciledDuplicateWorkIds ?? [])
    .filter((id) => !aliasedIds.includes(id) && id !== canonical.id);
  if (counts[canonical.id] > 1) reconciledDuplicateWorkIds.push(canonical.id);

  return {
    ...state,
    books: { ...state.books, works, editions, aliases, provenance },
    collection: { ...state.collection, creatures, reconciledDuplicateWorkIds },
    reading: { ...state.reading, records: readingRecords, bookStatuses }
  };
}

function startReadingChallenge(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.ReadingChallengeStarted(payload)) return state;
  if (state.reading.challenge.registeredAt !== null) return state;
  return { ...state, reading: { ...state.reading, challenge: structuredClone(payload) } };
}

function addReadingRecord(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.ReadingRecorded(payload)) return state;
  if (state.reading.challenge.registeredAt === null) return state;
  if (!state.books.works[payload.workId]) return state;
  const existing = state.reading.records[payload.readingRecordId];
  if (existing) return state;
  const formalDayKeys = state.reading.formalDayKeys.includes(payload.record.localDayKey)
    ? state.reading.formalDayKeys
    : [...state.reading.formalDayKeys, payload.record.localDayKey];
  return {
    ...state,
    reading: {
      ...state.reading,
      records: { ...state.reading.records, [payload.record.id]: structuredClone(payload.record) },
      formalDayKeys
    }
  };
}

function acknowledgeReadingDay(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.ReadingDayRecorded(payload)) return state;
  const record = state.reading.records[payload.readingRecordId];
  if (!record || record.localDayKey !== payload.localDayKey) return state;
  return state;
}

function changeBookStatus(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.BookStatusChanged(payload) || !state.books.works[payload.workId]) return state;
  const statusChanged = state.reading.bookStatuses[payload.workId] !== payload.status;
  // Finishing a book is a PERMANENT creature marker, independent of the reversible
  // work status: it is never cleared by a later reread or paused/not-for-me status,
  // and it grants no CP, stage, or care power.
  const finishTargets = payload.status === 'finished'
    ? Object.values(state.collection.creatures)
      .filter((creature) => creature.workId === payload.workId && shouldMarkFinished(creature, 'finished'))
    : [];
  if (!statusChanged && finishTargets.length === 0) return state;

  let collection = state.collection;
  if (finishTargets.length > 0) {
    const creatures = { ...state.collection.creatures };
    for (const creature of finishTargets) creatures[creature.id] = { ...creature, finished: true };
    collection = { ...state.collection, creatures };
  }
  return {
    ...state,
    reading: {
      ...state.reading,
      bookStatuses: statusChanged
        ? { ...state.reading.bookStatuses, [payload.workId]: payload.status }
        : state.reading.bookStatuses
    },
    collection
  };
}

// One relationship day per work per local date. The first-reading reveal day is the
// creature's first relationship day; the displayed response is derived from the day
// count (see relationship.js). Never grants CP, stage, care power, or reading progress.
function changeRelationship(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.CreatureRelationshipChanged(payload)) return state;
  const creature = state.collection.creatures[payload.creatureId];
  if (!creature || creature.workId !== payload.workId) return state;
  // A relationship day can only land on a REVEALED creature — the reveal day is day 1,
  // so recording one before the reveal (a reordered/replayed event) would desync the
  // frozen response mapping. This boundary enforces its own invariant, like every case.
  if (!creature.revealed) return state;
  const record = state.reading.records[payload.readingRecordId];
  if (!record || record.workId !== payload.workId) return state;
  if (creature.relationshipDayKeys.includes(payload.localDayKey)) return state;
  return {
    ...state,
    collection: {
      ...state.collection,
      creatures: {
        ...state.collection.creatures,
        [payload.creatureId]: {
          ...creature,
          relationshipDayKeys: [...creature.relationshipDayKeys, payload.localDayKey]
        }
      }
    }
  };
}

// Treat seam (careItems flag). Grant adds one single-use treat to the inventory,
// idempotent on the grant id.
function grantCareItem(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.CareItemGranted(payload)) return state;
  const result = applyGrant(state.careItems, {
    grantId: payload.grantId,
    itemId: payload.itemId,
    localDayKey: payload.localDayKey,
    sourceReadingRecordId: payload.sourceReadingRecordId
  });
  if (!result.ok || !result.changed) return state;
  return { ...state, careItems: result.careItems };
}

// Using a treat performs the normal feed effect on the ACTIVE creature (a treat is a
// feed with a different animation) subject to the existing daily cap — the cap decision
// arrives on the event as cpGranted, exactly like CareActionPerformed. It never grants
// extra reading progress or power. No-op (replay-safe) if no matching treat is available.
// Recommendations are advisory local preference data. The two shared events record the
// request and the delivered fixture result; the three local events (save/dismiss/reset)
// manage the player's preference lists. Nothing here changes books, creatures, reading,
// or care — reset/delete never removes owned data.
function requestRecommendation(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.RecommendationRequested(payload)) return state;
  return { ...state, recommendations: applyRequest(state.recommendations, payload) };
}

function deliverRecommendation(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.RecommendationDelivered(payload)) return state;
  if (!state.recommendations.requests[payload.requestId]) return state;
  return { ...state, recommendations: applyDelivery(state.recommendations, payload) };
}

function saveRecommendation(state, payload) {
  if (typeof payload.recommendationId !== 'string' || payload.recommendationId.length === 0) return state;
  return { ...state, recommendations: applySave(state.recommendations, payload.recommendationId) };
}

function dismissRecommendation(state, payload) {
  if (typeof payload.recommendationId !== 'string' || payload.recommendationId.length === 0) return state;
  return { ...state, recommendations: applyDismiss(state.recommendations, payload.recommendationId) };
}

function resetRecommendations(state) {
  return { ...state, recommendations: applyReset(state.recommendations) };
}

function useCareItem(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.CareItemUsed(payload)) return state;
  if (!state.hatched) return state;
  if (!state.collection.activeCreatureId || payload.creatureId !== state.collection.activeCreatureId) return state;
  // Replay-safety here relies on treats being single-use (applyGrant pins remaining: 1):
  // a duplicate CareItemUsed finds remaining 0 and no-ops. If a multi-use treat is ever
  // introduced, add useId-ledger deduplication before applying the feed twice.
  const use = applyUse(state.careItems, payload.itemId);
  if (!use.ok || !use.changed) return state;
  const feed = content.care.actions.find((action) => action.id === 'feed');
  const stats = { ...state.stats };
  if (feed) for (const [statId, delta] of Object.entries(feed.effects)) stats[statId] = clampStat(stats[statId] + delta);
  const grant = Number.isFinite(payload.cpGranted) ? Math.max(0, payload.cpGranted) : 0;
  return {
    ...state,
    careItems: use.careItems,
    stats,
    cp: state.cp + grant,
    actionsToday: state.actionsToday + 1,
    tuckedIn: false
  };
}

// A preview is a hidden, unrevealed CreatureRecord: one work has one deterministic
// identity, so this is a no-op (never rerolls) whenever that identity is already
// present, whether still unrevealed or long since collected.
function createPreview(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.CreaturePreviewCreated(payload)) return state;
  if (!state.books.works[payload.workId]) return state;
  if (typeof payload.identityVersion !== 'string' || payload.identityVersion.length === 0) return state;
  if (typeof payload.identityKey !== 'string' || payload.identityKey.length === 0) return state;
  if (!payload.baseTraits || typeof payload.baseTraits !== 'object' || Array.isArray(payload.baseTraits)) return state;
  if (creatureIdForIdentity(payload.identityVersion, payload.identityKey) !== payload.creatureId) return state;
  if (state.collection.creatures[payload.creatureId]) return state;

  const record = {
    id: payload.creatureId,
    workId: payload.workId,
    identityVersion: payload.identityVersion,
    identityKey: payload.identityKey,
    baseTraits: structuredClone(payload.baseTraits),
    revealed: false,
    relationshipDayKeys: [],
    finished: false,
    careState: { status: 'uninitialized' }
  };
  if (!isCreatureRecord(record)) return state;
  return {
    ...state,
    collection: { ...state.collection, creatures: { ...state.collection.creatures, [record.id]: record } }
  };
}

// The first accepted reading for a work reveals its preview. Reveal only ever marks
// the record visible and files it into the unbounded archive; becoming active (and
// therefore occupying a visible slot) is always a separate, explicit ActiveCreatureChanged
// so a later reveal can never silently steal the active slot from what the player is caring for.
function revealCreature(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.CreatureRevealed(payload)) return state;
  const creature = state.collection.creatures[payload.creatureId];
  if (!creature || creature.workId !== payload.workId) return state;
  if (creature.revealed) return state;
  const record = state.reading.records[payload.readingRecordId];
  if (!record || record.workId !== payload.workId) return state;

  const alreadyPlaced = state.collection.visibleCreatureIds.includes(payload.creatureId)
    || state.collection.archivedCreatureIds.includes(payload.creatureId);
  return {
    ...state,
    collection: {
      ...state.collection,
      creatures: {
        ...state.collection.creatures,
        [payload.creatureId]: { ...creature, revealed: true }
      },
      archivedCreatureIds: alreadyPlaced
        ? state.collection.archivedCreatureIds
        : [...state.collection.archivedCreatureIds, payload.creatureId]
    }
  };
}

// Switching the active creature snapshots the outgoing creature's ready care state
// (so it can resume exactly where it left off later), initializes a nonpunitive
// fresh care state the first time an uninitialized (migrated-history or newly
// revealed) creature becomes active, and projects that care state onto the legacy
// root fields every other system already reads/writes.
function changeActiveCreature(state, payload) {
  if (!EVENT_PAYLOAD_VALIDATORS.ActiveCreatureChanged(payload)) return state;
  const target = state.collection.creatures[payload.creatureId];
  if (!target) return state;

  const selection = selectActiveCreature({
    creatureId: payload.creatureId,
    activeCreatureId: state.collection.activeCreatureId,
    visibleCreatureIds: state.collection.visibleCreatureIds,
    archivedCreatureIds: state.collection.archivedCreatureIds
  }, content.collection.visibleCreatureLimit);
  if (!selection.ok || !selection.changed) return state;

  const creatures = { ...state.collection.creatures };
  const previousActiveId = state.collection.activeCreatureId;
  if (previousActiveId && creatures[previousActiveId]) {
    creatures[previousActiveId] = { ...creatures[previousActiveId], careState: captureCareState(state) };
  }
  // Care-state the incoming creature will own once active:
  //  - a creature that already owns ready care resumes exactly where it left off;
  //  - the FIRST activation of a hatched native game has no prior active creature,
  //    so the hatched starter's accumulated care lives only in the root fields —
  //    adopt it, so a first reveal takes on the identity WITHOUT discarding the CP,
  //    stage, stickers, or daily-cap progress already earned (this mirrors v1, where
  //    applying a book preserved the creature's ongoing care). Never-punish.
  //  - every other uninitialized activation (later migrated-history creatures, or a
  //    reveal while still unhatched) gets a fresh nonpunitive start.
  let targetCareState;
  if (target.careState.status === 'ready') {
    targetCareState = target.careState;
  } else if (previousActiveId === null && state.hatched) {
    targetCareState = captureCareState(state);
  } else {
    targetCareState = freshCareState();
  }
  creatures[payload.creatureId] = { ...target, careState: targetCareState };

  // The active creature is also the hero the scene renders, so project its look and
  // name onto the v1 `creature`/`name` fields `applyCreatureLook`/the nameplate read —
  // the visual analogue of the careState projection above. A book creature shows its
  // generated look; a migrated legacy creature restores its stored book look if it had
  // one; a plain starter falls back to the generic species look and name.
  const traits = target.baseTraits;
  let creature = state.creature;
  let name = state.name;
  if (traits && traits.kind === 'book') {
    creature = structuredClone(traits);
    name = typeof traits.name === 'string' ? traits.name : name;
  } else if (traits && traits.legacyCreature && traits.legacyCreature.kind === 'book') {
    creature = structuredClone(traits.legacyCreature);
    name = typeof traits.name === 'string' ? traits.name : name;
  } else {
    creature = null;
    name = traits && typeof traits.name === 'string' && traits.name.length > 0 ? traits.name : content.species.name;
  }

  return {
    ...state,
    creature,
    name,
    stats: structuredClone(targetCareState.stats),
    stage: targetCareState.stage,
    cp: targetCareState.cp,
    actionsToday: targetCareState.actionsToday,
    dayKey: targetCareState.dayKey,
    stickers: structuredClone(targetCareState.stickers),
    tuckedIn: targetCareState.tuckedIn,
    collection: {
      ...state.collection,
      creatures,
      activeCreatureId: payload.creatureId,
      visibleCreatureIds: selection.visibleCreatureIds,
      archivedCreatureIds: selection.archivedCreatureIds
    }
  };
}

export function initialState() {
  return {
    hatched: false,
    name: null,
    stage: content.species.stages[0].stage,
    stats: { fullness: STATS.min, spirit: STATS.min, energy: STATS.min },
    cp: 0,
    actionsToday: 0,
    dayKey: null,
    stickers: [],
    creature: null,
    creatureHistory: [],
    tuckedIn: false,
    books: { works: {}, editions: {}, aliases: {}, editionAliases: {}, provenance: {} },
    reading: {
      records: {}, formalDayKeys: [], bookStatuses: {},
      challenge: { registeredAt: null, goalDays: 20, halfwayDays: 10 }
    },
    collection: {
      creatures: {}, activeCreatureId: null, visibleCreatureIds: [], archivedCreatureIds: [],
      reconciledDuplicateWorkIds: []
    },
    playerAccess: createPlayerAccess(),
    careItems: { inventory: [], grantDayKeys: [] },
    recommendations: { requests: {}, results: {}, savedIds: [], dismissedIds: [] }
  };
}

// Mood is display-only, derived from Fullness and Spirit (Energy excluded).
// Ties (fullness === spirit, both low) resolve to sleepy.
export function moodOf(state) {
  const { fullness, spirit } = state.stats;
  const rules = content.mood;
  if (fullness >= rules.beamingMin && spirit >= rules.beamingMin) return 'beaming';
  if (fullness >= rules.contentMin && spirit >= rules.contentMin) return 'content';
  return fullness < spirit ? 'peckish' : 'sleepy';
}

export function applyEvent(state, event) {
  switch (event.type) {
    case EventTypes.BookAdded:
      return addBookRecords(state, event.payload ?? event);

    case EventTypes.BookMetadataResolved:
      return addBookRecords(state, event.payload ?? event);

    case EventTypes.BookWorkReconciled:
      return reconcileBookWork(state, event.payload ?? event);

    case EventTypes.ReadingChallengeStarted:
      return startReadingChallenge(state, event.payload ?? event);

    case EventTypes.ReadingRecorded:
      return addReadingRecord(state, event.payload ?? event);

    case EventTypes.ReadingDayRecorded:
      return acknowledgeReadingDay(state, event.payload ?? event);

    case EventTypes.BookStatusChanged:
      return changeBookStatus(state, event.payload ?? event);

    case EventTypes.CreaturePreviewCreated:
      return createPreview(state, event.payload ?? event);

    case EventTypes.CreatureRevealed:
      return revealCreature(state, event.payload ?? event);

    case EventTypes.ActiveCreatureChanged:
      return changeActiveCreature(state, event.payload ?? event);

    case EventTypes.CreatureRelationshipChanged:
      return changeRelationship(state, event.payload ?? event);

    case EventTypes.CareItemGranted:
      return grantCareItem(state, event.payload ?? event);

    case EventTypes.CareItemUsed:
      return useCareItem(state, event.payload ?? event);

    case EventTypes.RecommendationRequested:
      return requestRecommendation(state, event.payload ?? event);

    case EventTypes.RecommendationDelivered:
      return deliverRecommendation(state, event.payload ?? event);

    case EventTypes.RecommendationSaved:
      return saveRecommendation(state, event.payload ?? event);

    case EventTypes.RecommendationDismissed:
      return dismissRecommendation(state, event.payload ?? event);

    case EventTypes.RecommendationReset:
      return resetRecommendations(state);

    case EventTypes.Hatched: {
      return {
        ...state,
        hatched: true,
        name: state.creature?.name ?? content.species.name,
        stage: content.species.stages[0].stage,
        stats: { ...STATS.initial },
        dayKey: dayKeyOf(event.at)
      };
    }

    case EventTypes.TimeElapsed: {
      // Drift for time spent away (already clamped by ClockSystem). Energy only
      // regenerates while the app is closed — which is exactly what this event models.
      const hours = event.elapsedMs / content.time.msPerHour;
      const decay = STATS.decayPerHour;
      return {
        ...state,
        tuckedIn: false, // a new visit always wakes the creature
        stats: {
          fullness: clampStat(state.stats.fullness - decay.fullness * hours),
          spirit: clampStat(state.stats.spirit - decay.spirit * hours),
          energy: clampStat(state.stats.energy + STATS.energyRegenPerHourClosed * hours)
        }
      };
    }

    case EventTypes.DayRolledOver: {
      return { ...state, actionsToday: 0, dayKey: event.dayKey };
    }

    case EventTypes.TuckedIn: {
      return { ...state, tuckedIn: true };
    }

    case EventTypes.CareActionPerformed: {
      const def = content.care.actions.find((a) => a.id === event.actionId);
      if (!def) return state;
      const stats = { ...state.stats };
      for (const [statId, delta] of Object.entries(def.effects)) {
        stats[statId] = clampStat(stats[statId] + delta);
      }
      // CareSystem owns the daily-cap decision and records its result on the event.
      // The reducer still treats the event as an input boundary: malformed or negative
      // grants must not poison monotonic CP, while every valid finite grant is preserved.
      const grant = Number.isFinite(event.cpGranted) ? Math.max(0, event.cpGranted) : 0;
      return {
        ...state,
        stats,
        actionsToday: state.actionsToday + 1,
        cp: state.cp + grant,
        tuckedIn: false
      };
    }

    case EventTypes.GiftGranted: {
      // Wake-up gift after an absence: exactly one sticker, and a gentle welfare
      // floor — Fullness/Spirit rise to at least the floor, never downward
      // (max() can never take a stat below its plain-decay value). CP unchanged.
      const floor = content.absence.statFloor;
      return {
        ...state,
        tuckedIn: false,
        stickers: [...state.stickers, event.stickerId],
        stats: {
          ...state.stats,
          fullness: Math.max(state.stats.fullness, floor),
          spirit: Math.max(state.stats.spirit, floor)
        }
      };
    }

    case EventTypes.CreatureGenerated: {
      if (!event.creature || event.creature.kind !== 'book') return state;
      const sameIdentity = state.creature?.seedVersion === event.creature.seedVersion
        && (state.creature?.identityKey ?? state.creature?.isbn) === (event.creature.identityKey ?? event.creature.isbn);
      if (sameIdentity) {
        return { ...state, creature: event.creature, name: event.creature.name };
      }
      const history = state.creature
        ? [...(state.creatureHistory ?? []), state.creature]
        : [...(state.creatureHistory ?? [])];
      return {
        ...state,
        creature: event.creature,
        creatureHistory: history,
        name: event.creature.name
      };
    }

    case EventTypes.CreatureStateChanged: {
      return { ...state, stage: event.stage };
    }

    case EventTypes.ResourceGranted: {
      // External bonus CP: bypasses the daily cap, counts toward growth.
      // A grant before the creature hatches is dropped, matching every other event
      // path (care, clock, growth all no-op while unhatched) — otherwise the CP would
      // sit waiting and jump the creature past Stage 1 the instant it hatches.
      if (!state.hatched) return state;
      // CP is monotonic — nothing ever removes it — so negative grants are ignored, and
      // non-finite amounts (NaN/Infinity from a malformed hook) are ignored rather than
      // poisoning CP to NaN, which would silently and permanently block all growth.
      const grant = Number.isFinite(event.cp) ? Math.max(0, event.cp) : 0;
      return { ...state, cp: state.cp + grant };
    }

    default:
      return state;
  }
}
