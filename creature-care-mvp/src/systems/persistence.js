// Persistence: serializes { state, lastSeen } synchronously after every event.
// The storage adapter is injected (window.localStorage in app.js, a fake in tests),
// so this module stays DOM-free. `lastSeen` never moves backward: we always store
// max(previous lastSeen, now), so a backward device clock causes no double-drift.

import content from '../content.json' with { type: 'json' };

export const SAVE_KEY = 'creatureCare.save.v1';

const REQUIRED_STATS = ['fullness', 'spirit', 'energy'];
const VALID_STAGES = new Set(content.species.stages.map(({ stage }) => stage));

function isValidTimestamp(value) {
  return Number.isFinite(value) && value >= 0;
}

function isValidStat(value) {
  return Number.isFinite(value) && value >= content.stats.min && value <= content.stats.max;
}

// A save is only usable if `state` looks like a GameState. We require the core
// fields to be present and well-typed; `creature`/`creatureHistory` stay optional
// so pre-generator saves still load. Anything else — a wrong-shape or missing-field
// payload — is treated as corrupt and rejected, rather than handed to the reducer,
// where a missing numeric field silently poisons CP to NaN and permanently blocks
// growth. `dayKey` accepts both strings and null because it is null in a fresh state.
function looksLikeGameState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  const core = ['hatched', 'stats', 'stage', 'cp', 'actionsToday', 'dayKey', 'stickers'];
  if (!core.every((k) => Object.hasOwn(s, k))) return false;
  if (typeof s.hatched !== 'boolean') return false;
  if (!s.stats || typeof s.stats !== 'object' || Array.isArray(s.stats)) return false;
  if (!REQUIRED_STATS.every((stat) => Object.hasOwn(s.stats, stat) && isValidStat(s.stats[stat]))) return false;
  if (!VALID_STAGES.has(s.stage)) return false;
  if (!Number.isFinite(s.cp) || s.cp < 0) return false;
  if (!Number.isInteger(s.actionsToday) || s.actionsToday < 0) return false;
  if (s.dayKey !== null && typeof s.dayKey !== 'string') return false;
  if (!Array.isArray(s.stickers) || !s.stickers.every((sticker) => typeof sticker === 'string')) return false;
  return true;
}

export function createPersistence(storage, key = SAVE_KEY) {
  let knownLastSeen = 0;

  return {
    load() {
      const raw = storage.getItem(key);
      if (raw == null) return null;
      try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !looksLikeGameState(data.state)) return null;
        const loadedLastSeen = Object.hasOwn(data, 'lastSeen') ? data.lastSeen : 0;
        if (!isValidTimestamp(loadedLastSeen)) return null;
        knownLastSeen = Math.max(knownLastSeen, loadedLastSeen);
        return { state: data.state, lastSeen: knownLastSeen };
      } catch {
        return null;
      }
    },

    save(state, now) {
      if (isValidTimestamp(now)) knownLastSeen = Math.max(knownLastSeen, now);
      storage.setItem(key, JSON.stringify({ state, lastSeen: knownLastSeen }));
    },

    lastSeen() {
      return knownLastSeen;
    }
  };
}
