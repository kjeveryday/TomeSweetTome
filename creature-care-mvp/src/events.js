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
