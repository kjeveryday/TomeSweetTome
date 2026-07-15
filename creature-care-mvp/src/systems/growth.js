// GrowthSystem: watches authorized CP-changing event chains and emits
// CreatureStateChanged when a threshold is crossed. Returns at most ONE step
// per check, so a big CP jump climbs stages one celebration at a time.

import content from '../content.json' with { type: 'json' };
import { creatureStateChanged } from '../events.js';

const stages = content.species.stages;

export function stageDef(stage) {
  return stages.find((s) => s.stage === stage) ?? stages[0];
}

export function nextStageDef(stage) {
  const index = stages.findIndex((s) => s.stage === stage);
  return index < 0 ? null : stages[index + 1] ?? null;
}

export function checkGrowth(state, now) {
  if (!state.hatched) return [];
  const next = nextStageDef(state.stage);
  if (next && state.cp >= next.cpRequired) {
    return [creatureStateChanged(next.stage, now)];
  }
  return [];
}

const GROWTH_TRIGGER_EVENTS = new Set([
  'CareActionPerformed',
  'ResourceGranted',
  'CreatureStateChanged'
]);

// App integration gate: reading, timer, book, clock, and status events cannot
// cause an unrelated overdue stage change. CreatureStateChanged remains a
// trigger so one large authorized CP grant can advance one stage at a time.
export function checkGrowthAfterEvent(state, event, now) {
  return GROWTH_TRIGGER_EVENTS.has(event?.type) ? checkGrowth(state, now) : [];
}
