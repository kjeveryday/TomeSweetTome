import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEvent, initialState } from '../src/state.js';
import { creatureGenerated, hatched } from '../src/events.js';
import { generateCreature } from '../src/systems/generation.js';
import { createPersistence } from '../src/systems/persistence.js';
import { createFakeStorage, at } from './helpers.mjs';

test('a generated book creature becomes the egg identity, then hatches normally', async () => {
  const generated = (await generateCreature('9780064400558')).creature;
  let state = applyEvent(initialState(), creatureGenerated(generated, at(0)));
  assert.equal(state.hatched, false);
  assert.equal(state.name, 'Mossprig');
  state = applyEvent(state, hatched(at(0)));
  assert.equal(state.hatched, true);
  assert.equal(state.name, 'Mossprig');
  assert.deepEqual(state.stats, { fullness: 80, spirit: 80, energy: 100 });
});

test('giving an existing creature a book look preserves every care value', async () => {
  const generated = (await generateCreature('9780399226908')).creature;
  const before = {
    ...applyEvent(initialState(), hatched(at(0))),
    stats: { fullness: 41, spirit: 52, energy: 63 },
    cp: 9,
    actionsToday: 2,
    stickers: ['star'],
    tuckedIn: true
  };
  const after = applyEvent(before, creatureGenerated(generated, at(1)));
  for (const key of ['hatched', 'stage', 'stats', 'cp', 'actionsToday', 'dayKey', 'stickers', 'tuckedIn']) {
    assert.deepEqual(after[key], before[key], `${key} is preserved`);
  }
  assert.equal(after.name, generated.name);
  assert.equal(after.creature.isbn, generated.isbn);
});

test('new book identities keep prior generated identities and round-trip', async () => {
  const storage = createFakeStorage();
  const first = (await generateCreature('9780064400558')).creature;
  const second = (await generateCreature('9780590353403')).creature;
  let state = applyEvent(initialState(), creatureGenerated(first, at(0)));
  state = applyEvent(state, creatureGenerated(second, at(0)));
  assert.deepEqual(state.creatureHistory.map((entry) => entry.isbn), [first.isbn]);

  const persistence = createPersistence(storage);
  persistence.save(state, at(0));
  assert.deepEqual(createPersistence(storage).load().state, state);
});

