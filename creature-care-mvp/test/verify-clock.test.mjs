// Independent adversarial verification of the CLOCK invariants (BRIEF.md decision 8,
// edge cases 1-2; PRD v0.3 section 6.6 "preserve... clock... behavior unless a
// separate approved change says otherwise").
//
// Source under test:
//   - src/systems/clock.js: computeElapsedMs (the clamp itself) and onOpen (the
//     session-level contract built on top of it).
//   - src/state.js: the TimeElapsed branch of applyEvent (decay/regen math).
//   - src/systems/persistence.js: save()'s lastSeen-monotonicity contract, which
//     the clock's "no double-drift" guarantee depends on.
//
// This file does not modify any existing source or test. Every `now`/`lastSeen`
// value is either a raw literal or built from helpers.at() -- nothing here reads
// the real clock, per the pure-core contract.
//
// Scope note: backward-clock scenarios below are deliberately kept within a
// single local calendar date. A backward jump that crosses a date boundary also
// touches checkDayRollover/the daily CP cap, which BRIEF.md decision 1 explicitly
// says is NOT hardened against clock-shifting ("casual clock-shifting is
// tolerated by design; this is not anti-cheat"). That is a different invariant
// than the elapsed/drift/lastSeen contract verified here, so it is left alone.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, H, content } from './helpers.mjs';
import { computeElapsedMs } from '../src/systems/clock.js';
import { initialState, applyEvent } from '../src/state.js';
import { EventTypes, timeElapsed } from '../src/events.js';
import { SAVE_KEY, createPersistence } from '../src/systems/persistence.js';

const CAP = content.time.maxElapsedHours * H; // 72h in ms, derived like the source does

function freshHatchedStorage(hatchAt = at(0)) {
  const storage = createFakeStorage();
  const s = openSession(storage, hatchAt);
  s.hatch(hatchAt);
  return storage;
}

// ---------------------------------------------------------------------------
// Invariant: elapsed = clamp(now - lastSeen, 0, 72h) -- the pure function itself.
// ---------------------------------------------------------------------------

test('computeElapsedMs: now == lastSeen is exactly 0, at zero and at large instants', () => {
  assert.equal(computeElapsedMs(0, 0), 0);
  assert.equal(computeElapsedMs(at(50), at(50)), 0);
  assert.equal(computeElapsedMs(1_700_000_000_000, 1_700_000_000_000), 0);
});

test('computeElapsedMs: now < lastSeen (any backward gap) clamps to 0', () => {
  assert.equal(computeElapsedMs(100, 99), 0, 'off by 1ms');
  assert.equal(computeElapsedMs(H * 10, H * 10 - 1), 0, 'off by 1ms at hour scale');
  assert.equal(computeElapsedMs(1000, 0), 0, 'small backward gap');
  assert.equal(computeElapsedMs(Number.MAX_SAFE_INTEGER, 0), 0, 'huge backward gap');
});

test('computeElapsedMs: the 72h boundary is exact -- untouched just under it, allowed at it, clamped just past it', () => {
  assert.equal(computeElapsedMs(0, CAP - 1), CAP - 1, '1ms under the cap passes through untouched');
  assert.equal(computeElapsedMs(0, CAP), CAP, 'exactly the cap is not treated as "over"');
  assert.equal(computeElapsedMs(0, CAP + 1), CAP, '1ms past the cap is clamped');
});

test('computeElapsedMs: very large forward now values clamp to the 72h cap without overflow', () => {
  assert.equal(computeElapsedMs(0, Number.MAX_SAFE_INTEGER), CAP);
  assert.equal(computeElapsedMs(0, 1e15), CAP);
  assert.equal(computeElapsedMs(-1e15, 0), CAP, 'huge negative lastSeen also just clamps to the cap');
  assert.equal(computeElapsedMs(0, -Number.MAX_SAFE_INTEGER), 0, 'sanity: huge backward still clamps to 0, not NaN');
});

test('computeElapsedMs: fractional/partial hours pass through exactly, no rounding', () => {
  assert.equal(computeElapsedMs(0, 1.5 * H), 1.5 * H);
  assert.equal(computeElapsedMs(0, 0.25 * H), 0.25 * H);
  assert.equal(computeElapsedMs(0, 26.75 * H), 26.75 * H);
});

// ---------------------------------------------------------------------------
// Invariant: the TimeElapsed reducer's decay/regen math (src/state.js) --
// Fullness -4/h, Spirit -2/h, Energy +5/h, linear and independently clamped.
// ---------------------------------------------------------------------------

test('TimeElapsed reducer: partial-hour decay/regen is linear and exact', () => {
  const base = { ...initialState(), hatched: true, stats: { fullness: 80, spirit: 80, energy: 50 } };
  const a = applyEvent(base, timeElapsed(1.25 * H, at(0)));
  assert.deepEqual(a.stats, { fullness: 75, spirit: 77.5, energy: 56.25 }, '1.25h: -5 / -2.5 / +6.25');

  const base2 = { ...initialState(), hatched: true, stats: { fullness: 50, spirit: 50, energy: 50 } };
  const b = applyEvent(base2, timeElapsed(0.5 * H, at(0)));
  assert.deepEqual(b.stats, { fullness: 48, spirit: 49, energy: 52.5 }, '0.5h: -2 / -1 / +2.5');
});

test('TimeElapsed reducer: elapsed 0 is a true no-op on stats', () => {
  const base = { ...initialState(), hatched: true, tuckedIn: true, stats: { fullness: 37, spirit: 63, energy: 12 } };
  const after = applyEvent(base, timeElapsed(0, at(0)));
  assert.deepEqual(after.stats, { fullness: 37, spirit: 63, energy: 12 });
  assert.equal(after.tuckedIn, false, 'a visit still wakes the creature even with zero drift');
});

test('TimeElapsed reducer: decay floors at 0 and regen ceilings at 100, per stat, independently', () => {
  // Large elapsed drives fullness/spirit into the floor and energy into the ceiling.
  const low = { ...initialState(), hatched: true, stats: { fullness: 5, spirit: 3, energy: 80 } };
  const driftedLow = applyEvent(low, timeElapsed(10 * H, at(0)));
  assert.deepEqual(driftedLow.stats, { fullness: 0, spirit: 0, energy: 100 });

  // Energy already at the ceiling stays there while fullness/spirit decay cleanly,
  // proving the ceiling clamp on energy doesn't distort or mask the other two.
  const high = { ...initialState(), hatched: true, stats: { fullness: 80, spirit: 80, energy: 100 } };
  const driftedHigh = applyEvent(high, timeElapsed(1 * H, at(0)));
  assert.deepEqual(driftedHigh.stats, { fullness: 76, spirit: 78, energy: 100 });
});

// ---------------------------------------------------------------------------
// Invariant, session level: onOpen's contract for elapsed 0, backward, and the
// 72h cap, exercised through the real save/load/onOpen path (not just the pure
// function in isolation).
// ---------------------------------------------------------------------------

test('onOpen: now == lastSeen (equal, not backward) emits nothing and drifts nothing', () => {
  const storage = freshHatchedStorage(at(0));
  const reopened = openSession(storage, at(0));
  assert.deepEqual(reopened.openEvents, []);
  assert.deepEqual(reopened.state.stats, { fullness: 80, spirit: 80, energy: 100 });
});

test('onOpen: backward clock (1ms, 3h, 16h) never emits an event and never touches the save, repeatedly', () => {
  const storage = freshHatchedStorage(at(0));
  const savedRaw = storage.getItem(SAVE_KEY);
  for (const now of [at(0) - 1, at(-3), at(-16)]) {
    const reopened = openSession(storage, now);
    assert.deepEqual(reopened.openEvents, [], `now=${now}`);
    assert.deepEqual(reopened.state.stats, { fullness: 80, spirit: 80, energy: 100 }, `now=${now}`);
    assert.equal(storage.getItem(SAVE_KEY), savedRaw, `save untouched at now=${now}`);
  }
});

test('onOpen: 72h, 72h+1ms, and a huge forward jump all drift by EXACTLY 72h -- never more', () => {
  for (const now of [at(72), at(72) + 1, at(1_000_000)]) {
    const storage = freshHatchedStorage(at(0));
    const session = openSession(storage, now);
    const drift = session.openEvents.find((e) => e.type === EventTypes.TimeElapsed);
    assert.ok(drift, `expected a TimeElapsed event at now=${now}`);
    assert.equal(drift.elapsedMs, CAP, `now=${now} must clamp to exactly 72h`);
  }
});

test('onOpen: two backward excursions (with actions performed during each) cause no double-drift on the real forward return', () => {
  const storage = freshHatchedStorage(at(0)); // F80 S80 E100, lastSeen = at(0)

  const back1 = openSession(storage, at(-3)); // Tue 2pm, same local date as at(0)
  assert.deepEqual(back1.openEvents, []);
  assert.deepEqual(back1.state.stats, { fullness: 80, spirit: 80, energy: 100 });
  back1.act('feed', at(-3)); // fullness 80+45 -> clamp 100
  assert.equal(createPersistence(storage).load().lastSeen, at(0), 'acting in the past does not move lastSeen back');

  const back2 = openSession(storage, at(-7)); // Tue 10am, even further back
  assert.deepEqual(back2.openEvents, []);
  assert.deepEqual(back2.state.stats, { fullness: 100, spirit: 80, energy: 100 });
  back2.act('tidy', at(-7)); // spirit 80+20 -> 100
  assert.equal(
    createPersistence(storage).load().lastSeen,
    at(0),
    'a second, deeper backward action still does not move lastSeen back'
  );

  const forward = openSession(storage, at(2)); // Tue 7pm: the clock's real return, 2h after the TRUE lastSeen
  const drift = forward.openEvents.find((e) => e.type === EventTypes.TimeElapsed);
  assert.ok(drift);
  assert.equal(drift.elapsedMs, 2 * H, 'drift is measured from the true lastSeen, not inflated by the backward hops');
  assert.deepEqual(
    forward.state.stats,
    { fullness: 92, spirit: 96, energy: 100 },
    '2h of real decay: -8 fullness / -4 spirit; energy already at its ceiling'
  );
  assert.equal(createPersistence(storage).load().lastSeen, at(2), 'lastSeen now correctly advances to the true forward time');
});

// ---------------------------------------------------------------------------
// Invariant: lastSeen never moves backward -- isolated persistence-layer proof,
// independent of any game state, across arbitrary forward/backward/equal saves
// and independent reloads (simulating separate app launches).
// ---------------------------------------------------------------------------

test('persistence: lastSeen is monotonic (max) across forward, backward, and equal saves, surviving independent reloads', () => {
  const storage = createFakeStorage();
  // State content is irrelevant to this test (only lastSeen is asserted), but it must
  // be a valid GameState: load() now rejects foreign/corrupt state shapes as null.
  const s = initialState();

  const p1 = createPersistence(storage);
  p1.save(s, 100);
  assert.equal(createPersistence(storage).load().lastSeen, 100);

  const p2 = createPersistence(storage);
  p2.load();
  p2.save(s, 40); // backward attempt
  assert.equal(createPersistence(storage).load().lastSeen, 100, 'backward save is a no-op on lastSeen');

  const p3 = createPersistence(storage);
  p3.load();
  p3.save(s, 100); // exactly equal
  assert.equal(createPersistence(storage).load().lastSeen, 100, 'equal save is a no-op');

  const p4 = createPersistence(storage);
  p4.load();
  p4.save(s, 250); // genuine forward save
  assert.equal(createPersistence(storage).load().lastSeen, 250);

  const p5 = createPersistence(storage);
  p5.load();
  p5.save(s, 10); // backward again, much smaller
  assert.equal(createPersistence(storage).load().lastSeen, 250, 'still 250 -- a much-smaller backward save cannot regress it');
});

// ---------------------------------------------------------------------------
// Invariant: Energy regenerates 5/h only while CLOSED (i.e. only via onOpen's
// TimeElapsed). In-session actions, no matter how much simulated time passes
// between them, must never regenerate Energy -- there is no passive-time
// mechanism at all except onOpen.
// ---------------------------------------------------------------------------

test('in-session vs. closed-and-reopened: an identical 1h gap produces very different outcomes', () => {
  // Path A: the app stays open the whole time -- one session, a later action.
  const storageA = createFakeStorage();
  const a = openSession(storageA, at(0));
  a.hatch(at(0));
  a.act('play', at(0)); // F80 S100(clamped) E90
  a.act('tidy', at(1)); // 1h later, SAME session -- tidy only touches spirit
  assert.deepEqual(
    a.state.stats,
    { fullness: 80, spirit: 100, energy: 90 },
    'no passive drift or regen while the app never closed'
  );
  assert.equal(a.log.some((e) => e.type === EventTypes.TimeElapsed), false, 'act() never emits TimeElapsed');

  // Path B: the app closes and reopens after the SAME 1h gap.
  const storageB = createFakeStorage();
  const b0 = openSession(storageB, at(0));
  b0.hatch(at(0));
  b0.act('play', at(0)); // F80 S100 E90 -- same starting point as path A
  const b1 = openSession(storageB, at(1)); // a genuine relaunch, 1h later
  const drift = b1.openEvents.find((e) => e.type === EventTypes.TimeElapsed);
  assert.ok(drift, 'reopening after a real gap does drift');
  assert.equal(drift.elapsedMs, 1 * H);
  assert.deepEqual(
    b1.state.stats,
    { fullness: 76, spirit: 98, energy: 95 },
    '1h of REAL closed time: -4 fullness / -2 spirit / +5 energy, all unclamped and visible'
  );
});

test('in-session: Energy (and every stat) is inert to simulated time no matter how large the gap between actions', () => {
  const storage = createFakeStorage();
  const s = openSession(storage, at(0));
  s.hatch(at(0));
  s.act('play', at(0)); // F80 S100 E90
  s.act('tidy', at(500)); // ~20.8 days later, but the SAME session object -- never reopened
  assert.deepEqual(
    s.state.stats,
    { fullness: 80, spirit: 100, energy: 90 },
    'tidy only touches spirit; no passive decay or regen occurred despite 500 simulated hours'
  );
  assert.equal(s.log.some((e) => e.type === EventTypes.TimeElapsed), false);
});
