// app.js: the only module that touches the real clock and the real localStorage.
// Wiring: open -> clock -> events -> render. Every event is persisted synchronously.

import content from './content.json' with { type: 'json' };
import { initialState, applyEvent } from './state.js';
import {
  activeCreatureChanged,
  bookAdded,
  bookStatusChanged,
  bookMetadataResolved,
  careItemGranted,
  createEventIdFactory,
  creaturePreviewCreated,
  creatureRelationshipChanged,
  creatureRevealed,
  hatched,
  readingChallengeStarted,
  readingDayRecorded,
  readingRecorded,
  resourceGranted
} from './events.js';
import { SharedEventTypes } from './contracts.js';
import { previewForBook, revealForReading } from './systems/collection.js';
import { recordRelationshipDay } from './systems/relationship.js';
import { selectTreat } from './systems/care-items.js';
import { DEFAULT_FEATURE_FLAGS } from './feature-flags.js';
import * as clock from './systems/clock.js';
import * as care from './systems/care.js';
import * as growth from './systems/growth.js';
import { LocalStorageAdapter } from './systems/storage.js';
import { decodeBookBarcode } from './systems/barcode.js';
import { generateCreature } from './systems/generation.js';
import {
  enrichCreatureWithMetadataResult,
  lookupBookMetadataResult,
  searchBookMetadataResult
} from './systems/book-metadata.js';
import { createIsbnBookRecords, createProviderWorkBookRecords } from './systems/book-records.js';
import {
  createReadingRecord,
  readingProgress,
  readingsForWork,
  recordReading,
  startStandaloneChallenge
} from './systems/reading.js';
import {
  cancelReadingSession,
  confirmInterruptedReading,
  confirmTimedReading,
  createReadingSession,
  interruptReadingSession,
  restoreReadingSession,
  startReadingTimer,
  stopReadingTimer
} from './systems/reading-session.js';
import { createUI } from './ui.js';

// ----- debug clock -----
// getNow() = Date.now() + offsetMs. The offset persists across reloads and is
// adjusted (cumulatively) by the URL param: ?clock=+26h  ?clock=+40h  ?clock=-5h
// ?clock=reset. This simulates moving the device clock; it is the ONLY place
// the app reads real time.
const DEBUG_CLOCK_KEY = 'creatureCare.debugClockOffsetMs';
const INTERRUPTED_READING_KEY = 'stacklings.reading.interrupted.v1';

function localTimerPreviewEnabled() {
  return ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get('timer') === 'on';
}

function loadClockOffset() {
  let offset = Number(window.localStorage.getItem(DEBUG_CLOCK_KEY)) || 0;
  const raw = new URLSearchParams(window.location.search).get('clock');
  if (raw != null) {
    // A literal "+" in a query string decodes to a space, so "+26h" arrives as " 26h".
    const spec = raw.trim();
    if (spec === 'reset') {
      offset = 0;
    } else {
      const match = /^(?<sign>[+-]?)(?<hours>\d+(?:\.\d+)?)h$/i.exec(spec);
      if (match) {
        const sign = match.groups.sign === '-' ? -1 : 1;
        offset += sign * Number(match.groups.hours) * content.time.msPerHour;
      }
    }
    window.localStorage.setItem(DEBUG_CLOCK_KEY, String(offset));
    // Strip the param so a plain reload does not re-apply it (it is cumulative).
    window.history.replaceState(null, '', window.location.pathname);
  }
  return offset;
}

const offsetMs = loadClockOffset();
const getNow = () => Date.now() + offsetMs;

// ----- state + event flow -----
const persistence = new LocalStorageAdapter(window.localStorage);
const eventLog = [];
let state = initialState();
let featureFlags = { ...DEFAULT_FEATURE_FLAGS };
let timerSession = createReadingSession({ timerEnabled: false });
let interruptedReadingPrompt = null;
const nextEventId = createEventIdFactory(`local-${getNow()}`);

function removeInterruptedReadingIntent() {
  try { window.localStorage.removeItem(INTERRUPTED_READING_KEY); } catch { /* optional recovery only */ }
}

function storeInterruptedReadingIntent() {
  const { interruptedIntent } = interruptReadingSession(timerSession);
  if (!interruptedIntent) return;
  try { window.localStorage.setItem(INTERRUPTED_READING_KEY, JSON.stringify(interruptedIntent)); } catch { /* optional recovery only */ }
}

function consumeInterruptedReadingIntent() {
  let value = null;
  try {
    const raw = window.localStorage.getItem(INTERRUPTED_READING_KEY);
    if (raw != null) value = JSON.parse(raw);
  } catch { value = null; }
  removeInterruptedReadingIntent();
  return value;
}

async function prepareBookCreature(isbn, capture) {
  const metadata = await lookupBookMetadataResult(isbn);
  let resolvedRecords = createIsbnBookRecords(isbn, metadata);
  if (!resolvedRecords.ok) resolvedRecords = createIsbnBookRecords(isbn);
  if (!resolvedRecords.ok) return resolvedRecords;
  const addedRecords = metadata.source === 'unavailable'
    ? resolvedRecords
    : createIsbnBookRecords(isbn);
  const generated = await generateCreature(resolvedRecords.identity);
  if (generated.ok) {
    generated.creature = enrichCreatureWithMetadataResult({ ...generated.creature, capture }, metadata);
    generated.bookRecords = {
      added: addedRecords,
      resolved: metadata.source === 'unavailable' ? null : resolvedRecords
    };
  }
  return generated;
}

async function prepareSearchedBookCreature(query) {
  const metadata = await searchBookMetadataResult(query);
  const bookRecords = createProviderWorkBookRecords(metadata);
  if (!bookRecords.ok) return bookRecords;
  const generated = await generateCreature(bookRecords.identity);
  if (generated.ok) {
    generated.creature = enrichCreatureWithMetadataResult({
      ...generated.creature,
      capture: {
        source: 'title-author-search',
        decoder: 'Open Library search',
        rawValues: [query.title, query.author],
        formats: ['title-author'],
        imageType: null,
        imageWidth: null,
        imageHeight: null
      }
    }, metadata);
    generated.bookRecords = { added: bookRecords, resolved: null };
  }
  return generated;
}

function commit(inputEvent) {
  const event = inputEvent.compatibilityIdFallback
    ? { ...inputEvent, id: nextEventId(inputEvent.type, inputEvent.at), compatibilityIdFallback: false }
    : inputEvent;
  state = applyEvent(state, event);
  state = persistence.save(state, getNow()).state;
  eventLog.push(event);
  ui.render(state);
  ui.react(event, state);
  // GrowthSystem watches CP after every event (one stage step per check,
  // so each threshold gets its own celebration).
  for (const grown of growth.checkGrowthAfterEvent(state, event, getNow())) commit(grown);
}

function commitReadingRecord(record) {
  if (!state.books.works[record.workId]) return false;
  const result = recordReading(state.reading, record);
  if (!result.ok || result.replayed) return result.ok;
  const at = Date.parse(record.occurredAt);
  const firstReadingForWork = readingsForWork(state.reading.records, record.workId).length === 0;
  for (const { type, payload } of result.eventPayloads) {
    if (type === SharedEventTypes.ReadingRecorded) commit(readingRecorded(payload.record, at));
    else if (type === SharedEventTypes.ReadingDayRecorded) commit(readingDayRecorded(record, at));
    else if (type === SharedEventTypes.BookStatusChanged) commit(bookStatusChanged(payload.workId, payload.status, at));
  }
  // The first accepted reading for a work reveals its (already-previewed) creature.
  // Several books read in one session each reveal independently here; ui.react groups
  // the resulting toasts into one compact presentation.
  const reveal = revealForReading({ workId: record.workId, readingRecordId: record.id }, state.collection.creatures);
  if (reveal.ok) {
    for (const { creatureId, workId, readingRecordId } of reveal.reveals) {
      commit(creatureRevealed({ creatureId, workId, readingRecordId }, at));
      // A first-ever reveal becomes active automatically; a later reveal never
      // silently steals the active slot from what the player is already caring for.
      if (!state.collection.activeCreatureId) commit(activeCreatureChanged({ creatureId }, at));
    }
  }
  // Every revealed creature for this work records at most one relationship day per date;
  // the reveal day is day 1. Reading an archived book advances its creature even while
  // another is active. The validated late-reconciliation exception can leave two creatures
  // on one work, so this advances ALL of them — symmetric with the finish marker.
  const workCreatures = Object.values(state.collection.creatures).filter(
    (candidate) => candidate.workId === record.workId && candidate.revealed
  );
  for (const creature of workCreatures) {
    const relationship = recordRelationshipDay(creature, record.localDayKey);
    if (relationship.ok && relationship.changed) {
      commit(creatureRelationshipChanged({
        creatureId: creature.id,
        workId: record.workId,
        readingRecordId: record.id,
        localDayKey: record.localDayKey,
        responseId: relationship.responseId
      }, at));
    }
  }
  // Treat seam (careItems flag, default OFF): the first reading of a new work may grant
  // one broad-category treat. Never scales with minutes or number of books.
  if (featureFlags.careItems && firstReadingForWork && workCreatures.length > 0) {
    const book = workCreatures[0].baseTraits?.book ?? {};
    const treat = selectTreat([...(book.genres ?? []), ...(book.subjects ?? [])]);
    if (treat) {
      commit(careItemGranted({
        grantId: `grant:${record.id}`,
        itemId: treat.id,
        localDayKey: record.localDayKey,
        sourceReadingRecordId: record.id,
        categoryId: treat.id
      }, at));
    }
  }
  return true;
}

function createAndCommitReading({ workId, mode = 'independent', durationSeconds } = {}) {
  const now = getNow();
  const result = createReadingRecord({
    id: `reading:${nextEventId('record', now)}`,
    workId,
    confirmedAt: now,
    mode,
    status: state.reading.bookStatuses[workId] ?? 'reading',
    ...(durationSeconds === undefined ? {} : { durationSeconds })
  });
  return result.ok && commitReadingRecord(result.record);
}

const ui = createUI(document.querySelector('#app'), content, {
  onHatch: () => commit(hatched(getNow())),
  onAction: (actionId) => {
    const now = getNow();
    // Lazy day rollover: the daily cap also resets mid-session at midnight.
    const rollover = clock.checkDayRollover(state, now);
    if (rollover) commit(rollover);
    const result = care.performAction(state, actionId, now);
    if (result.ok) for (const e of result.events) commit(e);
  },
  onTuckIn: () => {
    const result = care.tuckIn(state, getNow());
    if (result.ok) for (const e of result.events) commit(e);
  },
  onScanFile: async (file) => {
    const decoded = await decodeBookBarcode(file);
    if (!decoded.ok) return decoded;
    return prepareBookCreature(decoded.isbn, decoded.capture);
  },
  onManualIsbn: (isbn) => prepareBookCreature(isbn, {
    source: 'manual',
    decoder: 'Manual entry',
    rawValues: [String(isbn)],
    formats: ['isbn'],
    imageType: null,
    imageWidth: null,
    imageHeight: null
  }),
  onTitleAuthorSearch: (query) => prepareSearchedBookCreature(query),
  onUseCreature: (creature, bookRecords) => {
    const now = getNow();
    commit(bookAdded(bookRecords.added, now));
    if (bookRecords.resolved) commit(bookMetadataResolved(bookRecords.resolved, now));
    const { identityVersion, identityKey } = bookRecords.added.identity;
    const workId = bookRecords.added.work.id;
    const preview = previewForBook(
      { workId, identityVersion, identityKey, baseTraits: creature },
      state.collection.creatures
    );
    if (preview.ok && !preview.alreadyExists) {
      commit(creaturePreviewCreated(
        { creatureId: preview.creatureId, workId, identityVersion, identityKey, baseTraits: creature },
        now
      ));
    }
  },
  onActivateCreature: (creatureId) => {
    if (!state.collection.creatures[creatureId]) return false;
    if (state.collection.activeCreatureId === creatureId) return true;
    commit(activeCreatureChanged({ creatureId }, getNow()));
    return true;
  },
  onStartReadingChallenge: () => {
    const now = getNow();
    const result = startStandaloneChallenge(now);
    if (result.ok) commit(readingChallengeStarted(result.challenge, now));
  },
  onRecordReading: ({ workId, mode }) => createAndCommitReading({ workId, mode }),
  onBookStatusChange: (workId, status) => {
    if (state.books.works[workId]) commit(bookStatusChanged(workId, status, getNow()));
  },
  getReadingProgress: (reading) => readingProgress(reading),
  isTimerEnabled: () => featureFlags.timer === true,
  onTimerStart: (workId) => {
    if (!featureFlags.timer || !state.books.works[workId]) return false;
    const result = startReadingTimer(timerSession, { workId, startedAt: performance.now() });
    if (!result.ok) return false;
    timerSession = result.session;
    storeInterruptedReadingIntent();
    return true;
  },
  onTimerStop: () => {
    if (!featureFlags.timer) return false;
    const result = stopReadingTimer(timerSession, performance.now());
    if (!result.ok) return false;
    timerSession = result.session;
    return true;
  },
  onTimerCancel: () => {
    timerSession = cancelReadingSession(timerSession);
    removeInterruptedReadingIntent();
  },
  onTimerConfirm: (mode) => {
    if (!featureFlags.timer) return false;
    const now = getNow();
    const result = confirmTimedReading(timerSession, {
      id: `reading:${nextEventId('record', now)}`,
      confirmedAt: now,
      mode,
      status: state.reading.bookStatuses[timerSession.workId] ?? 'reading'
    });
    if (!result.ok) return false;
    timerSession = result.session;
    removeInterruptedReadingIntent();
    return commitReadingRecord(result.record);
  },
  onInterruptedReadingDecision: ({ record, workId }) => {
    const prompt = interruptedReadingPrompt?.workId === workId ? interruptedReadingPrompt : null;
    interruptedReadingPrompt = null;
    if (!record || !prompt) return false;
    const now = getNow();
    const result = confirmInterruptedReading(prompt, {
      id: `reading:${nextEventId('record', now)}`,
      confirmedAt: now,
      mode: 'independent',
      status: state.reading.bookStatuses[workId] ?? 'reading'
    });
    return result.ok && commitReadingRecord(result.record);
  },
  canPerform: (actionId) => care.canPerform(state, actionId)
});

(function boot() {
  document.title = content.copy.title;
  const saved = persistence.load(getNow());
  state = saved.state;
  featureFlags = { ...saved.featureFlags, timer: saved.featureFlags.timer || localTimerPreviewEnabled() };
  const restoredTimer = restoreReadingSession({
    timerEnabled: featureFlags.timer,
    interruptedIntent: consumeInterruptedReadingIntent()
  });
  timerSession = restoredTimer.session;
  interruptedReadingPrompt = restoredTimer.prompt;
  // open -> clock -> events (drift, day rollover) -> render
  for (const e of clock.onOpen(state, saved.lastSeen, getNow())) commit(e);
  ui.render(state);
  if (interruptedReadingPrompt
    && state.reading.challenge.registeredAt !== null
    && !ui.offerInterruptedReading(interruptedReadingPrompt.workId)) {
    interruptedReadingPrompt = null;
  }
})();

// External hook: ResourceGranted grants bonus CP that bypasses the daily cap
// (no in-game source is built for it, per the brief). Plus a read-only view.
window.creatureCare = {
  getState: () => structuredClone(state),
  eventLog,
  grantResource(cp) { commit(resourceGranted(cp, getNow())); }
};
