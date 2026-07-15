// Guards the locked tuning: every number the brief pins must sit in content.json
// with exactly these values, and all copy stays short (never over two lines).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { content } from './helpers.mjs';

test('locked tuning numbers live in content.json with the spec values', () => {
  assert.deepEqual(content.stats.initial, { fullness: 80, spirit: 80, energy: 100 });
  assert.equal(content.stats.min, 0);
  assert.equal(content.stats.max, 100);
  assert.deepEqual(content.stats.decayPerHour, { fullness: 4, spirit: 2 });
  assert.equal(content.stats.energyRegenPerHourClosed, 5);

  const byId = Object.fromEntries(content.care.actions.map((a) => [a.id, a]));
  assert.deepEqual(byId.feed.effects, { fullness: 45 });
  assert.deepEqual(byId.play.effects, { spirit: 25, energy: -10 });
  assert.equal(byId.play.minEnergy, 10);
  assert.deepEqual(byId.tidy.effects, { spirit: 20 });
  assert.deepEqual(content.care.actions.map((a) => a.id), ['feed', 'play', 'tidy']);

  assert.equal(content.care.dailyCpCap, 3);
  assert.equal(content.care.cpPerAction, 1);

  assert.deepEqual(content.species.stages.map((s) => s.cpRequired), [0, 12, 30]);
  assert.deepEqual(content.species.stages.map((s) => s.stage), [1, 2, 3]);

  assert.equal(content.mood.beamingMin, 70);
  assert.equal(content.mood.contentMin, 40);

  assert.equal(content.time.msPerHour, 3600000);
  assert.equal(content.time.maxElapsedHours, 72);
  assert.equal(content.absence.thresholdHours, 36);
  assert.equal(content.absence.statFloor, 60);

  assert.equal(content.stickers.length, 6);
  const ids = new Set(content.stickers.map((s) => s.id));
  assert.equal(ids.size, 6, 'sticker ids are unique');
});

test('every copy string is present, single-segment, and never over two lines', () => {
  assert.equal(content.species.name, 'Pip');
  for (const [key, value] of Object.entries(content.copy)) {
    assert.equal(typeof value, 'string', `copy.${key} is a string`);
    assert.ok(value.length > 0, `copy.${key} is not empty`);
    const lines = value.split('\n').length;
    assert.ok(lines <= 2, `copy.${key} stays within two lines`);
  }
  assert.equal(content.copy.tuckInLine, 'See you tomorrow 🌙');
});
