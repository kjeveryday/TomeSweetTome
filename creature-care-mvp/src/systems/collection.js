// Pure creature preview/reveal/collection helpers. No DOM, storage, or clock
// access; every timestamp-shaped value the caller needs is derived elsewhere.

import {
  creatureIdForIdentity,
  isCreatureRecord
} from '../contracts.js';
import content from '../content.json' with { type: 'json' };

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const isStringArray = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const isUniqueStringArray = (value) => isStringArray(value) && new Set(value).size === value.length;

export function freshCareState() {
  return {
    status: 'ready',
    stats: { ...content.stats.initial },
    stage: content.species.stages[0].stage,
    cp: 0,
    actionsToday: 0,
    dayKey: null,
    stickers: [],
    tuckedIn: false
  };
}

export function previewForBook({ workId, identityVersion, identityKey, baseTraits } = {}, existingCreatures) {
  if (!isNonEmptyString(workId)) return { ok: false, reason: 'invalidWorkId' };
  if (!isNonEmptyString(identityVersion)) return { ok: false, reason: 'invalidIdentityVersion' };
  if (!isNonEmptyString(identityKey)) return { ok: false, reason: 'invalidIdentityKey' };
  if (!isObject(baseTraits)) return { ok: false, reason: 'invalidBaseTraits' };
  if (!isObject(existingCreatures)) return { ok: false, reason: 'invalidExistingCreatures' };

  const creatureId = creatureIdForIdentity(identityVersion, identityKey);
  if (Object.hasOwn(existingCreatures, creatureId)) {
    return { ok: true, alreadyExists: true, creatureId };
  }

  const record = {
    id: creatureId,
    workId,
    identityVersion,
    identityKey,
    baseTraits: structuredClone(baseTraits),
    revealed: false,
    relationshipDayKeys: [],
    finished: false,
    careState: { status: 'uninitialized' }
  };
  return isCreatureRecord(record)
    ? { ok: true, alreadyExists: false, creatureId, record }
    : { ok: false, reason: 'invalidCreatureRecord' };
}

export function revealForReading({ workId, readingRecordId } = {}, existingCreatures) {
  if (!isNonEmptyString(workId)) return { ok: false, reason: 'invalidWorkId' };
  if (!isNonEmptyString(readingRecordId)) return { ok: false, reason: 'invalidReadingRecordId' };
  if (!isObject(existingCreatures)) return { ok: false, reason: 'invalidExistingCreatures' };

  const reveals = Object.values(existingCreatures)
    .filter((creature) => isCreatureRecord(creature) && creature.workId === workId && creature.revealed === false)
    .map((creature) => ({ creatureId: creature.id, workId, readingRecordId }));
  return { ok: true, reveals };
}

export function selectActiveCreature({
  creatureId, activeCreatureId, visibleCreatureIds, archivedCreatureIds
} = {}, visibleLimit) {
  if (!isNonEmptyString(creatureId)) return { ok: false, reason: 'invalidCreatureId' };
  if (!isUniqueStringArray(visibleCreatureIds)) return { ok: false, reason: 'invalidVisibleCreatureIds' };
  if (!isUniqueStringArray(archivedCreatureIds)) return { ok: false, reason: 'invalidArchivedCreatureIds' };
  if (!Number.isInteger(visibleLimit) || visibleLimit <= 0) return { ok: false, reason: 'invalidVisibleLimit' };

  if (creatureId === activeCreatureId) return { ok: true, changed: false };

  let visible = visibleCreatureIds.filter((id) => id !== creatureId);
  let archived = archivedCreatureIds.filter((id) => id !== creatureId);
  visible = [...visible, creatureId];

  while (visible.length > visibleLimit) {
    const evicted = visible.find((id) => id !== creatureId);
    visible = visible.filter((id) => id !== evicted);
    archived = [...archived, evicted];
  }

  return { ok: true, changed: true, visibleCreatureIds: visible, archivedCreatureIds: archived };
}

export function validateCollectionState(value) {
  if (!isObject(value) || !isObject(value.creatures)) return false;
  if (!Object.entries(value.creatures).every(([id, creature]) => id === creature?.id && isCreatureRecord(creature))) {
    return false;
  }
  if (!(value.activeCreatureId === null || (typeof value.activeCreatureId === 'string' && Object.hasOwn(value.creatures, value.activeCreatureId)))) {
    return false;
  }
  if (!isUniqueStringArray(value.visibleCreatureIds) || !value.visibleCreatureIds.every((id) => Object.hasOwn(value.creatures, id))) {
    return false;
  }
  if (!isUniqueStringArray(value.archivedCreatureIds) || !value.archivedCreatureIds.every((id) => Object.hasOwn(value.creatures, id))) {
    return false;
  }
  if (value.visibleCreatureIds.some((id) => value.archivedCreatureIds.includes(id))) return false;
  if (value.activeCreatureId !== null) {
    if (!value.visibleCreatureIds.includes(value.activeCreatureId)) return false;
    if (value.archivedCreatureIds.includes(value.activeCreatureId)) return false;
  }
  if (!isUniqueStringArray(value.reconciledDuplicateWorkIds)) return false;
  return true;
}
