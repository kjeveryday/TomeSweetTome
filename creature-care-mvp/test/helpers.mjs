// Shared test harness: mirrors app.js wiring (open -> clock -> events -> render)
// against a fake localStorage. Pure module, safe if the runner executes it directly.

import content from '../src/content.json' with { type: 'json' };
import { initialState, applyEvent } from '../src/state.js';
import { hatched, resourceGranted } from '../src/events.js';
import * as clock from '../src/systems/clock.js';
import * as care from '../src/systems/care.js';
import * as growth from '../src/systems/growth.js';
import { createPersistence } from '../src/systems/persistence.js';

export { content };

export const H = content.time.msPerHour;
// Local Tuesday 5:00pm (worked-example anchor). Built from local date parts so
// day-boundary logic behaves identically in any timezone.
export const T0 = new Date(2026, 6, 14, 17, 0, 0, 0).getTime();
export const at = (hours) => T0 + hours * H;

export function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); }
  };
}

// One app session. Creating a session == opening the app at `now`.
// Dropping it == killing the app (state lives only in `storage`).
export function openSession(storage, now) {
  const persistence = createPersistence(storage);
  const log = [];
  const openEvents = [];
  let state = initialState();

  function commit(event) {
    state = applyEvent(state, event);
    persistence.save(state, event.at);
    log.push(event);
    for (const grown of growth.checkGrowthAfterEvent(state, event, event.at)) commit(grown);
  }

  const saved = persistence.load();
  if (saved) {
    state = saved.state;
    for (const e of clock.onOpen(state, saved.lastSeen, now)) {
      openEvents.push(e);
      commit(e);
    }
  }

  function act(actionId, nowAt = now) {
    const rollover = clock.checkDayRollover(state, nowAt);
    if (rollover) commit(rollover);
    const result = care.performAction(state, actionId, nowAt);
    if (result.ok) for (const e of result.events) commit(e);
    return result;
  }

  function visit(nowAt = now) {
    for (const action of content.care.actions) act(action.id, nowAt);
  }

  function tuck(nowAt = now) {
    const result = care.tuckIn(state, nowAt);
    if (result.ok) for (const e of result.events) commit(e);
    return result;
  }

  return {
    get state() { return state; },
    log,
    openEvents,
    commit,
    hatch: (nowAt = now) => commit(hatched(nowAt)),
    act,
    visit,
    tuck,
    grant: (cp, nowAt = now) => commit(resourceGranted(cp, nowAt))
  };
}
