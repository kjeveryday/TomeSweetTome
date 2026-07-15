// Versioned storage adapters. LocalStorageAdapter is the guest implementation;
// SyncedStorageAdapter is a deterministic in-memory fixture for the later account phase.

import { CURRENT_SCHEMA_VERSION } from '../contracts.js';
import { DEFAULT_FEATURE_FLAGS } from '../feature-flags.js';
import {
  CURRENT_SAVE_KEY,
  LEGACY_SAVE_KEY,
  isCurrentEnvelope,
  migrateSave
} from './migration.js';

const isTimestamp = (value) => Number.isFinite(value) && value >= 0;

export class LocalStorageAdapter {
  constructor(storage, { key = CURRENT_SAVE_KEY, legacyKey = LEGACY_SAVE_KEY } = {}) {
    this.storage = storage;
    this.key = key;
    this.legacyKey = legacyKey;
    this.current = null;
  }

  load(now = 0) {
    const currentRaw = this.storage.getItem(this.key);
    if (currentRaw != null) {
      const result = migrateSave(currentRaw, { now });
      if (result.status === 'current') {
        this.current = result.envelope;
        return structuredClone(this.current);
      }
    }

    const legacyRaw = this.storage.getItem(this.legacyKey);
    const result = migrateSave(legacyRaw, { now });
    this.current = result.envelope;
    if (result.status === 'migrated') this.storage.setItem(this.key, JSON.stringify(this.current));
    return structuredClone(this.current);
  }

  save(stateOrEnvelope, now = 0) {
    const previous = this.current ?? this.load(now);
    let candidate = isCurrentEnvelope(stateOrEnvelope)
      ? structuredClone(stateOrEnvelope)
      : {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          savedAt: isTimestamp(now) ? now : previous.savedAt,
          lastSeen: isTimestamp(now) ? Math.max(previous.lastSeen, now) : previous.lastSeen,
          featureFlags: { ...(previous.featureFlags ?? DEFAULT_FEATURE_FLAGS) },
          state: structuredClone(stateOrEnvelope)
        };
    if (!isCurrentEnvelope(candidate) && !isCurrentEnvelope(stateOrEnvelope)) {
      const reconciled = migrateSave({ state: stateOrEnvelope, lastSeen: candidate.lastSeen }, { now });
      if (reconciled.status === 'corrupt') throw new TypeError('Refusing to save an invalid Stacklings state');
      if (Object.hasOwn(stateOrEnvelope ?? {}, 'books')
        && JSON.stringify(stateOrEnvelope.books) !== JSON.stringify(reconciled.envelope.state.books)) {
        throw new TypeError('Refusing to save an invalid Stacklings state');
      }
      candidate = { ...reconciled.envelope, featureFlags: { ...previous.featureFlags } };
    }
    if (!isCurrentEnvelope(candidate)) throw new TypeError('Refusing to save an invalid Stacklings envelope');
    candidate.lastSeen = Math.max(previous.lastSeen, candidate.lastSeen);
    candidate.savedAt = Math.max(previous.savedAt, candidate.savedAt);
    this.current = candidate;
    this.storage.setItem(this.key, JSON.stringify(this.current));
    return structuredClone(this.current);
  }

  export(now = 0) {
    return JSON.stringify(this.current ?? this.load(now));
  }

  delete() {
    this.storage.removeItem(this.key);
    this.storage.removeItem(this.legacyKey);
    this.current = null;
    return { ok: true };
  }

  healthCheck() {
    const probeKey = `${this.key}.healthCheck`;
    try {
      this.storage.setItem(probeKey, 'ok');
      const ok = this.storage.getItem(probeKey) === 'ok';
      this.storage.removeItem(probeKey);
      return { ok, storageKind: 'local' };
    } catch {
      return { ok: false, storageKind: 'local' };
    }
  }
}

export class SyncedStorageAdapter {
  constructor(initialEnvelope = null) {
    this.current = initialEnvelope ? migrateSave(initialEnvelope).envelope : null;
  }

  load(now = 0) {
    if (!this.current) this.current = migrateSave(null, { now }).envelope;
    return structuredClone(this.current);
  }

  save(stateOrEnvelope, now = 0) {
    const previous = this.load(now);
    let candidate = isCurrentEnvelope(stateOrEnvelope)
      ? structuredClone(stateOrEnvelope)
      : {
          ...previous,
          savedAt: isTimestamp(now) ? Math.max(previous.savedAt, now) : previous.savedAt,
          lastSeen: isTimestamp(now) ? Math.max(previous.lastSeen, now) : previous.lastSeen,
          state: structuredClone(stateOrEnvelope)
        };
    if (!isCurrentEnvelope(candidate) && !isCurrentEnvelope(stateOrEnvelope)) {
      const reconciled = migrateSave({ state: stateOrEnvelope, lastSeen: candidate.lastSeen }, { now });
      if (reconciled.status === 'corrupt') throw new TypeError('Refusing to sync an invalid Stacklings state');
      if (Object.hasOwn(stateOrEnvelope ?? {}, 'books')
        && JSON.stringify(stateOrEnvelope.books) !== JSON.stringify(reconciled.envelope.state.books)) {
        throw new TypeError('Refusing to sync an invalid Stacklings state');
      }
      candidate = { ...reconciled.envelope, featureFlags: { ...previous.featureFlags } };
    }
    if (!isCurrentEnvelope(candidate)) throw new TypeError('Refusing to sync an invalid Stacklings envelope');
    this.current = candidate;
    return structuredClone(this.current);
  }

  export(now = 0) { return JSON.stringify(this.load(now)); }
  delete() { this.current = null; return { ok: true }; }
  healthCheck() { return { ok: true, storageKind: 'synchronized_fixture' }; }
}
