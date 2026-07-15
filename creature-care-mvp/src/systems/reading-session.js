// Ephemeral optional timer sessions. Running and stopped durations stay in
// memory. Reload recovery may retain only a one-time work intent marker.

import { isIsoTimestamp } from '../contracts.js';
import { createReadingRecord } from './reading.js';

export const ReadingSessionStatuses = Object.freeze({
  Disabled: 'disabled',
  Idle: 'idle',
  Running: 'running',
  AwaitingConfirmation: 'awaiting_confirmation'
});

const INTERRUPTED_INTENT_VERSION = 1;
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasString = (value, key) => isObject(value) && typeof value[key] === 'string' && value[key].length > 0;

function canonicalTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    try { return new Date(value).toISOString(); } catch { return null; }
  }
  return isIsoTimestamp(value) ? value : null;
}

function idle(timerEnabled) {
  return { status: timerEnabled ? ReadingSessionStatuses.Idle : ReadingSessionStatuses.Disabled };
}

export function createReadingSession({ timerEnabled = false } = {}) {
  return idle(timerEnabled === true);
}

export function startReadingTimer(session, { workId, startedAt } = {}) {
  if (session?.status === ReadingSessionStatuses.Disabled) return { ok: false, reason: 'timerDisabled' };
  if (session?.status !== ReadingSessionStatuses.Idle) return { ok: false, reason: 'timerNotIdle' };
  const timestamp = canonicalTimestamp(startedAt);
  if (typeof workId !== 'string' || workId.length === 0) return { ok: false, reason: 'invalidWorkId' };
  if (!timestamp) return { ok: false, reason: 'invalidStartTime' };
  return {
    ok: true,
    session: { status: ReadingSessionStatuses.Running, workId, startedAt: timestamp }
  };
}

export function stopReadingTimer(session, stoppedAt) {
  if (session?.status !== ReadingSessionStatuses.Running) return { ok: false, reason: 'timerNotRunning' };
  const timestamp = canonicalTimestamp(stoppedAt);
  if (!timestamp) return { ok: false, reason: 'invalidStopTime' };
  const elapsedMs = Date.parse(timestamp) - Date.parse(session.startedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { ok: false, reason: 'stopBeforeStart' };
  return {
    ok: true,
    session: {
      status: ReadingSessionStatuses.AwaitingConfirmation,
      workId: session.workId,
      durationSeconds: Math.floor(elapsedMs / 1000)
    }
  };
}

export function confirmTimedReading(session, input = {}) {
  if (session?.status !== ReadingSessionStatuses.AwaitingConfirmation) {
    return { ok: false, reason: 'timerNotAwaitingConfirmation' };
  }
  const result = createReadingRecord({
    ...input,
    workId: session.workId,
    durationSeconds: session.durationSeconds
  });
  return result.ok
    ? { ok: true, record: result.record, session: idle(true) }
    : result;
}

export function cancelReadingSession(session) {
  return session?.status === ReadingSessionStatuses.Disabled ? idle(false) : idle(true);
}

export function interruptReadingSession(session) {
  if (![ReadingSessionStatuses.Running, ReadingSessionStatuses.AwaitingConfirmation].includes(session?.status)) {
    return { session: cancelReadingSession(session), interruptedIntent: null };
  }
  return {
    session: idle(true),
    interruptedIntent: {
      version: INTERRUPTED_INTENT_VERSION,
      workId: session.workId
    }
  };
}

export function restoreReadingSession({ timerEnabled = false, interruptedIntent = null } = {}) {
  const validIntent = isObject(interruptedIntent)
    && interruptedIntent.version === INTERRUPTED_INTENT_VERSION
    && hasString(interruptedIntent, 'workId')
    && Object.keys(interruptedIntent).every((key) => ['version', 'workId'].includes(key));
  return {
    session: idle(timerEnabled === true),
    prompt: timerEnabled === true && validIntent ? { workId: interruptedIntent.workId } : null,
    interruptedIntent: null
  };
}

export function confirmInterruptedReading(prompt, input = {}) {
  if (!hasString(prompt, 'workId')) return { ok: false, reason: 'invalidInterruptedPrompt' };
  return createReadingRecord({ ...input, workId: prompt.workId, durationSeconds: undefined });
}
