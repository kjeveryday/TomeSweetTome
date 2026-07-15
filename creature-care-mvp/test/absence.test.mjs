import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, content } from './helpers.mjs';
import { EventTypes, giftGranted } from '../src/events.js';
import { applyEvent, initialState } from '../src/state.js';
import { onOpen, nextStickerId } from '../src/systems/clock.js';

const gifts = (events) => events.filter((e) => e.type === EventTypes.GiftGranted);

function hatchAndClose(storage) {
  const s = openSession(storage, at(0));
  s.hatch(at(0));
  return s;
}

test('away 40h -> wake-up with exactly one sticker; Fullness/Spirit rise to 60', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage); // close at F80 S80 E100
  const s = openSession(storage, at(40));
  assert.equal(gifts(s.openEvents).length, 1);
  assert.equal(s.state.stickers.length, 1);
  // Decay first (F80-160 -> 0, S80-80 -> 0), then the floor lifts both to 60.
  assert.deepEqual(s.state.stats, { fullness: 60, spirit: 60, energy: 100 });
  assert.equal(s.state.cp, 0, 'CP unchanged by the absence flow');
});

test('away 26h -> a normal visit: drift only, no gift', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage);
  const s = openSession(storage, at(26));
  assert.equal(gifts(s.openEvents).length, 0);
  assert.equal(s.state.stickers.length, 0);
});

test('35h59m is still a normal visit; the 36h threshold triggers the gift', () => {
  const minuteMs = content.time.msPerHour / 60;
  const justUnder = createFakeStorage();
  hatchAndClose(justUnder);
  const under = openSession(justUnder, at(36) - minuteMs);
  assert.equal(gifts(under.openEvents).length, 0);

  const exactly = createFakeStorage();
  hatchAndClose(exactly);
  const hit = openSession(exactly, at(36));
  assert.equal(gifts(hit.openEvents).length, 1);
});

test('exactly one gift per return, never stacked, no matter how long the absence', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage);
  const longAway = openSession(storage, at(200)); // way past the 72h clamp
  assert.equal(gifts(longAway.openEvents).length, 1);
  assert.equal(longAway.state.stickers.length, 1);

  // Reopening right away is the same return — no second gift.
  const rightAfter = openSession(storage, at(200));
  assert.equal(gifts(rightAfter.openEvents).length, 0);
  assert.equal(rightAfter.state.stickers.length, 1);

  // But a genuinely new absence is a new return, and earns a new sticker.
  const nextReturn = openSession(storage, at(250));
  assert.equal(gifts(nextReturn.openEvents).length, 1);
  assert.equal(nextReturn.state.stickers.length, 2);
});

test('the welfare floor never lowers a stat: max(current, 60)', () => {
  const base = { ...initialState(), hatched: true };
  const pampered = {
    ...base,
    stats: { fullness: 90, spirit: 95, energy: 50 }
  };
  const after = applyEvent(pampered, giftGranted('star', at(40)));
  assert.deepEqual(after.stats, { fullness: 90, spirit: 95, energy: 50 });

  const mixed = { ...base, stats: { fullness: 12, spirit: 88, energy: 30 } };
  const lifted = applyEvent(mixed, giftGranted('star', at(40)));
  assert.deepEqual(lifted.stats, { fullness: 60, spirit: 88, energy: 30 });
});

test('gifts walk the sticker list in order, then cycle when all are owned', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage);
  const expected = content.stickers.map((s) => s.id);
  for (let i = 0; i < expected.length; i += 1) {
    openSession(storage, at(40 * (i + 1))); // each open is 40h after the last save
  }
  let s = openSession(storage, at(40 * (expected.length + 1)));
  assert.deepEqual(
    s.state.stickers,
    [...expected, expected[0]],
    'seventh gift wraps back to the first sticker'
  );
  const dupCount = s.state.stickers.filter((id) => id === expected[0]).length;
  assert.equal(dupCount, 2, 'duplicates are kept — they still stick on the shelf');
});

test('nextStickerId points at the next unowned sticker', () => {
  const base = initialState();
  assert.equal(nextStickerId(base), content.stickers[0].id);
  const two = { ...base, stickers: content.stickers.slice(0, 2).map((s) => s.id) };
  assert.equal(nextStickerId(two), content.stickers[2].id);
  const all = { ...base, stickers: content.stickers.map((s) => s.id) };
  assert.equal(nextStickerId(all), content.stickers[0].id);
});

test('the egg never receives absence gifts', () => {
  assert.deepEqual(onOpen(initialState(), at(0), at(100)), []);
});
