// Persistence: serializes { state, lastSeen } synchronously after every event.
// The storage adapter is injected (window.localStorage in app.js, a fake in tests),
// so this module stays DOM-free. `lastSeen` never moves backward: we always store
// max(previous lastSeen, now), so a backward device clock causes no double-drift.

export const SAVE_KEY = 'creatureCare.save.v1';

// A save is only usable if `state` looks like a GameState. We require the core
// fields to be present and well-typed; `creature`/`creatureHistory` stay optional
// so pre-generator saves still load. Anything else — a wrong-shape or missing-field
// payload — is treated as corrupt and rejected, rather than handed to the reducer,
// where a missing numeric field silently poisons CP to NaN and permanently blocks
// growth. `dayKey` is intentionally not type-checked: it is null in a fresh state.
function looksLikeGameState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  const core = ['hatched', 'stats', 'stage', 'cp', 'actionsToday', 'dayKey', 'stickers'];
  if (!core.every((k) => Object.hasOwn(s, k))) return false;
  if (typeof s.hatched !== 'boolean') return false;
  if (!s.stats || typeof s.stats !== 'object' || Array.isArray(s.stats)) return false;
  if (!Number.isFinite(s.stage) || !Number.isFinite(s.cp) || !Number.isFinite(s.actionsToday)) return false;
  if (!Array.isArray(s.stickers)) return false;
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
        knownLastSeen = Math.max(knownLastSeen, data.lastSeen ?? 0);
        return { state: data.state, lastSeen: knownLastSeen };
      } catch {
        return null;
      }
    },

    save(state, now) {
      knownLastSeen = Math.max(knownLastSeen, now);
      storage.setItem(key, JSON.stringify({ state, lastSeen: knownLastSeen }));
    },

    lastSeen() {
      return knownLastSeen;
    }
  };
}
