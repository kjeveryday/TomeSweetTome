// Persistence: serializes { state, lastSeen } synchronously after every event.
// The storage adapter is injected (window.localStorage in app.js, a fake in tests),
// so this module stays DOM-free. `lastSeen` never moves backward: we always store
// max(previous lastSeen, now), so a backward device clock causes no double-drift.

export const SAVE_KEY = 'creatureCare.save.v1';

export function createPersistence(storage, key = SAVE_KEY) {
  let knownLastSeen = 0;

  return {
    load() {
      const raw = storage.getItem(key);
      if (raw == null) return null;
      try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !data.state) return null;
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
