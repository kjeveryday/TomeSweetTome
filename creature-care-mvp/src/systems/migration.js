// Deterministic Phase 1 save migration. This module is pure: callers provide
// the timestamp and no account, storage, DOM, clock, or network service is read.

import { initialState } from '../state.js';
import {
  CURRENT_SCHEMA_VERSION,
  LEGACY_ISBN_IDENTITY_VERSION,
  captureCareState,
  createBookEdition,
  createBookWork,
  createPlayerAccess,
  creatureIdForIdentity,
  editionIdForIsbn,
  isBookEdition,
  isBookWork,
  isEditionAliasKey,
  isCanonicalIsbn13,
  isCreatureRecord,
  isbnAliasKey,
  isLocalDayKey,
  isPlayerAccess,
  isReadingChallenge,
  isReadingRecord,
  isWorkAliasKey,
  workIdForIsbn
} from '../contracts.js';
import { DEFAULT_FEATURE_FLAGS, isFeatureFlagSet } from '../feature-flags.js';
import { looksLikeGameState } from './persistence.js';

export const CURRENT_SAVE_KEY = 'stacklings.save.v2';
export const LEGACY_SAVE_KEY = 'creatureCare.save.v1';

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const isTimestamp = (value) => Number.isFinite(value) && value >= 0;

function emptyModuleState() {
  return {
    books: { works: {}, editions: {}, aliases: {}, editionAliases: {}, provenance: {} },
    reading: {
      records: {}, formalDayKeys: [], bookStatuses: {},
      challenge: { registeredAt: null, goalDays: 20, halfwayDays: 10 }
    },
    collection: {
      creatures: {}, activeCreatureId: null, visibleCreatureIds: [], archivedCreatureIds: [],
      reconciledDuplicateWorkIds: []
    },
    playerAccess: createPlayerAccess(),
    careItems: { inventory: [], grantDayKeys: [] },
    recommendations: { requests: {}, results: {}, savedIds: [], dismissedIds: [] }
  };
}

function withModuleState(legacyState) {
  const modules = emptyModuleState();
  const legacyBooks = legacyState.books ?? {};
  const legacyReading = Object.hasOwn(legacyState, 'reading') ? legacyState.reading : undefined;
  const reading = legacyReading === undefined
    ? clone(modules.reading)
    : isObject(legacyReading)
      ? {
          ...clone(modules.reading),
          ...clone(legacyReading),
          bookStatuses: clone(legacyReading.bookStatuses ?? {}),
          challenge: clone(legacyReading.challenge ?? modules.reading.challenge)
        }
      : clone(legacyReading);
  return {
    ...clone(legacyState),
    books: {
      ...clone(modules.books),
      ...clone(legacyBooks),
      editionAliases: clone(legacyBooks.editionAliases ?? {}),
      provenance: clone(legacyBooks.provenance ?? {})
    },
    reading,
    collection: {
      ...clone(modules.collection),
      ...clone(legacyState.collection ?? {}),
      reconciledDuplicateWorkIds: clone(legacyState.collection?.reconciledDuplicateWorkIds ?? [])
    },
    playerAccess: clone(legacyState.playerAccess ?? modules.playerAccess),
    careItems: clone(legacyState.careItems ?? modules.careItems),
    recommendations: clone(legacyState.recommendations ?? modules.recommendations)
  };
}

function addGeneratedIdentity(target, creature, careState, active) {
  if (!isObject(creature) || creature.kind !== 'book' || !isCanonicalIsbn13(creature.isbn)) return null;
  const identityVersion = typeof creature.seedVersion === 'string' && creature.seedVersion.trim().length > 0
    ? creature.seedVersion
    : LEGACY_ISBN_IDENTITY_VERSION;
  const identityKey = creature.isbn;
  const workId = workIdForIsbn(identityKey);
  const editionId = editionIdForIsbn(identityKey);
  const creatureId = creatureIdForIdentity(identityVersion, identityKey);

  if (!target.books.works[workId]) {
    target.books.works[workId] = createBookWork({
      id: workId,
      title: creature.book?.title ?? '',
      authors: creature.book?.authors ?? [],
      metadataStatus: creature.book?.status === 'found' ? 'resolved' : 'unknown',
      editionIds: [editionId]
    });
  }
  if (!target.books.editions[editionId]) {
    target.books.editions[editionId] = createBookEdition({
      id: editionId,
      workId,
      isbn13: identityKey,
      format: creature.book?.format,
      metadataSource: creature.book?.source ?? 'legacy ISBN identity'
    });
  }
  target.books.aliases[isbnAliasKey(identityKey)] = workId;

  if (!target.collection.creatures[creatureId]) {
    target.collection.creatures[creatureId] = {
      id: creatureId,
      workId,
      identityVersion,
      identityKey,
      baseTraits: clone(creature),
      revealed: true,
      relationshipDayKeys: [],
      finished: false,
      careState: clone(careState)
    };
  } else if (active) {
    target.collection.creatures[creatureId].careState = clone(careState);
  }
  return creatureId;
}

function addOriginalCreature(target, state, careState) {
  if (!state.hatched) return null;
  const workId = 'work:legacy:unlinked';
  const creatureId = 'creature:legacy:original';
  target.books.works[workId] = createBookWork({
    id: workId,
    title: 'Original creature',
    metadataStatus: 'unknown',
    editionIds: []
  });
  target.collection.creatures[creatureId] = {
    id: creatureId,
    workId,
    identityVersion: 'stacklings:legacy',
    identityKey: 'original',
    baseTraits: {
      kind: 'legacy',
      name: state.name,
      ...(isObject(state.creature) ? { legacyCreature: clone(state.creature) } : {})
    },
    revealed: true,
    relationshipDayKeys: [],
    finished: false,
    careState: clone(careState)
  };
  return creatureId;
}

function migrateLegacyState(legacyState) {
  const state = withModuleState(legacyState);
  const careState = captureCareState(legacyState);
  const archived = [];
  const priorActiveCreatureId = state.collection.activeCreatureId;

  for (const creature of legacyState.creatureHistory ?? []) {
    const id = addGeneratedIdentity(state, creature, { status: 'uninitialized' }, false);
    if (id && !archived.includes(id)) archived.push(id);
  }

  const activeCreatureId = addGeneratedIdentity(state, legacyState.creature, careState, true)
    ?? addOriginalCreature(state, legacyState, careState);
  if (activeCreatureId) {
    state.collection.activeCreatureId = activeCreatureId;
    state.collection.visibleCreatureIds = [activeCreatureId];
  }
  if (priorActiveCreatureId && priorActiveCreatureId !== activeCreatureId && !archived.includes(priorActiveCreatureId)) {
    archived.push(priorActiveCreatureId);
  }
  state.collection.archivedCreatureIds = archived.filter((id) => id !== activeCreatureId);
  return state;
}

function isRecordMap(value, validator) {
  return isObject(value) && Object.entries(value).every(([id, record]) => id === record.id && validator(record));
}

export function isCurrentState(value) {
  if (!looksLikeGameState(value)) return false;
  if (!isObject(value.books) || !isRecordMap(value.books.works, isBookWork) || !isRecordMap(value.books.editions, isBookEdition)) return false;
  const works = value.books.works;
  const editions = value.books.editions;
  if (!isObject(value.books.aliases)
    || !Object.entries(value.books.aliases).every(([key, id]) => isWorkAliasKey(key) && Object.hasOwn(works, id))) return false;
  if (!isObject(value.books.editionAliases)
    || !Object.entries(value.books.editionAliases).every(([key, id]) => isEditionAliasKey(key) && Object.hasOwn(editions, id))) return false;
  if (!isObject(value.books.provenance)
    || !Object.entries(value.books.provenance).every(([workId, provenance]) => Object.hasOwn(works, workId)
      && isObject(provenance)
      && ['fixture', 'live', 'unavailable'].includes(provenance.source)
      && typeof provenance.providerId === 'string' && provenance.providerId.length > 0
      && typeof provenance.fetchedAt === 'string' && Number.isFinite(Date.parse(provenance.fetchedAt))
      && new Date(Date.parse(provenance.fetchedAt)).toISOString() === provenance.fetchedAt
      && isObject(provenance.fields)
      && Object.values(provenance.fields).every((entry) => typeof entry === 'string'))) return false;
  const isbnEditionIds = new Set();
  for (const edition of Object.values(editions)) {
    if (!Object.hasOwn(works, edition.workId) || !works[edition.workId].editionIds.includes(edition.id)) return false;
    if (edition.isbn13 && isbnEditionIds.has(edition.isbn13)) return false;
    if (edition.isbn13) isbnEditionIds.add(edition.isbn13);
  }
  for (const work of Object.values(works)) {
    if (!work.editionIds.every((id) => editions[id]?.workId === work.id)) return false;
  }
  if (!isObject(value.reading) || !isRecordMap(value.reading.records, isReadingRecord)) return false;
  if (!Array.isArray(value.reading.formalDayKeys)
    || !value.reading.formalDayKeys.every(isLocalDayKey)
    || new Set(value.reading.formalDayKeys).size !== value.reading.formalDayKeys.length) return false;
  if (!Object.values(value.reading.records).every((record) => Object.hasOwn(works, record.workId))) return false;
  const recordDayKeys = new Set(Object.values(value.reading.records).map((record) => record.localDayKey));
  if (recordDayKeys.size !== value.reading.formalDayKeys.length
    || !value.reading.formalDayKeys.every((key) => recordDayKeys.has(key))) return false;
  if (!isObject(value.reading.bookStatuses)
    || !Object.entries(value.reading.bookStatuses).every(([workId, status]) => Object.hasOwn(works, workId)
      && ['reading', 'finished', 'paused', 'not_for_me'].includes(status))) return false;
  if (!isReadingChallenge(value.reading.challenge)) return false;
  if (value.reading.challenge.registeredAt === null
    && (Object.keys(value.reading.records).length > 0 || value.reading.formalDayKeys.length > 0)) return false;
  if (!isObject(value.collection) || !isRecordMap(value.collection.creatures, isCreatureRecord)) return false;
  const creatures = value.collection.creatures;
  if (!Object.values(creatures).every((creature) => Object.hasOwn(works, creature.workId))) return false;
  if (value.collection.activeCreatureId !== null && typeof value.collection.activeCreatureId !== 'string') return false;
  if (value.collection.activeCreatureId !== null && !Object.hasOwn(creatures, value.collection.activeCreatureId)) return false;
  for (const ids of [value.collection.visibleCreatureIds, value.collection.archivedCreatureIds]) {
    if (!Array.isArray(ids) || !ids.every((id) => Object.hasOwn(creatures, id)) || new Set(ids).size !== ids.length) return false;
  }
  if (value.collection.activeCreatureId && value.collection.archivedCreatureIds.includes(value.collection.activeCreatureId)) return false;
  if (value.collection.activeCreatureId && !value.collection.visibleCreatureIds.includes(value.collection.activeCreatureId)) return false;
  if (value.collection.visibleCreatureIds.some((id) => value.collection.archivedCreatureIds.includes(id))) return false;
  if (!Array.isArray(value.collection.reconciledDuplicateWorkIds)
    || !value.collection.reconciledDuplicateWorkIds.every((id) => Object.hasOwn(works, id))
    || new Set(value.collection.reconciledDuplicateWorkIds).size !== value.collection.reconciledDuplicateWorkIds.length) return false;
  const creatureCountsByWork = Object.values(creatures).reduce((counts, creature) => {
    counts[creature.workId] = (counts[creature.workId] ?? 0) + 1;
    return counts;
  }, {});
  if (!Object.entries(creatureCountsByWork).every(([workId, count]) => count === 1
    || value.collection.reconciledDuplicateWorkIds.includes(workId))) return false;
  if (!value.collection.reconciledDuplicateWorkIds.every((workId) => creatureCountsByWork[workId] > 1)) return false;
  if (value.collection.activeCreatureId) {
    const activeCare = creatures[value.collection.activeCreatureId].careState;
    if (activeCare.status !== 'ready' || JSON.stringify(activeCare) !== JSON.stringify(captureCareState(value))) return false;
  }
  if (!isPlayerAccess(value.playerAccess)) return false;
  if (!isObject(value.careItems) || !Array.isArray(value.careItems.inventory) || !Array.isArray(value.careItems.grantDayKeys)) return false;
  if (!value.careItems.grantDayKeys.every(isLocalDayKey)
    || new Set(value.careItems.grantDayKeys).size !== value.careItems.grantDayKeys.length) return false;
  if (!value.careItems.inventory.every((item) => isObject(item)
    && ['id', 'itemId', 'grantId', 'sourceReadingRecordId'].every((key) => typeof item[key] === 'string' && item[key].length > 0)
    && isLocalDayKey(item.localDayKey)
    && Number.isInteger(item.remaining) && item.remaining >= 0)) return false;
  return isObject(value.recommendations)
    && isObject(value.recommendations.requests)
    && isObject(value.recommendations.results)
    && Array.isArray(value.recommendations.savedIds)
    && Array.isArray(value.recommendations.dismissedIds);
}

export function isCurrentEnvelope(value) {
  return isObject(value)
    && value.schemaVersion === CURRENT_SCHEMA_VERSION
    && isTimestamp(value.savedAt)
    && isTimestamp(value.lastSeen)
    && isFeatureFlagSet(value.featureFlags)
    && isCurrentState(value.state);
}

function freshEnvelope(now) {
  const timestamp = isTimestamp(now) ? now : 0;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: timestamp,
    lastSeen: 0,
    featureFlags: { ...DEFAULT_FEATURE_FLAGS },
    state: withModuleState(initialState())
  };
}

function parseInput(input) {
  if (typeof input !== 'string') return input;
  try { return JSON.parse(input); } catch { return Symbol.for('corrupt-save'); }
}

export function migrateSave(input, { now = 0 } = {}) {
  const parsed = parseInput(input?.envelope ?? input);
  if (parsed == null) return { status: 'fresh', envelope: freshEnvelope(now) };
  if (parsed === Symbol.for('corrupt-save')) return { status: 'corrupt', envelope: freshEnvelope(now) };
  const normalizedCurrent = isObject(parsed)
    && parsed.schemaVersion === CURRENT_SCHEMA_VERSION
    && isObject(parsed.state)
    ? { ...clone(parsed), state: withModuleState(parsed.state) }
    : parsed;
  if (isCurrentEnvelope(normalizedCurrent)) return { status: 'current', envelope: normalizedCurrent };

  if (isObject(parsed) && looksLikeGameState(parsed.state)) {
    const lastSeen = Object.hasOwn(parsed, 'lastSeen') ? parsed.lastSeen : 0;
    if (!isTimestamp(lastSeen)) return { status: 'corrupt', envelope: freshEnvelope(now) };
    const savedAt = Math.max(lastSeen, isTimestamp(now) ? now : 0);
    const result = {
      status: 'migrated',
      envelope: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAt,
        lastSeen,
        featureFlags: { ...DEFAULT_FEATURE_FLAGS },
        state: migrateLegacyState(parsed.state)
      }
    };
    return isCurrentEnvelope(result.envelope)
      ? result
      : { status: 'corrupt', envelope: freshEnvelope(now) };
  }

  return { status: 'corrupt', envelope: freshEnvelope(now) };
}
