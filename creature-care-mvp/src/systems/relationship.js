// Pure creature-relationship-day and finish-marker helpers. No DOM, storage,
// clock, or network access; every local-day key the caller needs is derived
// elsewhere. Relationship days and the finish marker are non-ranked flavor —
// this module never computes or touches CP, stage, care power, or stats.

import { isLocalDayKey } from '../contracts.js';
import content from '../content.json' with { type: 'json' };

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

function hasValidRelationshipDayKeys(creature) {
  return isObject(creature)
    && Array.isArray(creature.relationshipDayKeys)
    && creature.relationshipDayKeys.every(isLocalDayKey);
}

export function nextRelationshipResponse(existingDayCount, responses = content.relationship.responses) {
  if (!Array.isArray(responses) || responses.length === 0) return null;
  if (!Number.isInteger(existingDayCount) || existingDayCount < 0) return null;
  return structuredClone(responses[existingDayCount % responses.length]);
}

export function recordRelationshipDay(creature, localDayKey) {
  if (!hasValidRelationshipDayKeys(creature)) return { ok: false, reason: 'invalidCreature' };
  if (!isLocalDayKey(localDayKey)) return { ok: false, reason: 'invalidLocalDayKey' };

  if (creature.relationshipDayKeys.includes(localDayKey)) {
    return { ok: true, changed: false };
  }

  const dayIndex = creature.relationshipDayKeys.length;
  const response = nextRelationshipResponse(dayIndex);
  return {
    ok: true,
    changed: true,
    localDayKey,
    dayIndex,
    responseId: response.id,
    relationshipDayKeys: [...creature.relationshipDayKeys, localDayKey]
  };
}

export function relationshipLevel(creature) {
  return hasValidRelationshipDayKeys(creature) ? creature.relationshipDayKeys.length : 0;
}

export function currentRelationshipResponse(creature, responses = content.relationship.responses) {
  const level = relationshipLevel(creature);
  if (level < 1) return null;
  if (!Array.isArray(responses) || responses.length === 0) return null;
  return structuredClone(responses[(level - 1) % responses.length]);
}

export function shouldMarkFinished(creature, status) {
  return status === 'finished' && isObject(creature) && creature.finished !== true;
}

export function finishedResponse(responses = content.relationship) {
  if (!isObject(responses) || !isObject(responses.finishedResponse)) return null;
  return structuredClone(responses.finishedResponse);
}

export function validateRelationshipContent(responses) {
  if (!Array.isArray(responses) || responses.length === 0) return false;
  if (!responses.every((entry) => isObject(entry) && isNonEmptyString(entry.id))) return false;
  const ids = responses.map((entry) => entry.id);
  return new Set(ids).size === ids.length;
}
