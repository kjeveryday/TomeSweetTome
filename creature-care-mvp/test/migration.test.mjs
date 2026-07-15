import test from 'node:test';
import assert from 'node:assert/strict';

import { applyEvent, initialState } from '../src/state.js';
import { createBookEdition, createBookWork } from '../src/contracts.js';
import { careActionPerformed, dayRolledOver, giftGranted, timeElapsed, tuckedIn } from '../src/events.js';
import { generateCreature } from '../src/systems/generation.js';
import {
  CURRENT_SAVE_KEY,
  LEGACY_SAVE_KEY,
  isCurrentEnvelope,
  migrateSave
} from '../src/systems/migration.js';
import { LocalStorageAdapter, SyncedStorageAdapter } from '../src/systems/storage.js';

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const legacyCare = (overrides = {}) => ({
  ...initialState(),
  hatched: true,
  name: 'Pip',
  stage: 3,
  stats: { fullness: 61, spirit: 72, energy: 83 },
  cp: 31,
  actionsToday: 2,
  dayKey: '2026-7-15',
  stickers: ['leaf', 'star'],
  tuckedIn: true,
  ...overrides
});

test('fresh migration creates a valid current envelope with every optional feature off', () => {
  const first = migrateSave(null, { now: 100 });
  assert.equal(first.status, 'fresh');
  assert.equal(isCurrentEnvelope(first.envelope), true);
  assert.equal(first.envelope.savedAt, 100);
  assert.equal(first.envelope.lastSeen, 0);
  assert.equal(Object.values(first.envelope.featureFlags).every((value) => value === false), true);
  assert.deepEqual(first.envelope.state.collection.creatures, {});
});

test('valid generated legacy save preserves active identity, history, care, stickers, stage, CP, and timestamp', async () => {
  const first = (await generateCreature('9780064400558')).creature;
  const active = (await generateCreature('9780399226908')).creature;
  const legacyState = legacyCare({ name: active.name, creature: active, creatureHistory: [first] });
  const migrated = migrateSave({ state: legacyState, lastSeen: 456 }, { now: 789 });

  assert.equal(migrated.status, 'migrated');
  assert.equal(migrated.envelope.lastSeen, 456);
  assert.equal(migrated.envelope.savedAt, 789);
  assert.deepEqual(migrated.envelope.state.stats, legacyState.stats);
  assert.equal(migrated.envelope.state.stage, 3);
  assert.equal(migrated.envelope.state.cp, 31);
  assert.deepEqual(migrated.envelope.state.stickers, ['leaf', 'star']);
  assert.equal(migrated.envelope.state.creature.seed, active.seed);
  assert.deepEqual(migrated.envelope.state.creatureHistory.map((entry) => entry.seed), [first.seed]);

  const collection = migrated.envelope.state.collection;
  assert.equal(Object.keys(collection.creatures).length, 2);
  assert.equal(collection.archivedCreatureIds.length, 1);
  assert.deepEqual(collection.creatures[collection.archivedCreatureIds[0]].careState, { status: 'uninitialized' });
  const activeRecord = collection.creatures[collection.activeCreatureId];
  assert.equal(activeRecord.identityVersion, active.seedVersion);
  assert.equal(activeRecord.identityKey, active.isbn);
  assert.equal(activeRecord.baseTraits.seed, active.seed);
  assert.deepEqual(activeRecord.careState.stats, legacyState.stats);
  assert.equal(activeRecord.careState.cp, 31);
  assert.equal(activeRecord.careState.stage, 3);
  assert.equal(activeRecord.careState.tuckedIn, true);
});

test('A to B to A legacy history deduplicates current collection without altering legacy history', async () => {
  const a = (await generateCreature('9780064400558')).creature;
  const b = (await generateCreature('9780399226908')).creature;
  const legacyState = legacyCare({ creature: a, creatureHistory: [a, b] });
  const result = migrateSave({ state: legacyState, lastSeen: 1 });
  assert.equal(Object.keys(result.envelope.state.collection.creatures).length, 2);
  assert.deepEqual(result.envelope.state.creatureHistory.map((entry) => entry.isbn), [a.isbn, b.isbn]);
  assert.equal(result.envelope.state.collection.archivedCreatureIds.length, 1);
  const collection = result.envelope.state.collection;
  assert.equal(collection.creatures[collection.activeCreatureId].identityKey, a.isbn);
  assert.equal(collection.creatures[collection.archivedCreatureIds[0]].identityKey, b.isbn);
  assert.deepEqual(collection.visibleCreatureIds, [collection.activeCreatureId]);
  assert.equal(new Set(Object.values(collection.creatures).map((record) => record.workId)).size, 2);
  assert.deepEqual(migrateSave(result.envelope).envelope, result.envelope);
});

test('pre-generator hatched save preserves original creature and exact care state', () => {
  const legacyState = legacyCare();
  delete legacyState.creature;
  delete legacyState.creatureHistory;
  const result = migrateSave({ state: legacyState, lastSeen: 88 });
  assert.equal(result.status, 'migrated');
  assert.equal(result.envelope.state.name, 'Pip');
  assert.equal(result.envelope.state.collection.activeCreatureId, 'creature:legacy:original');
  const record = result.envelope.state.collection.creatures['creature:legacy:original'];
  assert.equal(record.baseTraits.name, 'Pip');
  assert.deepEqual(record.careState.stats, legacyState.stats);
  assert.equal(record.careState.cp, legacyState.cp);
  assert.equal(result.envelope.lastSeen, 88);
});

test('corrupted saves recover as a fresh current envelope without throwing', () => {
  for (const corrupt of ['{', '{}', JSON.stringify({ state: {} }), JSON.stringify({ state: [], lastSeen: 1 })]) {
    const result = migrateSave(corrupt, { now: 9 });
    assert.equal(result.status, 'corrupt');
    assert.equal(isCurrentEnvelope(result.envelope), true);
    assert.equal(result.envelope.state.hatched, false);
  }
});

test('malformed optional legacy creature fields are preserved safely as an unlinked legacy creature', () => {
  const malformedCreatures = [
    { kind: 'book', isbn: '9780064400559', seedVersion: 'stacklings:v1', name: 'Bad checksum' },
    { kind: 'book', isbn: '978-0-06-440055-8', seedVersion: 'stacklings:v1', name: 'Formatted' },
    { kind: 'book', seedVersion: 'stacklings:v1', name: 'Missing ISBN' },
    { kind: 'treat', isbn: '9780064400558', name: 'Wrong kind' }
  ];
  for (const creature of malformedCreatures) {
    const result = migrateSave({ state: legacyCare({ creature, name: creature.name }), lastSeen: 12 });
    assert.equal(result.status, 'migrated');
    assert.equal(isCurrentEnvelope(result.envelope), true);
    assert.equal(result.envelope.state.collection.activeCreatureId, 'creature:legacy:original');
    assert.deepEqual(
      result.envelope.state.collection.creatures['creature:legacy:original'].baseTraits.legacyCreature,
      creature
    );
  }
});

test('missing or malformed seedVersion falls back to frozen v1 without changing the valid ISBN identity', () => {
  for (const seedVersion of [undefined, 12, null, '', '   ']) {
    const creature = { kind: 'book', isbn: '9780064400558', name: 'Legacy', ...(seedVersion === undefined ? {} : { seedVersion }) };
    const result = migrateSave({ state: legacyCare({ creature }), lastSeen: 4 });
    assert.equal(result.status, 'migrated');
    const active = result.envelope.state.collection.creatures[result.envelope.state.collection.activeCreatureId];
    assert.equal(active.identityVersion, 'stacklings:v1');
    assert.equal(active.identityKey, '9780064400558');
  }
});

test('current envelope rejects dangling and duplicate cross-record references', () => {
  const base = migrateSave(null).envelope;
  const work = createBookWork({ id: 'work:1', title: 'Book', editionIds: ['edition:1'] });
  const edition = createBookEdition({ id: 'edition:1', workId: 'work:1', metadataSource: 'fixture' });
  base.state.books.works[work.id] = work;
  base.state.books.editions[edition.id] = edition;
  assert.equal(isCurrentEnvelope(base), true);

  const cases = [
    (value) => { value.state.books.works['work:1'].editionIds = ['edition:missing']; },
    (value) => { value.state.books.editions['edition:1'].workId = 'work:missing'; },
    (value) => { value.state.books.aliases['isbn13:9780064400558'] = 'work:missing'; },
    (value) => { value.state.books.aliases['invented:alias'] = 'work:1'; },
    (value) => { value.state.reading.records.bad = { id: 'different', workId: 'work:1' }; },
    (value) => { value.state.reading.formalDayKeys = ['2026-7-15', '2026-7-15']; },
    (value) => { value.state.collection.activeCreatureId = 'creature:missing'; }
  ];
  for (const corrupt of cases) {
    const value = structuredClone(base);
    corrupt(value);
    assert.equal(isCurrentEnvelope(value), false);
    assert.equal(migrateSave(value).status, 'corrupt');
  }
});

test('current envelope enforces one creature per work and valid collection IDs', () => {
  const base = migrateSave({ state: legacyCare(), lastSeen: 1 }).envelope;
  const original = base.state.collection.creatures['creature:legacy:original'];
  base.state.collection.creatures['creature:duplicate'] = { ...structuredClone(original), id: 'creature:duplicate' };
  assert.equal(isCurrentEnvelope(base), false);
  base.state.collection.reconciledDuplicateWorkIds = [original.workId];
  assert.equal(isCurrentEnvelope(base), true);
  delete base.state.collection.creatures['creature:duplicate'];
  assert.equal(isCurrentEnvelope(base), false);

  const duplicateVisible = migrateSave({ state: legacyCare(), lastSeen: 1 }).envelope;
  duplicateVisible.state.collection.visibleCreatureIds.push('creature:legacy:original');
  assert.equal(isCurrentEnvelope(duplicateVisible), false);

  const activeNotVisible = migrateSave({ state: legacyCare(), lastSeen: 1 }).envelope;
  activeNotVisible.state.collection.visibleCreatureIds = [];
  assert.equal(isCurrentEnvelope(activeNotVisible), false);

  const overlap = migrateSave({ state: legacyCare(), lastSeen: 1 }).envelope;
  overlap.state.collection.activeCreatureId = null;
  overlap.state.collection.archivedCreatureIds = ['creature:legacy:original'];
  assert.equal(isCurrentEnvelope(overlap), false);
});

test('current envelope rejects malformed creature care, relationship, and care-item ledgers', () => {
  const cases = [
    (value) => { value.state.collection.creatures['creature:legacy:original'].careState = {}; },
    (value) => { value.state.collection.creatures['creature:legacy:original'].relationshipDayKeys = ['banana']; },
    (value) => { value.state.careItems.grantDayKeys = ['2026-7-15', '2026-7-15']; },
    (value) => { value.state.careItems.inventory = [{}]; }
  ];
  for (const corrupt of cases) {
    const envelope = migrateSave({ state: legacyCare(), lastSeen: 1 }).envelope;
    corrupt(envelope);
    assert.equal(isCurrentEnvelope(envelope), false);
  }
});

test('root care is the active-record compatibility projection after every preserved v1 care event', () => {
  const storage = new FakeStorage();
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ state: legacyCare(), lastSeen: 1000 }));
  const adapter = new LocalStorageAdapter(storage);
  let state = adapter.load(1000).state;
  const events = [
    careActionPerformed('feed', 1, 1100),
    timeElapsed(60 * 60 * 1000, 1200),
    dayRolledOver('2026-7-16', 1300),
    giftGranted('star', 1400),
    tuckedIn(1500)
  ];
  for (const event of events) {
    state = applyEvent(state, event);
    state = adapter.save(state, event.at).state;
    const active = state.collection.creatures[state.collection.activeCreatureId].careState;
    assert.deepEqual(active, {
      status: 'ready',
      stats: state.stats,
      stage: state.stage,
      cp: state.cp,
      actionsToday: state.actionsToday,
      dayKey: state.dayKey,
      stickers: state.stickers,
      tuckedIn: state.tuckedIn
    });
  }
  assert.equal(isCurrentEnvelope(JSON.parse(adapter.export())), true);
});

test('invalid current book data is refused without replacing migrated care and collection state', () => {
  const storage = new FakeStorage();
  const original = legacyCare({ cp: 27, stickers: ['leaf', 'star'] });
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ state: original, lastSeen: 1000 }));
  const adapter = new LocalStorageAdapter(storage);
  const before = adapter.load(1000);
  const invalid = structuredClone(before.state);
  invalid.books.works['work:legacy:unlinked'].editionIds.push('edition:missing');

  assert.throws(() => adapter.save(invalid, 1100), /invalid Stacklings state/);
  const after = adapter.load(1100);
  assert.equal(after.state.cp, 27);
  assert.deepEqual(after.state.stickers, ['leaf', 'star']);
  assert.equal(after.state.collection.activeCreatureId, before.state.collection.activeCreatureId);
  assert.equal(after.lastSeen, before.lastSeen);
});

test('formal reading days equal the distinct canonical day keys in accepted reading records', () => {
  const envelope = migrateSave(null).envelope;
  envelope.state.books.works['work:1'] = createBookWork({ id: 'work:1', title: 'Book' });
  envelope.state.reading.records['reading:1'] = {
    id: 'reading:1', workId: 'work:1', occurredAt: '2026-07-15T12:00:00.000Z', localDayKey: '2026-7-15'
  };
  assert.equal(isCurrentEnvelope(envelope), false, 'a represented reading day cannot be omitted');
  envelope.state.reading.formalDayKeys = ['2026-7-15'];
  assert.equal(isCurrentEnvelope(envelope), true);
  envelope.state.reading.formalDayKeys = ['2026-7-15', '2026-7-16'];
  assert.equal(isCurrentEnvelope(envelope), false, 'an orphan formal day is rejected');
  envelope.state.reading.formalDayKeys = ['2026-07-15'];
  assert.equal(isCurrentEnvelope(envelope), false, 'padded aliases cannot double-count the canonical day');
});

test('valid populated reading slice remains byte-identical through migration and export', () => {
  const storage = new FakeStorage();
  const envelope = migrateSave(null).envelope;
  envelope.state.books.works['work:1'] = createBookWork({ id: 'work:1', title: 'Book' });
  envelope.state.reading.records['reading:1'] = {
    id: 'reading:1',
    workId: 'work:1',
    occurredAt: '2026-07-15T12:00:00.000Z',
    localDayKey: '2026-7-15',
    mode: 'shared'
  };
  envelope.state.reading.formalDayKeys = ['2026-7-15'];
  assert.equal(isCurrentEnvelope(envelope), true);
  storage.setItem(CURRENT_SAVE_KEY, JSON.stringify(envelope));
  const adapter = new LocalStorageAdapter(storage);
  assert.deepEqual(adapter.load(), envelope);
  assert.deepEqual(JSON.parse(adapter.export()), envelope);
  assert.deepEqual(migrateSave(envelope).envelope, envelope);
});

test('current migration is idempotent and does not change bytes or timestamps', async () => {
  const active = (await generateCreature('9780064400558')).creature;
  const first = migrateSave({ state: legacyCare({ creature: active }), lastSeen: 55 }, { now: 60 });
  const second = migrateSave(first.envelope, { now: 999999 });
  const third = migrateSave(second, { now: 1234567 });
  assert.equal(second.status, 'current');
  assert.equal(third.status, 'current');
  assert.deepEqual(second.envelope, first.envelope);
  assert.deepEqual(third.envelope, first.envelope);
});

test('LocalStorageAdapter migrates legacy data once and then loads the current envelope', () => {
  const storage = new FakeStorage();
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ state: legacyCare(), lastSeen: 40 }));
  const adapter = new LocalStorageAdapter(storage);
  const first = adapter.load(50);
  assert.equal(isCurrentEnvelope(first), true);
  assert.ok(storage.getItem(CURRENT_SAVE_KEY));
  assert.ok(storage.getItem(LEGACY_SAVE_KEY), 'legacy input remains until explicit delete');

  const reopened = new LocalStorageAdapter(storage).load(5000);
  assert.deepEqual(reopened, first);
});

test('LocalStorageAdapter preserves monotonic lastSeen, exports, deletes only app saves, and reports health', () => {
  const storage = new FakeStorage();
  storage.setItem('unrelated', 'keep');
  const adapter = new LocalStorageAdapter(storage);
  const fresh = adapter.load(10);
  adapter.save(fresh.state, 20);
  adapter.save(fresh.state, 5);
  const exported = JSON.parse(adapter.export());
  assert.equal(exported.lastSeen, 20);
  assert.equal(exported.savedAt, 20);
  assert.deepEqual(adapter.healthCheck(), { ok: true, storageKind: 'local' });
  assert.equal(storage.getItem(`${CURRENT_SAVE_KEY}.healthCheck`), null);
  adapter.delete();
  assert.equal(storage.getItem(CURRENT_SAVE_KEY), null);
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});

test('LocalStorageAdapter recovers from a corrupt current save by using a valid legacy save', () => {
  const storage = new FakeStorage();
  storage.setItem(CURRENT_SAVE_KEY, '{');
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ state: legacyCare(), lastSeen: 77 }));
  const loaded = new LocalStorageAdapter(storage).load(80);
  assert.equal(loaded.lastSeen, 77);
  assert.equal(loaded.state.hatched, true);
  assert.equal(isCurrentEnvelope(loaded), true);
});

test('SyncedStorageAdapter fixture implements the same load/save/export/delete/health contract', () => {
  const adapter = new SyncedStorageAdapter();
  const fresh = adapter.load(10);
  fresh.state.name = 'Local fixture';
  const saved = adapter.save(fresh.state, 20);
  assert.equal(saved.state.name, 'Local fixture');
  assert.equal(JSON.parse(adapter.export()).state.name, 'Local fixture');
  assert.deepEqual(adapter.healthCheck(), { ok: true, storageKind: 'synchronized_fixture' });
  adapter.delete();
  assert.equal(adapter.load(30).state.name, null);
});
