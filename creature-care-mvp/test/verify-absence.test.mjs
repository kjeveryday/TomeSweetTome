// INDEPENDENT VERIFICATION — absence & gifts.
// Adversarial re-derivation of the invariants in BRIEF.md ("Absence & return", Care rules,
// edge case 3) and the PRD (6.6: "Preserve all current care, mood, clock, absence, and
// persistence behavior"). This file does not trust src/state.js or src/systems/clock.js —
// every test tries to construct an input that would break the stated rule.
//
// Invariants under test:
//   1. Absence threshold is 36h, measured against lastSeen (last persisted event), not
//      hatch time, calendar days, or any other anchor.
//   2. Away < 36h -> normal visit, NO gift. Away >= 36h -> wake-up + EXACTLY ONE sticker.
//   3. Exactly one gift per return, regardless of absence length; never stacks.
//   4. On return, Fullness/Spirit = max(current_after_decay, floor=60); never lowers a
//      stat below its plain-decay value. CP unchanged by absence.
//   5. Sticker selection: next unowned of the 6 content.json types; cycles when all owned.
//
// Deterministic throughout: every timestamp is explicit via helpers' at()/H. No wall clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, H, content } from './helpers.mjs';
import { EventTypes, giftGranted } from '../src/events.js';
import { applyEvent, initialState } from '../src/state.js';
import { onOpen, nextStickerId } from '../src/systems/clock.js';

const gifts = (events) => events.filter((e) => e.type === EventTypes.GiftGranted);

function hatchAndClose(storage, hatchAt = at(0)) {
  const s = openSession(storage, hatchAt);
  s.hatch(hatchAt);
  return s;
}

// ---------------------------------------------------------------------------
// 1 & 2. Threshold boundary: away < 36h never gifts; away >= 36h always gifts exactly once.
// ---------------------------------------------------------------------------

test('millisecond-precise boundary: 36h-1ms is normal, exactly 36h triggers, 36h+1ms triggers', () => {
  const below = createFakeStorage();
  hatchAndClose(below);
  const belowOpen = openSession(below, at(36) - 1);
  assert.equal(gifts(belowOpen.openEvents).length, 0, '1ms before the threshold must NOT gift');
  assert.equal(belowOpen.state.stickers.length, 0);

  const exact = createFakeStorage();
  hatchAndClose(exact);
  const exactOpen = openSession(exact, at(36));
  assert.equal(gifts(exactOpen.openEvents).length, 1, 'exactly at the threshold must trigger (spec: Away >= 36h)');
  assert.equal(exactOpen.state.stickers.length, 1);

  const above = createFakeStorage();
  hatchAndClose(above);
  const aboveOpen = openSession(above, at(36) + 1);
  assert.equal(gifts(aboveOpen.openEvents).length, 1, '1ms after the threshold must trigger');
});

test('every away duration clearly under 36h is a normal visit: no gift, stickers untouched', () => {
  const hoursList = [0, 0.5, 1, 5, 20, 26, 35];
  for (const h of hoursList) {
    const storage = createFakeStorage();
    hatchAndClose(storage);
    const opened = openSession(storage, at(h));
    assert.equal(gifts(opened.openEvents).length, 0, `h=${h}: must not gift`);
    assert.equal(opened.state.stickers.length, 0, `h=${h}: no sticker recorded`);
  }
});

test('absence is measured from lastSeen (last persisted event), not from hatch time', () => {
  // Case A: a lone action moves lastSeen to +10h. Reopening at +44h is only 34h since
  // that true lastSeen (must NOT gift), even though it is 44h since hatch (>=36h) — a
  // defect that measured absence from hatch/install time would wrongly grant a gift here.
  const storageA = createFakeStorage();
  const sA = openSession(storageA, at(0));
  sA.hatch(at(0));
  sA.act('feed', at(10)); // lastSeen becomes at(10)
  const reopenA = openSession(storageA, at(44)); // 34h since lastSeen(10h); 44h since hatch
  assert.equal(gifts(reopenA.openEvents).length, 0, 'must not trigger: only 34h since the true lastSeen');
  assert.equal(reopenA.state.stickers.length, 0);

  // Case B: identical setup, but reopening at +46h is exactly 36h since lastSeen(10h) -> triggers.
  const storageB = createFakeStorage();
  const sB = openSession(storageB, at(0));
  sB.hatch(at(0));
  sB.act('feed', at(10));
  const reopenB = openSession(storageB, at(46));
  assert.equal(gifts(reopenB.openEvents).length, 1, 'must trigger: exactly 36h since the true lastSeen');
});

test('a backward device clock can never trigger the absence gift, regardless of magnitude', () => {
  const storage = createFakeStorage();
  const s0 = hatchAndClose(storage);
  const before = s0.state.stats;
  const opened = openSession(storage, at(-40)); // clock jumps 40h backward
  assert.equal(gifts(opened.openEvents).length, 0);
  assert.equal(opened.state.stickers.length, 0);
  assert.deepEqual(opened.state.stats, before, 'no decay and no floor-lift when elapsed clamps to 0');
  assert.equal(opened.state.cp, s0.state.cp);
});

// ---------------------------------------------------------------------------
// 3. Exactly one gift per return; never stacks, no matter the mechanism.
// ---------------------------------------------------------------------------

test('two consecutive qualifying absences grant exactly two separate single stickers', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage);

  // First absence: exactly 36h -> gift #1.
  const first = openSession(storage, at(36));
  assert.equal(gifts(first.openEvents).length, 1);
  assert.deepEqual(first.state.stickers, [content.stickers[0].id]);

  // Immediate reopen, zero elapsed -> no new gift.
  const immediate = openSession(storage, at(36));
  assert.equal(gifts(immediate.openEvents).length, 0);
  assert.equal(immediate.state.stickers.length, 1);

  // A short return (20h since the last lastSeen) -> still no gift.
  const short = openSession(storage, at(36 + 20));
  assert.equal(gifts(short.openEvents).length, 0);
  assert.equal(short.state.stickers.length, 1);

  // Second qualifying absence (36h since the short return) -> gift #2, not stacked with #1.
  const second = openSession(storage, at(36 + 20 + 36));
  assert.equal(gifts(second.openEvents).length, 1);
  assert.deepEqual(second.state.stickers, [content.stickers[0].id, content.stickers[1].id]);

  // Total gifts across the whole timeline: exactly 2, never more.
  const total = [first, immediate, short, second].reduce((n, s) => n + gifts(s.openEvents).length, 0);
  assert.equal(total, 2);
});

test('a single absence never grants more than one sticker, even at 10x the threshold', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage);
  const opened = openSession(storage, at(36 * 10)); // refutes a "one sticker per 36h chunk" bug
  assert.equal(gifts(opened.openEvents).length, 1, 'not 10 stickers for 10x the threshold');
  assert.equal(opened.state.stickers.length, 1);
});

// ---------------------------------------------------------------------------
// 72h clamp interaction: elapsed is capped BEFORE both decay and the gift check use it,
// so every absence beyond 72h must land on the identical outcome.
// ---------------------------------------------------------------------------

test('the 72h clamp: wildly different long absences all land on the identical outcome', () => {
  const durationsHours = [72, 100, 500, 24 * 365];
  for (const h of durationsHours) {
    const storage = createFakeStorage();
    hatchAndClose(storage);
    const opened = openSession(storage, at(h));
    assert.equal(gifts(opened.openEvents).length, 1, `h=${h}: exactly one gift`);
    assert.deepEqual(
      opened.state.stats,
      { fullness: 60, spirit: 60, energy: 100 },
      `h=${h}: decay-to-floor outcome must be identical regardless of how far past 72h`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Floor semantics: max(current_after_decay, 60); never lowers; CP unchanged;
//    no unrelated field is touched.
// ---------------------------------------------------------------------------

test('GiftGranted floor hammering: exact boundary, above-floor, mixed, and maxed stats', () => {
  const base = {
    ...initialState(),
    hatched: true,
    cp: 15,
    stage: 2,
    actionsToday: 2,
    dayKey: '2026-7-20',
    tuckedIn: true,
    creature: { kind: 'book', isbn: '9780000000002', name: 'Testy' },
    creatureHistory: [{ kind: 'book', isbn: '9781111111111' }]
  };

  const cases = [
    { stats: { fullness: 0, spirit: 0, energy: 37 }, expect: { fullness: 60, spirit: 60, energy: 37 } },
    { stats: { fullness: 59, spirit: 61, energy: 12 }, expect: { fullness: 60, spirit: 61, energy: 12 } },
    { stats: { fullness: 60, spirit: 60, energy: 0 }, expect: { fullness: 60, spirit: 60, energy: 0 } },
    { stats: { fullness: 100, spirit: 100, energy: 100 }, expect: { fullness: 100, spirit: 100, energy: 100 } },
    { stats: { fullness: 61, spirit: 0, energy: 50 }, expect: { fullness: 61, spirit: 60, energy: 50 } }
  ];

  for (const { stats, expect } of cases) {
    const state = { ...base, stats };
    const after = applyEvent(state, giftGranted('flower', at(40)));
    assert.deepEqual(after.stats, expect, `stats for input ${JSON.stringify(stats)}`);
    assert.equal(after.cp, 15, 'CP must be unchanged by the absence gift');
    assert.equal(after.stage, 2, 'stage must be untouched');
    assert.equal(after.actionsToday, 2, 'actionsToday must be untouched');
    assert.equal(after.dayKey, '2026-7-20', 'dayKey must be untouched');
    assert.deepEqual(after.creature, base.creature, 'creature must be untouched');
    assert.deepEqual(after.creatureHistory, base.creatureHistory, 'creatureHistory must be untouched');
    assert.equal(after.tuckedIn, false, 'a return always wakes the creature');
    assert.deepEqual(after.stickers, ['flower']);
  }
});

test('decay must apply before the floor lift, not after (order changes the numeric outcome)', () => {
  // Correct (decay-then-floor): fullness 100 -> -44 over 36h -> clamp 0 -> floor lifts to 60.
  // A buggy floor-then-decay order would instead compute max(100,60)=100 first, then
  // decay -144 -> clamp 0 -- landing at 0, not 60. So the final value of 60 is only
  // reachable if decay runs first; this assertion numerically discriminates the two orders.
  const storage = createFakeStorage();
  hatchAndClose(storage);
  const s0 = openSession(storage, at(0));
  s0.act('feed', at(0)); // Fullness -> 100 (clamped), well above the floor
  const away = openSession(storage, at(36));
  assert.equal(away.state.stats.fullness, 60, 'decay-then-floor is the only order that yields 60 here');

  const kinds = away.openEvents.map((e) => e.type);
  const decayIdx = kinds.indexOf(EventTypes.TimeElapsed);
  const giftIdx = kinds.indexOf(EventTypes.GiftGranted);
  assert.ok(decayIdx !== -1 && giftIdx !== -1 && decayIdx < giftIdx, 'TimeElapsed must be emitted before GiftGranted');
});

test('CP is unchanged by a real multi-day absence, even when day-rollover also fires', () => {
  const storage = createFakeStorage();
  const s0 = hatchAndClose(storage);
  s0.visit(at(0)); // earns 3 CP
  assert.equal(s0.state.cp, 3);

  const later = openSession(storage, at(24 * 5 + 2)); // 5 days + 2h away
  assert.equal(gifts(later.openEvents).length, 1);
  assert.equal(
    later.openEvents.some((e) => e.type === EventTypes.DayRolledOver),
    true,
    'sanity check: this absence does span a calendar-day change'
  );
  assert.equal(later.state.cp, 3, 'CP must be exactly unchanged by the absence, despite the day rollover');
});

// ---------------------------------------------------------------------------
// 5. Sticker selection: next unowned of the 6 content.json types; cycles when all owned.
// ---------------------------------------------------------------------------

test('nextStickerId formula matches content order at every cycle position (0 through 8)', () => {
  const ids = content.stickers.map((s) => s.id);
  for (let n = 0; n <= 8; n += 1) {
    const state = { ...initialState(), stickers: Array(n).fill('placeholder') };
    assert.equal(nextStickerId(state), ids[n % ids.length], `n=${n}`);
  }
});

test('owning all six stickers, then two more absences cycle back through the list (duplicates expected)', () => {
  const storage = createFakeStorage();
  hatchAndClose(storage);

  const gap = 40; // hours; always exceeds the 36h threshold measured from the prior lastSeen
  const rounds = content.stickers.length + 2; // one full cycle, then 2 more to prove the wrap
  let hoursSoFar = 0;
  let last;
  for (let i = 0; i < rounds; i += 1) {
    hoursSoFar += gap;
    last = openSession(storage, at(hoursSoFar));
    assert.equal(gifts(last.openEvents).length, 1, `round ${i}: exactly one gift, never more`);
  }

  const ids = content.stickers.map((s) => s.id);
  const expected = [...ids, ids[0], ids[1]]; // 6 unique, then wraps to index 0, then index 1
  assert.deepEqual(last.state.stickers, expected);
});

test('content.json defines exactly six unique sticker types (sanity check on the gift pool)', () => {
  assert.equal(content.stickers.length, 6);
  assert.equal(new Set(content.stickers.map((s) => s.id)).size, 6, 'sticker ids must be unique');
});

// ---------------------------------------------------------------------------
// The unhatched egg never receives absence gifts, no matter how much time passes.
// ---------------------------------------------------------------------------

test('the unhatched egg never gifts, even across an enormous elapsed duration', () => {
  assert.deepEqual(onOpen(initialState(), at(0), at(1_000_000)), []);
});
