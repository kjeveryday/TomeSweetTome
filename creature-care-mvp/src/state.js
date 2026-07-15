// GameState: single source of truth. All mutations happen in applyEvent (pure).
// No DOM access, no Date.now() — time arrives inside events as `event.at`.
// Every tuning number comes from content.json.

import content from './content.json' with { type: 'json' };
import { EventTypes } from './events.js';
import { EVENT_PAYLOAD_VALIDATORS, createPlayerAccess } from './contracts.js';

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
    reading: { ...state.reading, records: readingRecords }
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
    reading: { records: {}, formalDayKeys: [] },
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
