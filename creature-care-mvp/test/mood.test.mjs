import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodOf, initialState } from '../src/state.js';

const mood = (fullness, spirit, energy = 0) =>
  moodOf({ ...initialState(), stats: { fullness, spirit, energy } });

test('mood table: both >=70 beaming, both >=40 content', () => {
  assert.equal(mood(70, 70), 'beaming');
  assert.equal(mood(100, 100), 'beaming');
  assert.equal(mood(70, 69), 'content');
  assert.equal(mood(69, 70), 'content');
  assert.equal(mood(40, 40), 'content');
  assert.equal(mood(45, 91), 'content');
});

test('mood table: otherwise peckish when Fullness < Spirit', () => {
  assert.equal(mood(39, 40), 'peckish');
  assert.equal(mood(0, 1), 'peckish');
  assert.equal(mood(4, 52), 'peckish');
  assert.equal(mood(0, 39), 'peckish');
});

test('mood table: otherwise sleepy, and ties -> sleepy (all-zeros shows sleepy)', () => {
  assert.equal(mood(40, 39), 'sleepy');
  assert.equal(mood(100, 39), 'sleepy');
  assert.equal(mood(1, 0), 'sleepy');
  assert.equal(mood(0, 0), 'sleepy');
  assert.equal(mood(39, 39), 'sleepy');
});

test('mood ignores Energy entirely', () => {
  assert.equal(mood(80, 80, 0), 'beaming');
  assert.equal(mood(41, 41, 0), 'content');
  assert.equal(mood(39, 41, 100), 'peckish');
  assert.equal(mood(0, 0, 100), 'sleepy');
});
