// CareSystem: validates care intents (action definitions, Energy gate) and
// emits CareActionPerformed with whether CP was granted per the daily cap.
// Pure — takes `now` (ms) as a parameter, never reads the clock or DOM.

import content from '../content.json' with { type: 'json' };
import { careActionPerformed, tuckedIn } from '../events.js';

export function actionDef(actionId) {
  return content.care.actions.find((a) => a.id === actionId) ?? null;
}

export function canPerform(state, actionId) {
  if (!state.hatched) return { ok: false, reason: 'notHatched' };
  const def = actionDef(actionId);
  if (!def) return { ok: false, reason: 'unknownAction' };
  if (def.minEnergy != null && state.stats.energy < def.minEnergy) {
    return { ok: false, reason: 'lowEnergy' };
  }
  return { ok: true, def };
}

export function performAction(state, actionId, now) {
  const check = canPerform(state, actionId);
  if (!check.ok) return { ok: false, reason: check.reason, events: [] };
  const cpGranted =
    state.actionsToday < content.care.dailyCpCap ? content.care.cpPerAction : 0;
  return { ok: true, events: [careActionPerformed(actionId, cpGranted, now)] };
}

// Tuck-in ends the visit ceremonially. Purely theatrical: nothing locks,
// and any action (or the next open) wakes the creature.
export function tuckIn(state, now) {
  if (!state.hatched) return { ok: false, reason: 'notHatched', events: [] };
  return { ok: true, events: [tuckedIn(now)] };
}
