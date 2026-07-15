// GrowthSystem: watches CP after each event and emits CreatureStateChanged when
// a threshold is crossed. Returns at most ONE step per check; the app re-checks
// after every event, so a big CP jump climbs stages one celebration at a time.

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
