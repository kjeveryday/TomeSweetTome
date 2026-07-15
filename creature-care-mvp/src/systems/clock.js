// ClockSystem: computes elapsed time on app open and emits TimeElapsed (drift)
// and DayRolledOver. Pure — `now` and `lastSeen` arrive as parameters; this module
// never reads the real clock. The debug clock lives in app.js only.

import content from '../content.json' with { type: 'json' };
import { dayKeyOf } from '../state.js';
import { timeElapsed, dayRolledOver, giftGranted } from '../events.js';

// elapsed = clamp(now - lastSeen, 0, 72h): a backward device clock yields 0
// (nothing changes), a forward jump beyond the cap is treated as the cap.
export function computeElapsedMs(lastSeen, now) {
  const cap = content.time.maxElapsedHours * content.time.msPerHour;
  return Math.min(cap, Math.max(0, now - lastSeen));
}

// The daily CP cap resets when the local calendar date changes. Emitted lazily:
// app.js calls this on open (via onOpen) and before every action.
export function checkDayRollover(state, now) {
  if (!state.hatched) return null;
  const key = dayKeyOf(now);
  return state.dayKey === key ? null : dayRolledOver(key, now);
}

// Gifts pick the next unowned sticker in content order; once all are owned the
// cycle repeats. (Owned count modulo list length IS the next-unowned pointer,
// because grants always happen in this order.)
export function nextStickerId(state) {
  const list = content.stickers;
  return list[state.stickers.length % list.length].id;
}

export function onOpen(state, lastSeen, now) {
  if (!state.hatched) return []; // the egg waits patiently — no drift, ever
  const events = [];
  const elapsedMs = computeElapsedMs(lastSeen, now);
  if (elapsedMs > 0) events.push(timeElapsed(elapsedMs, now));
  const rollover = checkDayRollover(state, now);
  if (rollover) events.push(rollover);
  // Absence >= 36h: wake-up scene with exactly one gift per return — emitted
  // once per open, so repeated or longer absences can never stack gifts.
  if (elapsedMs >= content.absence.thresholdHours * content.time.msPerHour) {
    events.push(giftGranted(nextStickerId(state), now));
  }
  return events;
}
