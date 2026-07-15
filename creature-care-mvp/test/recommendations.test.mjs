import test from 'node:test';
import assert from 'node:assert/strict';

import { isRecommendationResult, ProviderSources } from '../src/providers.js';
import {
  FixtureRecommendationProvider,
  applyDelivery,
  applyDismiss,
  applyRequest,
  applyReset,
  applySave,
  buildRecommendationInput,
  deliveredFromResult,
  recentBroadCategories,
  validateRecommendationsState
} from '../src/systems/recommendations.js';
import { content } from './helpers.mjs';

const at = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();

function record(id, workId, occurredAt) {
  return { id, workId, occurredAt, localDayKey: '2026-7-15' };
}

function creature(id, workId, { revealed = true, genres = [], subjects = [] } = {}) {
  return {
    id,
    workId,
    revealed,
    baseTraits: { book: { genres, subjects } }
  };
}

function emptyRecommendationsSlice() {
  return { requests: {}, results: {}, savedIds: [], dismissedIds: [] };
}

function stateWith(records, creatures) {
  return {
    reading: { records },
    collection: { creatures }
  };
}

// --- recentBroadCategories ---------------------------------------------------

test('recentBroadCategories returns [] for a brand-new user with no reading history', () => {
  assert.deepEqual(recentBroadCategories(stateWith({}, {})), []);
});

test('recentBroadCategories returns [] for malformed state without throwing', () => {
  assert.deepEqual(recentBroadCategories(null), []);
  assert.deepEqual(recentBroadCategories({}), []);
  assert.deepEqual(recentBroadCategories({ reading: {}, collection: {} }), []);
  assert.deepEqual(recentBroadCategories(undefined), []);
});

test('recentBroadCategories orders categories most-recent-record-first', () => {
  const records = {
    'reading:old': record('reading:old', 'work:old', at(2026, 7, 1)),
    'reading:new': record('reading:new', 'work:new', at(2026, 7, 15))
  };
  const creatures = {
    'creature:old': creature('creature:old', 'work:old', { genres: ['adventure'] }),
    'creature:new': creature('creature:new', 'work:new', { genres: ['fantasy'] })
  };
  assert.deepEqual(recentBroadCategories(stateWith(records, creatures)), ['fantasy', 'adventure']);
});

test('recentBroadCategories dedupes categories, preserving first-seen (most recent) order', () => {
  const records = {
    'reading:a': record('reading:a', 'work:a', at(2026, 7, 1)),
    'reading:b': record('reading:b', 'work:b', at(2026, 7, 15))
  };
  const creatures = {
    'creature:a': creature('creature:a', 'work:a', { genres: ['fantasy', 'animal'] }),
    'creature:b': creature('creature:b', 'work:b', { genres: ['fantasy'], subjects: ['friendship'] })
  };
  assert.deepEqual(recentBroadCategories(stateWith(records, creatures)), ['fantasy', 'friendship', 'animal']);
});

test('recentBroadCategories caps the result at the given limit', () => {
  const records = {
    'reading:a': record('reading:a', 'work:a', at(2026, 7, 1)),
    'reading:b': record('reading:b', 'work:b', at(2026, 7, 15))
  };
  const creatures = {
    'creature:a': creature('creature:a', 'work:a', { genres: ['one', 'two'] }),
    'creature:b': creature('creature:b', 'work:b', { genres: ['three', 'four'] })
  };
  assert.deepEqual(recentBroadCategories(stateWith(records, creatures), 2), ['three', 'four']);
});

test('recentBroadCategories only ever derives genre/subject strings, never identity/name/isbn data', () => {
  const records = { 'reading:a': record('reading:a', 'work:a', at(2026, 7, 15)) };
  const creatures = {
    'creature:a': {
      id: 'creature:a',
      workId: 'work:a',
      revealed: true,
      identityKey: '9780064400558',
      baseTraits: { book: { genres: ['Fantasy', '  Adventure  '], subjects: [42, null, ''] }, name: 'Whiskers' }
    }
  };
  const result = recentBroadCategories(stateWith(records, creatures));
  const allowed = new Set(['fantasy', 'adventure']);
  assert.equal(result.every((category) => allowed.has(category)), true);
  assert.deepEqual(result, ['fantasy', 'adventure']);
});

test('recentBroadCategories skips unrevealed creatures and works with no matching creature', () => {
  const records = {
    'reading:a': record('reading:a', 'work:a', at(2026, 7, 15)),
    'reading:b': record('reading:b', 'work:none', at(2026, 7, 14))
  };
  const creatures = { 'creature:a': creature('creature:a', 'work:a', { revealed: false, genres: ['fantasy'] }) };
  assert.deepEqual(recentBroadCategories(stateWith(records, creatures)), []);
});

// --- buildRecommendationInput ---------------------------------------------------

test('buildRecommendationInput rejects an invalid requestId', () => {
  assert.deepEqual(buildRecommendationInput(stateWith({}, {}), { requestId: '' }), { ok: false, reason: 'invalidRequestId' });
  assert.deepEqual(buildRecommendationInput(stateWith({}, {}), { requestId: 42 }), { ok: false, reason: 'invalidRequestId' });
  assert.deepEqual(buildRecommendationInput(stateWith({}, {})), { ok: false, reason: 'invalidRequestId' });
});

test('buildRecommendationInput assembles a valid input with unique categoryIds and no branchId when absent', () => {
  const records = { 'reading:a': record('reading:a', 'work:a', at(2026, 7, 15)) };
  const creatures = { 'creature:a': creature('creature:a', 'work:a', { genres: ['fantasy', 'fantasy'] }) };
  const result = buildRecommendationInput(stateWith(records, creatures), { requestId: 'req:1' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.input, { requestId: 'req:1', categoryIds: ['fantasy'] });
});

test('buildRecommendationInput includes branchId only when it is a non-empty string', () => {
  const withBranch = buildRecommendationInput(stateWith({}, {}), { requestId: 'req:1', branchId: 'branch:1' });
  assert.deepEqual(withBranch.input, { requestId: 'req:1', categoryIds: [], branchId: 'branch:1' });

  const emptyBranch = buildRecommendationInput(stateWith({}, {}), { requestId: 'req:1', branchId: '' });
  assert.deepEqual(emptyBranch.input, { requestId: 'req:1', categoryIds: [] });

  const nonStringBranch = buildRecommendationInput(stateWith({}, {}), { requestId: 'req:1', branchId: 42 });
  assert.deepEqual(nonStringBranch.input, { requestId: 'req:1', categoryIds: [] });
});

// --- FixtureRecommendationProvider.recommend ---------------------------------------------------

test('recommend selects rec:animals for an animal category', () => {
  const provider = new FixtureRecommendationProvider();
  const result = provider.recommend({ requestId: 'req:1', categoryIds: ['animal'] }, 1000);
  assert.equal(isRecommendationResult(result), true);
  assert.equal(result.source, ProviderSources.Fixture);
  assert.equal(result.data.recommendations[0].id, 'rec:animals');
});

test('recommend selects rec:fantasy for fantasy or magic categories', () => {
  const provider = new FixtureRecommendationProvider();
  const fantasy = provider.recommend({ requestId: 'req:1', categoryIds: ['fantasy'] }, 1000);
  const magic = provider.recommend({ requestId: 'req:2', categoryIds: ['magic'] }, 1000);
  assert.equal(fantasy.data.recommendations[0].id, 'rec:fantasy');
  assert.equal(magic.data.recommendations[0].id, 'rec:fantasy');
});

test('recommend falls back to rec:general for a new user with no categories', () => {
  const provider = new FixtureRecommendationProvider();
  const result = provider.recommend({ requestId: 'req:1', categoryIds: [] }, 1000);
  assert.equal(isRecommendationResult(result), true);
  assert.equal(result.data.recommendations[0].id, 'rec:general');
});

test('recommend falls back to rec:general for an unmatched category', () => {
  const provider = new FixtureRecommendationProvider();
  const result = provider.recommend({ requestId: 'req:1', categoryIds: ['spaceships'] }, 1000);
  assert.equal(result.data.recommendations[0].id, 'rec:general');
});

test('recommend output always satisfies isRecommendationResult and carries the entry workIds/editionIds', () => {
  const provider = new FixtureRecommendationProvider();
  const result = provider.recommend({ requestId: 'req:1', categoryIds: ['friendship'] }, 1000);
  assert.equal(isRecommendationResult(result), true);
  const [rec] = result.data.recommendations;
  assert.deepEqual(rec.workIds, content.recommendations.entries['rec:friendship'].books.map((b) => b.workId));
  assert.deepEqual(rec.editionIds, content.recommendations.entries['rec:friendship'].books.map((b) => b.editionId));
  assert.equal(rec.reason, content.recommendations.entries['rec:friendship'].reason);
});

test('recommend is deterministic: identical input yields identical output', () => {
  const provider = new FixtureRecommendationProvider();
  const first = provider.recommend({ requestId: 'req:1', categoryIds: ['nature', 'fantasy'] }, 5000);
  const second = provider.recommend({ requestId: 'req:1', categoryIds: ['nature', 'fantasy'] }, 5000);
  assert.deepEqual(first, second);
});

test('recommend returns an unavailable result with empty recommendations when the selected entry is missing', () => {
  const provider = new FixtureRecommendationProvider({
    recentCategoryLimit: 5,
    generalId: 'rec:general',
    categoryMap: { animal: 'rec:animals' },
    entries: {} // rec:general and rec:animals both missing
  });
  const result = provider.recommend({ requestId: 'req:1', categoryIds: ['animal'] }, 1000);
  assert.equal(isRecommendationResult(result), true);
  assert.equal(result.source, ProviderSources.Unavailable);
  assert.deepEqual(result.data.recommendations, []);
  assert.equal(result.data.requestId, 'req:1');
});

test('recommend throws a TypeError on invalid input', () => {
  const provider = new FixtureRecommendationProvider();
  assert.throws(() => provider.recommend(null), TypeError);
  assert.throws(() => provider.recommend({ requestId: '', categoryIds: [] }), TypeError);
  assert.throws(() => provider.recommend({ requestId: 'req:1', categoryIds: 'nope' }), TypeError);
  assert.throws(() => provider.recommend({ requestId: 'req:1', categoryIds: [42] }), TypeError);
});

test('healthCheck reports fixture/available', () => {
  const provider = new FixtureRecommendationProvider();
  const result = provider.healthCheck(1000);
  assert.equal(result.source, ProviderSources.Fixture);
  assert.deepEqual(result.data, { status: 'available' });
});

// --- deliveredFromResult ---------------------------------------------------

test('deliveredFromResult extracts the first recommendation fields from a real result', () => {
  const provider = new FixtureRecommendationProvider();
  const result = provider.recommend({ requestId: 'req:1', categoryIds: ['fantasy'] }, 1000);
  const delivered = deliveredFromResult(result);
  assert.equal(delivered.ok, true);
  assert.deepEqual(delivered.delivered, {
    requestId: 'req:1',
    recommendationId: 'rec:fantasy',
    source: ProviderSources.Fixture,
    workIds: content.recommendations.entries['rec:fantasy'].books.map((b) => b.workId),
    editionIds: content.recommendations.entries['rec:fantasy'].books.map((b) => b.editionId)
  });
});

test('deliveredFromResult reports noRecommendation for an unavailable/empty result, never throwing', () => {
  const provider = new FixtureRecommendationProvider({
    recentCategoryLimit: 5, generalId: 'rec:general', categoryMap: {}, entries: {}
  });
  const result = provider.recommend({ requestId: 'req:1', categoryIds: [] }, 1000);
  assert.deepEqual(deliveredFromResult(result), { ok: false, reason: 'noRecommendation' });
  assert.deepEqual(deliveredFromResult(null), { ok: false, reason: 'noRecommendation' });
  assert.deepEqual(deliveredFromResult(undefined), { ok: false, reason: 'noRecommendation' });
  assert.deepEqual(deliveredFromResult({}), { ok: false, reason: 'noRecommendation' });
});

// --- slice transforms ---------------------------------------------------

test('applyRequest stores categoryIds/branchId under requests[requestId] without mutating input', () => {
  const slice = emptyRecommendationsSlice();
  const categoryIds = ['fantasy'];
  const next = applyRequest(slice, { requestId: 'req:1', categoryIds, branchId: 'branch:1' });
  assert.deepEqual(next.requests, { 'req:1': { categoryIds: ['fantasy'], branchId: 'branch:1' } });
  assert.deepEqual(slice, emptyRecommendationsSlice());
  assert.deepEqual(categoryIds, ['fantasy']);
});

test('applyRequest omits branchId when absent and is idempotent for the same requestId', () => {
  const slice = emptyRecommendationsSlice();
  const once = applyRequest(slice, { requestId: 'req:1', categoryIds: ['fantasy'] });
  assert.deepEqual(once.requests['req:1'], { categoryIds: ['fantasy'] });
  const twice = applyRequest(once, { requestId: 'req:1', categoryIds: ['fantasy'] });
  assert.deepEqual(twice.requests['req:1'], { categoryIds: ['fantasy'] });
});

test('applyRequest guards invalid input by returning the slice unchanged', () => {
  const slice = emptyRecommendationsSlice();
  assert.deepEqual(applyRequest(slice, { requestId: '', categoryIds: [] }), slice);
  assert.deepEqual(applyRequest(slice, { requestId: 'req:1', categoryIds: 'nope' }), slice);
  assert.deepEqual(applyRequest(slice), slice);
});

test('applyDelivery stores the result under results[requestId] without mutating input', () => {
  const slice = emptyRecommendationsSlice();
  const workIds = ['work:1'];
  const editionIds = ['edition:1'];
  const next = applyDelivery(slice, {
    requestId: 'req:1', recommendationId: 'rec:fantasy', source: ProviderSources.Fixture, workIds, editionIds
  });
  assert.deepEqual(next.results, {
    'req:1': { recommendationId: 'rec:fantasy', source: ProviderSources.Fixture, workIds: ['work:1'], editionIds: ['edition:1'] }
  });
  assert.deepEqual(slice, emptyRecommendationsSlice());
  assert.deepEqual(workIds, ['work:1']);
});

test('applyDelivery guards invalid input by returning the slice unchanged', () => {
  const slice = emptyRecommendationsSlice();
  assert.deepEqual(applyDelivery(slice, { requestId: '', recommendationId: 'r', source: 'fixture', workIds: [], editionIds: [] }), slice);
  assert.deepEqual(applyDelivery(slice), slice);
});

test('applySave then applyDismiss on the same id moves it between the two unique lists, never both', () => {
  let slice = emptyRecommendationsSlice();
  slice = applySave(slice, 'rec:fantasy');
  assert.deepEqual(slice.savedIds, ['rec:fantasy']);
  assert.deepEqual(slice.dismissedIds, []);

  slice = applyDismiss(slice, 'rec:fantasy');
  assert.deepEqual(slice.savedIds, []);
  assert.deepEqual(slice.dismissedIds, ['rec:fantasy']);

  slice = applySave(slice, 'rec:fantasy');
  assert.deepEqual(slice.savedIds, ['rec:fantasy']);
  assert.deepEqual(slice.dismissedIds, []);
});

test('applySave and applyDismiss dedupe repeated ids', () => {
  let slice = emptyRecommendationsSlice();
  slice = applySave(slice, 'rec:fantasy');
  slice = applySave(slice, 'rec:fantasy');
  assert.deepEqual(slice.savedIds, ['rec:fantasy']);
});

test('applySave/applyDismiss guard invalid input by returning the slice unchanged, without mutating', () => {
  const slice = emptyRecommendationsSlice();
  assert.deepEqual(applySave(slice, ''), slice);
  assert.deepEqual(applySave(slice, 42), slice);
  assert.deepEqual(applyDismiss(slice, ''), slice);
  assert.deepEqual(slice, emptyRecommendationsSlice());
});

test('applyReset clears requests, results, savedIds, and dismissedIds', () => {
  let slice = emptyRecommendationsSlice();
  slice = applyRequest(slice, { requestId: 'req:1', categoryIds: ['fantasy'] });
  slice = applyDelivery(slice, {
    requestId: 'req:1', recommendationId: 'rec:fantasy', source: ProviderSources.Fixture, workIds: [], editionIds: []
  });
  slice = applySave(slice, 'rec:fantasy');
  assert.deepEqual(applyReset(slice), emptyRecommendationsSlice());
});

// --- validateRecommendationsState ---------------------------------------------------

test('validateRecommendationsState accepts a well-formed slice', () => {
  assert.equal(validateRecommendationsState(emptyRecommendationsSlice()), true);
  assert.equal(validateRecommendationsState({
    requests: { 'req:1': { categoryIds: ['fantasy'] } },
    results: { 'req:1': { recommendationId: 'rec:fantasy', source: 'fixture', workIds: [], editionIds: [] } },
    savedIds: ['rec:fantasy'],
    dismissedIds: []
  }), true);
});

test('validateRecommendationsState rejects a non-array savedIds', () => {
  assert.equal(validateRecommendationsState({ ...emptyRecommendationsSlice(), savedIds: 'rec:fantasy' }), false);
});

test('validateRecommendationsState rejects duplicate ids in dismissedIds', () => {
  assert.equal(validateRecommendationsState({ ...emptyRecommendationsSlice(), dismissedIds: ['a', 'a'] }), false);
});

test('validateRecommendationsState rejects malformed shapes without throwing', () => {
  assert.equal(validateRecommendationsState(null), false);
  assert.equal(validateRecommendationsState({}), false);
  assert.equal(validateRecommendationsState({ ...emptyRecommendationsSlice(), requests: [] }), false);
  assert.equal(validateRecommendationsState({ ...emptyRecommendationsSlice(), results: null }), false);
});
