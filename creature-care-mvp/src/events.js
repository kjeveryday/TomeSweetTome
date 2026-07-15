// Canonical event types and constructors. Pure data — no DOM, no clock access.
// Every constructor takes `now` (ms) from the caller; events never read time themselves.

export const EventTypes = Object.freeze({
  Hatched: 'Hatched',
  TimeElapsed: 'TimeElapsed',
  DayRolledOver: 'DayRolledOver',
  CareActionPerformed: 'CareActionPerformed',
  CreatureStateChanged: 'CreatureStateChanged',
  GiftGranted: 'GiftGranted',
  CreatureGenerated: 'CreatureGenerated',
  TuckedIn: 'TuckedIn',
  ResourceGranted: 'ResourceGranted'
});

export const hatched = (now) => ({ type: EventTypes.Hatched, at: now });

export const timeElapsed = (elapsedMs, now) => ({ type: EventTypes.TimeElapsed, elapsedMs, at: now });

export const dayRolledOver = (dayKey, now) => ({ type: EventTypes.DayRolledOver, dayKey, at: now });

export const careActionPerformed = (actionId, cpGranted, now) => ({
  type: EventTypes.CareActionPerformed, actionId, cpGranted, at: now
});

export const creatureStateChanged = (stage, now) => ({ type: EventTypes.CreatureStateChanged, stage, at: now });

export const giftGranted = (stickerId, now) => ({ type: EventTypes.GiftGranted, stickerId, at: now });

export const creatureGenerated = (creature, now) => ({
  type: EventTypes.CreatureGenerated, creature, at: now
});

export const tuckedIn = (now) => ({ type: EventTypes.TuckedIn, at: now });

export const resourceGranted = (cp, now) => ({ type: EventTypes.ResourceGranted, cp, at: now });
