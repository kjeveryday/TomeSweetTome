// app.js: the only module that touches the real clock and the real localStorage.
// Wiring: open -> clock -> events -> render. Every event is persisted synchronously.

import content from './content.json' with { type: 'json' };
import { initialState, applyEvent } from './state.js';
import {
  bookAdded,
  bookMetadataResolved,
  createEventIdFactory,
  creatureGenerated,
  hatched,
  resourceGranted
} from './events.js';
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
import { createUI } from './ui.js';

// ----- debug clock -----
// getNow() = Date.now() + offsetMs. The offset persists across reloads and is
// adjusted (cumulatively) by the URL param: ?clock=+26h  ?clock=+40h  ?clock=-5h
// ?clock=reset. This simulates moving the device clock; it is the ONLY place
// the app reads real time.
const DEBUG_CLOCK_KEY = 'creatureCare.debugClockOffsetMs';

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
const nextEventId = createEventIdFactory(`local-${getNow()}`);

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
  for (const grown of growth.checkGrowth(state, getNow())) commit(grown);
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
    commit(creatureGenerated(creature, now));
  },
  canPerform: (actionId) => care.canPerform(state, actionId)
});

(function boot() {
  document.title = content.copy.title;
  const saved = persistence.load(getNow());
  state = saved.state;
  // open -> clock -> events (drift, day rollover) -> render
  for (const e of clock.onOpen(state, saved.lastSeen, getNow())) commit(e);
  ui.render(state);
})();

// External hook: ResourceGranted grants bonus CP that bypasses the daily cap
// (no in-game source is built for it, per the brief). Plus a read-only view.
window.creatureCare = {
  getState: () => structuredClone(state),
  eventLog,
  grantResource(cp) { commit(resourceGranted(cp, getNow())); }
};
