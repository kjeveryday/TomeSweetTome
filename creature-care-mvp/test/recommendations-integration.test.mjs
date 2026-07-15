// Package 6 integration: drives the recommendation request -> fixture deliver ->
// save/dismiss/reset flow through the real reducer (src/state.js) and storage boundary,
// mirroring how src/app.js's requestRecommendationFlow orchestrates it. The pure module
// is unit-tested in recommendations.test.mjs; this proves the wiring, the privacy
// (categories-only) input, and the "never removes owned data" reset invariant.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyEvent, initialState } from '../src/state.js';
import {
  activeCreatureChanged,
  bookAdded,
  bookStatusChanged,
  creaturePreviewCreated,
  creatureRevealed,
  readingChallengeStarted,
  readingDayRecorded,
  readingRecorded,
  recommendationDelivered,
  recommendationDismissed,
  recommendationRequested,
  recommendationReset,
  recommendationSaved
} from '../src/events.js';
import { createIsbnBookRecords } from '../src/systems/book-records.js';
import { createReadingRecord, recordReading, startStandaloneChallenge } from '../src/systems/reading.js';
import { previewForBook, revealForReading } from '../src/systems/collection.js';
import {
  FixtureRecommendationProvider,
  buildRecommendationInput,
  deliveredFromResult
} from '../src/systems/recommendations.js';
import { LocalStorageAdapter } from '../src/systems/storage.js';
import { createFakeStorage, at } from './helpers.mjs';

const provider = new FixtureRecommendationProvider();

// Mirrors app.js requestRecommendationFlow.
function requestFlow(state, requestId, now) {
  const built = buildRecommendationInput(state, { requestId });
  if (!built.ok) return { state, ok: false, reason: built.reason };
  state = applyEvent(state, recommendationRequested(built.input, now));
  const result = provider.recommend(built.input, now);
  const delivered = deliveredFromResult(result);
  if (!delivered.ok) return { state, ok: false, reason: 'unavailable', input: built.input };
  state = applyEvent(state, recommendationDelivered(delivered.delivered, now));
  return { state, ok: true, recommendationId: delivered.delivered.recommendationId, input: built.input };
}

function startChallenge(state, now) {
  const started = startStandaloneChallenge(now);
  return applyEvent(state, readingChallengeStarted(started.challenge, now));
}

// Add a book whose creature carries the given broad categories, then read it (reveal).
function addAndReadAnimalBook(state, isbn, now, id) {
  const records = createIsbnBookRecords(isbn);
  state = applyEvent(state, bookAdded(records, now));
  const { identityVersion, identityKey } = records.identity;
  const workId = records.work.id;
  const baseTraits = { kind: 'book', isbn: identityKey, book: { genres: ["Children's fiction", 'Animal fiction'], subjects: ['Friendship'] } };
  const preview = previewForBook({ workId, identityVersion, identityKey, baseTraits }, state.collection.creatures);
  state = applyEvent(state, creaturePreviewCreated({ creatureId: preview.creatureId, workId, identityVersion, identityKey, baseTraits }, now));
  const rr = createReadingRecord({ id, workId, confirmedAt: now });
  const reading = recordReading(state.reading, rr.record);
  state = applyEvent(state, readingRecorded(rr.record, now));
  if (reading.formalDayAdded) state = applyEvent(state, readingDayRecorded(rr.record, now));
  state = applyEvent(state, bookStatusChanged(workId, rr.record.status, now));
  const reveal = revealForReading({ workId, readingRecordId: rr.record.id }, state.collection.creatures);
  for (const r of reveal.reveals) {
    state = applyEvent(state, creatureRevealed(r, now));
    if (!state.collection.activeCreatureId) state = applyEvent(state, activeCreatureChanged({ creatureId: r.creatureId }, now));
  }
  return state;
}

test('a new user (no reading history) gets the general recommendation', () => {
  let state = initialState();
  let ok; let recommendationId; let input;
  ({ state, ok, recommendationId, input } = requestFlow(state, 'req:1', at(0)));
  assert.equal(ok, true);
  assert.deepEqual(input.categoryIds, [], 'new user has no categories');
  assert.equal(recommendationId, 'rec:general');
  assert.equal(state.recommendations.results['req:1'].recommendationId, 'rec:general');
  assert.equal(state.recommendations.results['req:1'].source, 'fixture');
});

test('recent animal reading yields a category-based recommendation, from genres/subjects only (no PII)', () => {
  let state = startChallenge(initialState(), at(0));
  state = addAndReadAnimalBook(state, '9780064400558', at(0), 'r1');
  let ok; let recommendationId; let input;
  ({ state, ok, recommendationId, input } = requestFlow(state, 'req:1', at(1)));
  assert.equal(ok, true);
  // Input carries only broad category strings — no isbn, name, or identity fields.
  assert.ok(input.categoryIds.length > 0);
  for (const category of input.categoryIds) {
    assert.equal(typeof category, 'string');
    assert.doesNotMatch(category, /\d{9,}/, 'no ISBN-like digits leak into categories');
  }
  assert.equal(recommendationId, 'rec:animals', 'animal categories map to the animal recommendation');
});

test('save then dismiss moves a recommendation between the two unique lists; both persist and round-trip', () => {
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  let state = initialState();
  ({ state } = requestFlow(state, 'req:1', at(0)));

  state = applyEvent(state, recommendationSaved('rec:general', at(0)));
  assert.deepEqual(state.recommendations.savedIds, ['rec:general']);
  assert.deepEqual(state.recommendations.dismissedIds, []);

  state = applyEvent(state, recommendationDismissed('rec:general', at(0)));
  assert.deepEqual(state.recommendations.savedIds, []);
  assert.deepEqual(state.recommendations.dismissedIds, ['rec:general']);

  // Idempotent: dismissing again keeps a single unique entry.
  state = applyEvent(state, recommendationDismissed('rec:general', at(0)));
  assert.deepEqual(state.recommendations.dismissedIds, ['rec:general']);

  assert.doesNotThrow(() => { adapter.save(state, at(0)); });
  const reopened = new LocalStorageAdapter(storage).load(at(0));
  assert.deepEqual(reopened.state.recommendations.dismissedIds, ['rec:general']);
});

test('reset clears recommendation preference data but never removes books, creatures, or reading history', () => {
  let state = startChallenge(initialState(), at(0));
  state = addAndReadAnimalBook(state, '9780064400558', at(0), 'r1');
  const booksBefore = Object.keys(state.books.works).length;
  const creaturesBefore = Object.keys(state.collection.creatures).length;
  const formalDaysBefore = state.reading.formalDayKeys.length;

  ({ state } = requestFlow(state, 'req:1', at(1)));
  state = applyEvent(state, recommendationSaved('rec:animals', at(1)));
  assert.ok(Object.keys(state.recommendations.results).length > 0);

  state = applyEvent(state, recommendationReset(at(2)));
  assert.deepEqual(state.recommendations, { requests: {}, results: {}, savedIds: [], dismissedIds: [] });
  // Owned data is untouched.
  assert.equal(Object.keys(state.books.works).length, booksBefore);
  assert.equal(Object.keys(state.collection.creatures).length, creaturesBefore);
  assert.equal(state.reading.formalDayKeys.length, formalDaysBefore);
});

test('a RecommendationDelivered with no matching request is ignored (idempotent boundary)', () => {
  let state = initialState();
  state = applyEvent(state, recommendationDelivered({
    requestId: 'nope', recommendationId: 'rec:general', source: 'fixture', workIds: ['w1'], editionIds: ['e1']
  }, at(0)));
  assert.deepEqual(state.recommendations.results, {}, 'delivery without a request does not populate results');
});

test('an unavailable provider result leaves the core loop intact (no delivered event, request recorded)', () => {
  // A provider with empty content entries can only return unavailable -> no recommendation.
  const emptyProvider = new FixtureRecommendationProvider({ generalId: 'rec:general', categoryMap: {}, entries: {} });
  let state = initialState();
  const built = buildRecommendationInput(state, { requestId: 'req:1' });
  state = applyEvent(state, recommendationRequested(built.input, at(0)));
  const result = emptyProvider.recommend(built.input, at(0));
  const delivered = deliveredFromResult(result);
  assert.equal(delivered.ok, false, 'no recommendation to deliver');
  // The request is recorded, results stay empty, and nothing else is disturbed.
  assert.ok(state.recommendations.requests['req:1']);
  assert.deepEqual(state.recommendations.results, {});
});
