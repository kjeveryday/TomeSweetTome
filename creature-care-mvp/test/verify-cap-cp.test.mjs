// INDEPENDENT verification: daily care-action cap and CP/growth invariants.
//
// Written by a reviewer who did not author src/systems/care.js, growth.js, or
// state.js. Adversarial stance: every test below tries to break an invariant
// from BRIEF.md decisions 1, 2, 3, 5, 7, 10, the "Care rules" section, and the
// PRD's "Daily care-action cap ... Preserve" line. Assume a bug exists until
// the source proves otherwise.
//
// Two genuine defects were found. The tests documenting them are LEFT FAILING
// on purpose (search "DEFECT") — a failing test here means "here is a
// reproducible bug", not "this test is wrong". See the review report for the
// full write-up; the short version:
//   1. ResourceGranted's reducer case never checks `state.hatched`, so CP
//      granted before a creature hatches still accumulates, and growth is
//      checked (and can fire) immediately after the Hatched event — a
//      creature can hatch already past Stage 1 having performed zero care
//      actions.
//   2. ResourceGranted sanitizes negative amounts (Math.max(0, cp)) but not
//      non-finite ones: a NaN (or any non-numeric) grant makes state.cp
//      itself NaN, permanently — every future `cp >= threshold` growth check
//      is then false forever, even after further perfectly valid grants.
//
// This file does not modify any existing source or test file.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSession, createFakeStorage, at, H, content } from './helpers.mjs';
import { applyEvent, initialState, dayKeyOf, moodOf } from '../src/state.js';
import {
  EventTypes,
  timeElapsed,
  dayRolledOver,
  giftGranted,
  tuckedIn,
  creatureStateChanged,
  resourceGranted,
  careActionPerformed
} from '../src/events.js';
import * as growth from '../src/systems/growth.js';

// ---------------------------------------------------------------------------
// 0. Content-conformance guard: pin the exact numbers the rest of this file
// (and the spec) assumes, so a silent content.json retune fails loudly here
// instead of producing confusing failures below.
// ---------------------------------------------------------------------------

test('content.json tuning matches the spec this review is checking against', () => {
  assert.equal(content.care.dailyCpCap, 3, 'first N actions grant CP');
  assert.equal(content.care.cpPerAction, 1);

  const feed = content.care.actions.find((a) => a.id === 'feed');
  const play = content.care.actions.find((a) => a.id === 'play');
  const tidy = content.care.actions.find((a) => a.id === 'tidy');
  assert.equal(feed.effects.fullness, 45);
  assert.equal(play.effects.spirit, 25);
  assert.equal(play.effects.energy, -10);
  assert.equal(play.minEnergy, 10);
  assert.equal(tidy.effects.spirit, 20);

  const stage2 = content.species.stages.find((s) => s.stage === 2);
  const stage3 = content.species.stages.find((s) => s.stage === 3);
  assert.equal(stage2.cpRequired, 12);
  assert.equal(stage3.cpRequired, 30);

  assert.equal(content.mood.beamingMin, 70);
  assert.equal(content.mood.contentMin, 40);
});

// ---------------------------------------------------------------------------
// 1. The daily cap: first 3 actions grant CP, extras grant 0 but still
// animate and affect stats.
// ---------------------------------------------------------------------------

test('daily cap with a single repeated action: first 3 Plays grant 1 CP each, the 4th grants 0 but Energy still drops', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0)); // E100

  s.act('play', at(0));
  assert.deepEqual([s.state.cp, s.state.actionsToday, s.state.stats.energy], [1, 1, 90]);
  s.act('play', at(0));
  assert.deepEqual([s.state.cp, s.state.actionsToday, s.state.stats.energy], [2, 2, 80]);
  s.act('play', at(0));
  assert.deepEqual([s.state.cp, s.state.actionsToday, s.state.stats.energy], [3, 3, 70]);

  const r = s.act('play', at(0)); // 4th action
  assert.equal(r.ok, true, 'the 4th action still succeeds');
  assert.deepEqual(
    [s.state.cp, s.state.actionsToday, s.state.stats.energy],
    [3, 4, 60],
    'CP frozen at 3, but the action still fully applied'
  );

  const grants = s.log
    .filter((e) => e.type === EventTypes.CareActionPerformed)
    .map((e) => e.cpGranted);
  assert.deepEqual(grants, [1, 1, 1, 0]);
});

test('daily cap counts occurrences, not action variety: a 4th action of any type still grants 0 CP', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0)); // F80 S80 E100
  s.act('feed', at(0)); // 80+45 -> clamp 100
  s.act('play', at(0)); // 80+25 -> clamp 100, E 90
  s.act('tidy', at(0)); // 100+20 -> stays 100 (already at ceiling)
  assert.deepEqual(s.state.stats, { fullness: 100, spirit: 100, energy: 90 });
  assert.equal(s.state.cp, 3);
  assert.equal(s.state.actionsToday, 3);

  const r = s.act('play', at(0)); // a 4th action, a type already used once this day
  assert.equal(r.ok, true);
  assert.deepEqual(s.state.stats, { fullness: 100, spirit: 100, energy: 80 });
  assert.equal(s.state.cp, 3, 'the cap does not care which action types were used, only the count');
  assert.equal(s.state.actionsToday, 4);
});

test('the daily cap and the Energy gate are independent: 0-CP actions still drain Energy and are still gated at <10', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0)); // E100
  s.act('feed', at(0)); // cp1, Energy untouched
  s.act('tidy', at(0)); // cp2, Energy untouched
  s.act('feed', at(0)); // cp3: cap now exhausted, still without touching Energy
  assert.equal(s.state.cp, 3);
  assert.equal(s.state.actionsToday, 3);
  assert.equal(s.state.stats.energy, 100, 'feed/tidy never touch Energy');

  // 10 more Plays, all 0-CP (cap exhausted), each still legitimately gated and
  // still draining Energy by -10 apiece, down to exactly 0.
  for (let i = 1; i <= 10; i += 1) {
    const before = s.state.stats.energy;
    const r = s.act('play', at(0));
    assert.equal(r.ok, true, `play #${i} should be allowed (Energy was ${before})`);
    assert.equal(s.state.stats.energy, before - 10);
    assert.equal(s.state.cp, 3, 'still 0-CP: the cap stays exhausted');
  }
  assert.equal(s.state.stats.energy, 0);
  assert.equal(s.state.actionsToday, 13);

  // The 11th Play must be blocked, and a blocked attempt must be a true no-op.
  const blocked = s.act('play', at(0));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'lowEnergy');
  assert.equal(s.state.stats.energy, 0, 'a blocked attempt changes nothing');
  assert.equal(s.state.actionsToday, 13, 'a blocked attempt does not consume a cap slot');
  assert.equal(s.state.cp, 3);
});

// ---------------------------------------------------------------------------
// 2. The day boundary is the LOCAL calendar date. All timestamps below are
// built from local Date(year, month, day, hour, ...) parts (like helpers.mjs's
// T0), never raw UTC millisecond literals, so this file's pass/fail is
// identical regardless of the machine's timezone.
// ---------------------------------------------------------------------------

test('the daily cap resets at the exact local-midnight instant, not a moment before', () => {
  const s = openSession(createFakeStorage(), at(0)); // Tue Jul 14 2026, 5pm local
  s.hatch(at(0));
  s.visit(at(0)); // feed, play, tidy -> F100 S100 E90, cp3, actionsToday3
  assert.equal(s.state.cp, 3);

  // 1ms before local midnight: still "today" -> cap stays exhausted, but the
  // action still fully applies.
  const justBefore = at(7) - 1; // 5pm + 7h - 1ms = Jul 14 23:59:59.999 local
  assert.equal(dayKeyOf(justBefore), s.state.dayKey, 'still the same calendar date');
  const r1 = s.act('play', justBefore);
  assert.equal(r1.ok, true);
  assert.equal(s.state.cp, 3, '0 CP: still the same day, cap still exhausted');
  assert.equal(s.state.stats.energy, 80, 'but the action still applied (90 -> 80)');
  assert.equal(s.state.actionsToday, 4);

  // Exactly at local midnight: a new calendar date -> the cap refreshes.
  const atMidnight = at(7);
  assert.notEqual(dayKeyOf(atMidnight), dayKeyOf(justBefore), 'crossed into a new calendar date');
  const r2 = s.act('play', atMidnight);
  assert.equal(r2.ok, true);
  assert.equal(s.state.cp, 4, 'first action of the new date grants CP again');
  assert.equal(s.state.stats.energy, 70);
  assert.equal(s.state.actionsToday, 1, 'actionsToday reset by the lazy DayRolledOver, then incremented once');
  assert.equal(s.state.dayKey, dayKeyOf(atMidnight));
});

test('the calendar-day rollover correctly crosses a month boundary (Jan 31 -> Feb 1)', () => {
  const janAnchor = new Date(2026, 0, 31, 23, 0, 0, 0).getTime(); // Jan 31 2026, 11pm local
  const s = openSession(createFakeStorage(), janAnchor);
  s.hatch(janAnchor);
  s.visit(janAnchor); // cp3, actionsToday3
  assert.equal(s.state.dayKey, dayKeyOf(janAnchor)); // "2026-1-31"

  const twoHoursLater = janAnchor + 2 * H; // Feb 1 2026, 1am local
  assert.notEqual(dayKeyOf(twoHoursLater), dayKeyOf(janAnchor));
  s.act('feed', twoHoursLater);
  assert.equal(s.state.cp, 4, 'new month, new date -> cap refreshed');
  assert.equal(s.state.actionsToday, 1);
  assert.equal(s.state.dayKey, dayKeyOf(twoHoursLater)); // "2026-2-1"
});

test('the calendar-day rollover correctly crosses a year boundary (Dec 31 -> Jan 1)', () => {
  const decAnchor = new Date(2026, 11, 31, 23, 0, 0, 0).getTime(); // Dec 31 2026, 11pm local
  const s = openSession(createFakeStorage(), decAnchor);
  s.hatch(decAnchor);
  s.visit(decAnchor); // cp3, actionsToday3
  assert.equal(s.state.dayKey, dayKeyOf(decAnchor)); // "2026-12-31"

  const twoHoursLater = decAnchor + 2 * H; // Jan 1 2027, 1am local
  assert.notEqual(dayKeyOf(twoHoursLater), dayKeyOf(decAnchor));
  s.act('feed', twoHoursLater);
  assert.equal(s.state.cp, 4, 'new year, new date -> cap refreshed');
  assert.equal(s.state.actionsToday, 1);
  assert.equal(s.state.dayKey, dayKeyOf(twoHoursLater)); // "2027-1-1"
});

test('reopening the app on a new calendar date resets the cap via onOpen, not just the mid-session act() path', () => {
  const storage = createFakeStorage();
  const s0 = openSession(storage, at(0));
  s0.hatch(at(0));
  s0.visit(at(0)); // cp3, actionsToday3
  assert.equal(s0.state.cp, 3);

  const reopened = openSession(storage, at(24)); // next day, well under the 36h absence threshold
  assert.deepEqual(
    reopened.openEvents.map((e) => e.type),
    [EventTypes.TimeElapsed, EventTypes.DayRolledOver],
    'no absence gift at only 24h away; drift then rollover, in that order'
  );
  assert.equal(reopened.state.actionsToday, 0);
  assert.equal(reopened.state.cp, 3, 'CP itself is untouched by the rollover');
  const r = reopened.act('feed', at(24));
  assert.equal(r.ok, true);
  assert.equal(reopened.state.cp, 4);
});

test('reopening the app again on the SAME calendar date never rolls over or refreshes the cap', () => {
  const storage = createFakeStorage();
  const s0 = openSession(storage, at(0));
  s0.hatch(at(0));
  s0.visit(at(0)); // cp3, actionsToday3

  const reopenA = openSession(storage, at(1)); // 1 hour later, same date
  assert.equal(reopenA.openEvents.some((e) => e.type === EventTypes.DayRolledOver), false);
  assert.equal(reopenA.state.actionsToday, 3);

  const reopenB = openSession(storage, at(2)); // 2 hours later, still the same date
  assert.equal(reopenB.openEvents.some((e) => e.type === EventTypes.DayRolledOver), false);
  const r = reopenB.act('feed', at(2));
  assert.equal(r.ok, true);
  assert.equal(reopenB.state.cp, 3, 'still the same day: the cap is still exhausted');
  assert.equal(reopenB.state.actionsToday, 4);
});

// ---------------------------------------------------------------------------
// 3. ResourceGranted bypasses the daily cap in both directions: it still
// grants CP once the cap is exhausted, and it never consumes or unlocks any
// of the day's 3 CP-eligible action slots.
// ---------------------------------------------------------------------------

test('ResourceGranted still adds CP once the daily cap is exhausted, and never touches actionsToday', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.visit(at(0)); // cp3, actionsToday3: cap exhausted
  s.act('feed', at(0)); // a 4th, 0-CP action
  assert.equal(s.state.cp, 3);
  assert.equal(s.state.actionsToday, 4);

  s.grant(5, at(0));
  assert.equal(s.state.cp, 8, 'bonus CP applies even though the cap is fully exhausted');
  assert.equal(s.state.actionsToday, 4, 'ResourceGranted must never touch actionsToday');
});

test("ResourceGranted before any care action today does not consume or block the day's 3 CP-eligible action slots", () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.grant(5, at(0));
  assert.equal(s.state.cp, 5);
  assert.equal(s.state.actionsToday, 0, 'a grant is not an action');

  s.act('feed', at(0));
  assert.equal(s.state.cp, 6, '1st action of the day still grants CP');
  s.act('play', at(0));
  assert.equal(s.state.cp, 7, '2nd action of the day still grants CP');
  s.act('tidy', at(0));
  assert.equal(s.state.cp, 8, '3rd action of the day still grants CP');
  s.act('feed', at(0));
  assert.equal(s.state.cp, 8, '4th action of the day grants 0, exactly as if no grant had happened');
});

// ---------------------------------------------------------------------------
// 4. CP is monotonic: never decays, and nothing but CareActionPerformed /
// ResourceGranted ever touches it.
// ---------------------------------------------------------------------------

test('CP is untouched by every event type except CareActionPerformed and ResourceGranted', () => {
  const base = {
    ...initialState(),
    hatched: true,
    cp: 7,
    actionsToday: 2,
    dayKey: '2026-1-1',
    stats: { fullness: 50, spirit: 50, energy: 50 }
  };

  assert.equal(applyEvent(base, timeElapsed(H, at(0))).cp, 7, 'TimeElapsed must not touch CP');

  const rolled = applyEvent(base, dayRolledOver('2026-1-2', at(0)));
  assert.equal(rolled.cp, 7, 'DayRolledOver must not touch CP');
  assert.equal(rolled.actionsToday, 0, '(it still resets the action counter, as expected)');

  assert.equal(applyEvent(base, giftGranted('star', at(0))).cp, 7, 'GiftGranted must not touch CP');
  assert.equal(applyEvent(base, tuckedIn(at(0))).cp, 7, 'TuckedIn must not touch CP');

  const grown = applyEvent(base, creatureStateChanged(2, at(0)));
  assert.equal(grown.cp, 7, 'CreatureStateChanged must not touch CP');
  assert.equal(grown.stage, 2, '(it still changes stage, as expected)');
});

test('a negative ResourceGranted is ignored without disturbing a later, valid grant', () => {
  const base = { ...initialState(), hatched: true, cp: 5 };
  const afterNegative = applyEvent(base, resourceGranted(-100, at(0)));
  assert.equal(afterNegative.cp, 5, 'negative grants never lower CP');
  const afterFollowUp = applyEvent(afterNegative, resourceGranted(3, at(1)));
  assert.equal(afterFollowUp.cp, 8, 'a later valid grant still applies normally');
});

// ---------------------------------------------------------------------------
// 5. Growth: Stage 2 at exactly 12 CP, Stage 3 at exactly 30 CP.
// ---------------------------------------------------------------------------

test('growth fires exactly once at CP=12 and exactly once at CP=30, via plain 1-CP increments', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  const fires = [];
  for (let i = 1; i <= 30; i += 1) {
    const before = s.state.stage;
    s.grant(1, at(0));
    if (s.state.stage !== before) fires.push({ atCp: s.state.cp, stage: s.state.stage });
  }
  assert.deepEqual(fires, [{ atCp: 12, stage: 2 }, { atCp: 30, stage: 3 }]);
  assert.equal(s.state.cp, 30);
});

test('a capped CareActionPerformed (not only ResourceGranted) can itself cross a growth threshold', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.hatch(at(0));
  s.grant(11, at(0));
  assert.equal(s.state.cp, 11);
  assert.equal(s.state.stage, 1);

  s.act('feed', at(0)); // the day's 1st action: +1 CP -> exactly 12
  assert.equal(s.state.cp, 12);
  assert.equal(s.state.stage, 2);

  const tail = s.log.slice(-2).map((e) => e.type);
  assert.deepEqual(tail, [EventTypes.CareActionPerformed, EventTypes.CreatureStateChanged]);
});

test('growth.checkGrowth returns at most one stage step per call, and nothing once CP is fully accounted for', () => {
  let state = { ...initialState(), hatched: true, stage: 1, cp: 40 }; // enough for stage 2 AND 3 at once
  const step1 = growth.checkGrowth(state, at(0));
  assert.equal(step1.length, 1, 'only one step, even though cp=40 satisfies both thresholds');
  assert.equal(step1[0].stage, 2);
  state = applyEvent(state, step1[0]);

  const step2 = growth.checkGrowth(state, at(0));
  assert.equal(step2.length, 1);
  assert.equal(step2[0].stage, 3);
  state = applyEvent(state, step2[0]);

  assert.deepEqual(growth.checkGrowth(state, at(0)), [], 'nothing left to climb');
  assert.deepEqual(growth.checkGrowth(state, at(5)), [], 'calling it again (different `now`) changes nothing either');
});

// ---------------------------------------------------------------------------
// 6. Decision 2: Beaming (both stats >=70) is reachable only via extra,
// 0-CP actions.
// ---------------------------------------------------------------------------

test('an extra 0-CP action can push mood from Content to Beaming without granting additional CP (decision 2)', () => {
  const storage = createFakeStorage();
  let s = openSession(storage, at(0));
  s.hatch(at(0));
  s.visit(at(0)); // F100 S100 E90, cp3

  s = openSession(storage, at(24)); // next day: decays to F4 S52 E100
  s.visit(at(24)); // F49 S97 E90, cp6
  assert.equal(s.state.cp, 6);
  assert.equal(moodOf(s.state), 'content', 'a standard capped visit lands on Content, not Beaming');

  s.act('feed', at(24)); // a 4th, 0-CP action
  assert.equal(s.state.cp, 6, 'still 0 additional CP');
  assert.deepEqual(s.state.stats, { fullness: 94, spirit: 97, energy: 90 });
  assert.equal(moodOf(s.state), 'beaming', 'extra care beyond the requirement makes the creature beam');
});

// ---------------------------------------------------------------------------
// 7. DEFECTS found by adversarial testing. Left failing on purpose.
// ---------------------------------------------------------------------------

// Fixed 2026-07-15 (verification pass): ResourceGranted now no-ops while the creature
// is unhatched, so a pre-hatch grant is dropped rather than banked on the egg. The four
// tests below originally documented the defects; they now assert the fixed behavior and
// stand as regression coverage.
test('regression: ResourceGranted before hatching is dropped, so the creature still hatches at Stage 1', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.grant(15, at(0)); // an external CP hook firing before the player ever hatches the egg
  assert.equal(s.state.hatched, false);
  assert.equal(s.state.cp, 0, 'a grant fired before hatching is dropped, not banked on the still-unhatched egg');

  s.hatch(at(0));
  // A freshly-hatched creature presents as Stage 1 (Hatchling): growth reflects CP earned
  // through post-hatch care (BRIEF: "Stage 2 at 12 CP"). Because the ResourceGranted
  // reducer now no-ops while unhatched (matching care/clock/growth), no CP can pile up on
  // the egg and satisfy a threshold the instant it hatches.
  assert.equal(s.state.stage, 1, 'a creature should not hatch already past Stage 1');
});

test('regression: a pre-hatch grant at exactly the CP=12 threshold is also dropped, not banked', () => {
  const s = openSession(createFakeStorage(), at(0));
  s.grant(12, at(0)); // exactly the Stage 2 threshold, granted pre-hatch
  s.hatch(at(0));
  assert.equal(s.state.cp, 0, 'the pre-hatch grant was dropped');
  assert.equal(s.state.stage, 1, 'a creature should not hatch already past Stage 1');
});

test('regression: a non-finite (NaN) ResourceGranted amount is ignored, not written to CP', () => {
  const base = { ...initialState(), hatched: true, cp: 7 };
  const after = applyEvent(base, resourceGranted(NaN, at(0)));
  // By the same "CP is monotonic" logic that sanitizes negative grants (Math.max(0, ·)),
  // a non-finite grant is a no-op. (Previously Math.max(0, NaN) = NaN corrupted cp.)
  assert.equal(after.cp, 7, 'a non-finite grant must be ignored, like a negative grant');
});

test('regression: a valid grant after a (now-ignored) non-finite grant still produces a sane, increasing CP', () => {
  const base = { ...initialState(), hatched: true, cp: 7 };
  const ignored = applyEvent(base, resourceGranted(NaN, at(0)));
  const after = applyEvent(ignored, resourceGranted(5, at(1)));
  // The NaN grant is a no-op (cp stays 7), so the later valid grant brings it to 12 — CP
  // stays a sane, monotonically increasing number and stage-threshold checks keep working.
  // (Previously NaN poisoned cp permanently: NaN + 5 = NaN forever, freezing all growth.)
  assert.equal(after.cp, 12, 'CP must stay a sane, monotonically increasing number');
});

// ---------------------------------------------------------------------------
// 8. Architecture note (expected to PASS — not a defect, just documenting a
// trust boundary this review relied on while writing the tests above).
// ---------------------------------------------------------------------------

test('architecture note: applyEvent trusts CareActionPerformed.cpGranted at face value — the cap is enforced only by care.performAction', () => {
  const base = { ...initialState(), hatched: true, actionsToday: 5, cp: 3 }; // already well over the cap
  const after = applyEvent(base, careActionPerformed('feed', 1, at(0)));
  assert.equal(
    after.cp,
    4,
    'the reducer applies whatever cpGranted the event carries; it does not re-derive or re-check the cap itself'
  );
});

// ---------------------------------------------------------------------------
// 9. Capstone: a longer, semi-chaotic multi-day sequence mixing actions,
// grants (including a negative one) and rollovers, replayed independently.
// ---------------------------------------------------------------------------

test('capstone: a multi-day mix of actions, grants (including a negative one), and rollovers stays CP-monotonic end to end', () => {
  const storage = createFakeStorage();
  const fullLog = [];

  let s = openSession(storage, at(0));
  s.hatch(at(0));
  s.act('feed', at(0));
  s.act('play', at(0));
  s.act('tidy', at(0)); // cp3, actionsToday3
  s.act('feed', at(0)); // 4th, 0cp
  s.grant(2, at(0)); // cp5
  fullLog.push(...s.log);
  assert.equal(s.state.cp, 5);

  s = openSession(storage, at(24));
  s.act('play', at(24)); // rollover, then 1st action of the day
  s.act('tidy', at(24)); // 2nd action of the day: cp7
  s.grant(-100, at(24)); // ignored
  s.act('feed', at(24)); // 3rd of the day: cp8
  s.act('feed', at(24)); // 4th of the day: 0cp
  fullLog.push(...s.log);
  assert.equal(s.state.cp, 8);
  assert.equal(s.state.stage, 1);

  s = openSession(storage, at(48));
  s.grant(4, at(48)); // cp8 -> 12 exactly: Stage 2
  s.act('feed', at(48)); // rollover already refreshed the cap: cp13
  fullLog.push(...s.log);

  assert.equal(s.state.cp, 13);
  assert.equal(s.state.actionsToday, 1);
  assert.equal(s.state.stage, 2);

  // Independent replay (written from scratch for this review — not reusing
  // any other reviewer's helper): CP must never decrease at any single step
  // across the whole log, and the replayed total must match live state.
  let replayed = 0;
  for (const e of fullLog) {
    const before = replayed;
    if (e.type === EventTypes.CareActionPerformed) replayed += e.cpGranted;
    if (e.type === EventTypes.ResourceGranted) replayed += Math.max(0, e.cp);
    assert.ok(replayed >= before, `CP must never decrease (at event ${e.type})`);
  }
  assert.equal(replayed, s.state.cp, 'the replayed total matches the live state exactly');
});
