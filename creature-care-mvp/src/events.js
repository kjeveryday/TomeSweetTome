// Canonical event types and compatibility constructors. Pure data — no DOM or
// clock access. Phase 1 module events use createEventEnvelope from contracts.js;
// these v1 constructors now include the same stable envelope fields while keeping
// their original top-level payload fields for the existing reducer.

import { SharedEventTypes } from './contracts.js';

export function createEventIdFactory(sessionId) {
  let sequence = 0;
  return (type, at) => `event:${encodeURIComponent(sessionId)}:${at}:${sequence += 1}:${type}`;
}

export const EventTypes = Object.freeze({
  Hatched: 'Hatched',
  TimeElapsed: 'TimeElapsed',
  DayRolledOver: 'DayRolledOver',
  CareActionPerformed: 'CareActionPerformed',
  CreatureStateChanged: 'CreatureStateChanged',
  GiftGranted: 'GiftGranted',
  CreatureGenerated: 'CreatureGenerated',
  TuckedIn: 'TuckedIn',
  ResourceGranted: 'ResourceGranted',
  ...SharedEventTypes
});

function compatibilityEvent(type, at, payload, id) {
  const stablePayload = JSON.stringify(payload);
  return {
    id: id ?? `event:${type}:${at}:${stablePayload}`,
    type,
    version: 1,
    timestamp: new Date(at).toISOString(),
    payload: { ...payload },
    compatibilityIdFallback: id == null,
    at,
    ...payload
  };
}

export const hatched = (now, id) => compatibilityEvent(EventTypes.Hatched, now, {}, id);

export const timeElapsed = (elapsedMs, now, id) =>
  compatibilityEvent(EventTypes.TimeElapsed, now, { elapsedMs }, id);

export const dayRolledOver = (dayKey, now, id) =>
  compatibilityEvent(EventTypes.DayRolledOver, now, { dayKey }, id);

export const careActionPerformed = (actionId, cpGranted, now, id) =>
  compatibilityEvent(EventTypes.CareActionPerformed, now, { actionId, cpGranted }, id);

export const creatureStateChanged = (stage, now, id) =>
  compatibilityEvent(EventTypes.CreatureStateChanged, now, { stage }, id);

export const giftGranted = (stickerId, now, id) =>
  compatibilityEvent(EventTypes.GiftGranted, now, { stickerId }, id);

export const creatureGenerated = (creature, now, id) =>
  compatibilityEvent(EventTypes.CreatureGenerated, now, { creature }, id);

export const tuckedIn = (now, id) => compatibilityEvent(EventTypes.TuckedIn, now, {}, id);

export const resourceGranted = (cp, now, id) =>
  compatibilityEvent(EventTypes.ResourceGranted, now, { cp }, id);

export const bookAdded = ({ work, edition, aliases, editionAliases, provenance }, now, id) =>
  compatibilityEvent(EventTypes.BookAdded, now, {
    workId: work.id,
    editionId: edition.id,
    work: structuredClone(work),
    edition: structuredClone(edition),
    aliases: structuredClone(aliases),
    editionAliases: structuredClone(editionAliases),
    provenance: structuredClone(provenance)
  }, id);

export const bookMetadataResolved = ({ work, edition, aliases, editionAliases, provenance }, now, id) =>
  compatibilityEvent(EventTypes.BookMetadataResolved, now, {
    workId: work.id,
    editionId: edition.id,
    metadataStatus: work.metadataStatus,
    source: provenance.source,
    work: structuredClone(work),
    edition: structuredClone(edition),
    aliases: structuredClone(aliases),
    editionAliases: structuredClone(editionAliases),
    provenance: structuredClone(provenance)
  }, id);

export const bookWorkReconciled = ({ canonicalWorkId, aliasedWorkIds, editionIds }, now, id) =>
  compatibilityEvent(EventTypes.BookWorkReconciled, now, {
    canonicalWorkId,
    aliasedWorkIds: [...aliasedWorkIds],
    editionIds: [...editionIds]
  }, id);

export const readingChallengeStarted = (challenge, now, id) =>
  compatibilityEvent(EventTypes.ReadingChallengeStarted, now, structuredClone(challenge), id);

export const readingRecorded = (record, now, id) =>
  compatibilityEvent(EventTypes.ReadingRecorded, now, {
    readingRecordId: record.id,
    workId: record.workId,
    record: structuredClone(record)
  }, id);

export const readingDayRecorded = (record, now, id) =>
  compatibilityEvent(EventTypes.ReadingDayRecorded, now, {
    readingRecordId: record.id,
    localDayKey: record.localDayKey
  }, id);

export const bookStatusChanged = (workId, status, now, id) =>
  compatibilityEvent(EventTypes.BookStatusChanged, now, { workId, status }, id);

export const creaturePreviewCreated = ({ creatureId, workId, identityVersion, identityKey, baseTraits }, now, id) =>
  compatibilityEvent(EventTypes.CreaturePreviewCreated, now, {
    creatureId,
    workId,
    identityVersion,
    identityKey,
    baseTraits: structuredClone(baseTraits)
  }, id);

export const creatureRevealed = ({ creatureId, workId, readingRecordId }, now, id) =>
  compatibilityEvent(EventTypes.CreatureRevealed, now, { creatureId, workId, readingRecordId }, id);

export const activeCreatureChanged = ({ creatureId }, now, id) =>
  compatibilityEvent(EventTypes.ActiveCreatureChanged, now, { creatureId }, id);

export const creatureRelationshipChanged = ({ creatureId, workId, readingRecordId, localDayKey, responseId }, now, id) =>
  compatibilityEvent(EventTypes.CreatureRelationshipChanged, now, {
    creatureId, workId, readingRecordId, localDayKey, responseId
  }, id);

export const careItemGranted = ({ grantId, itemId, localDayKey, sourceReadingRecordId, categoryId }, now, id) =>
  compatibilityEvent(EventTypes.CareItemGranted, now, {
    grantId,
    itemId,
    localDayKey,
    sourceReadingRecordId,
    ...(categoryId === undefined ? {} : { categoryId })
  }, id);

export const careItemUsed = ({ useId, itemId, creatureId, actionId, cpGranted }, now, id) =>
  compatibilityEvent(EventTypes.CareItemUsed, now, {
    useId, itemId, creatureId, actionId, cpGranted
  }, id);
