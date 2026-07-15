// Pure reading-record and standalone challenge helpers. Time is always supplied
// by the caller; this module never reads the clock, storage, DOM, or network.

import {
  BookStatuses,
  ReadingModes,
  SharedEventTypes,
  isIsoTimestamp,
  isLocalDayKey,
  isReadingChallenge,
  isReadingRecord
} from '../contracts.js';

export const STANDALONE_GOAL_DAYS = 20;
export const STANDALONE_HALFWAY_DAYS = 10;

export const ProgramStatuses = Object.freeze({
  NotStarted: 'not_started',
  Registered: 'registered',
  Active: 'active',
  Halfway: 'halfway',
  Completed: 'completed'
});

const READING_MODES = new Set(Object.values(ReadingModes));
const BOOK_STATUSES = new Set(Object.values(BookStatuses));
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasString = (value, key) => isObject(value) && typeof value[key] === 'string' && value[key].length > 0;

function canonicalTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    try { return new Date(value).toISOString(); } catch { return null; }
  }
  return isIsoTimestamp(value) ? value : null;
}

function recordsFrom(value) {
  if (Array.isArray(value)) return value;
  if (isObject(value)) return Object.values(value);
  return null;
}

function compareDayKeys(left, right) {
  const a = left.split('-').map(Number);
  const b = right.split('-').map(Number);
  return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function localDayKeyAt(value) {
  const timestamp = canonicalTimestamp(value);
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function createReadingRecord({
  id,
  workId,
  confirmedAt,
  durationSeconds,
  mode = ReadingModes.Independent,
  status = BookStatuses.Reading
} = {}) {
  const occurredAt = canonicalTimestamp(confirmedAt);
  if (typeof id !== 'string' || id.length === 0) return { ok: false, reason: 'invalidReadingId' };
  if (typeof workId !== 'string' || workId.length === 0) return { ok: false, reason: 'invalidWorkId' };
  if (!occurredAt) return { ok: false, reason: 'invalidConfirmationTime' };
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) {
    return { ok: false, reason: 'invalidDuration' };
  }
  if (!READING_MODES.has(mode)) return { ok: false, reason: 'invalidReadingMode' };
  if (!BOOK_STATUSES.has(status)) return { ok: false, reason: 'invalidBookStatus' };

  const record = {
    id,
    workId,
    occurredAt,
    localDayKey: localDayKeyAt(occurredAt),
    ...(durationSeconds === undefined ? {} : { durationSeconds }),
    mode,
    status
  };
  return isReadingRecord(record)
    ? { ok: true, record }
    : { ok: false, reason: 'invalidReadingRecord' };
}

export function deriveFormalDayKeys(records) {
  const list = recordsFrom(records);
  if (!list || !list.every(isReadingRecord)) return { ok: false, reason: 'invalidReadingRecords' };
  const dayKeys = [...new Set(list.map((record) => record.localDayKey))].sort(compareDayKeys);
  return { ok: true, dayKeys };
}

export function validateReadingState(value) {
  if (!isObject(value) || !isObject(value.records) || !Array.isArray(value.formalDayKeys)) return false;
  if (!isReadingChallenge(value.challenge)) return false;
  if (!isObject(value.bookStatuses) || !Object.values(value.bookStatuses).every((status) => BOOK_STATUSES.has(status))) return false;
  if (!Object.entries(value.records).every(([id, record]) => id === record?.id && isReadingRecord(record))) return false;
  if (!value.formalDayKeys.every(isLocalDayKey) || new Set(value.formalDayKeys).size !== value.formalDayKeys.length) return false;
  const derived = deriveFormalDayKeys(value.records);
  return !(value.challenge.registeredAt === null && Object.keys(value.records).length > 0)
    && derived.ok
    && derived.dayKeys.length === value.formalDayKeys.length
    && derived.dayKeys.every((key) => value.formalDayKeys.includes(key));
}

export function recordReading(readingState, record) {
  if (!validateReadingState(readingState)) return { ok: false, reason: 'invalidReadingState' };
  if (readingState.challenge.registeredAt === null) return { ok: false, reason: 'challengeNotStarted' };
  if (!isReadingRecord(record)) return { ok: false, reason: 'invalidReadingRecord' };
  const existing = readingState.records[record.id];
  if (existing) {
    return sameRecord(existing, record)
      ? {
          ok: true,
          replayed: true,
          formalDayAdded: false,
          readingState: structuredClone(readingState),
          eventPayloads: []
        }
      : { ok: false, reason: 'readingIdConflict' };
  }

  const formalDayAdded = !readingState.formalDayKeys.includes(record.localDayKey);
  const records = { ...structuredClone(readingState.records), [record.id]: structuredClone(record) };
  const derived = deriveFormalDayKeys(records);
  const eventPayloads = [
    {
      type: SharedEventTypes.ReadingRecorded,
      payload: { readingRecordId: record.id, workId: record.workId, record: structuredClone(record) }
    },
    ...(formalDayAdded ? [{
      type: SharedEventTypes.ReadingDayRecorded,
      payload: { readingRecordId: record.id, localDayKey: record.localDayKey }
    }] : []),
    {
      type: SharedEventTypes.BookStatusChanged,
      payload: { workId: record.workId, status: record.status }
    }
  ];
  return {
    ok: true,
    replayed: false,
    formalDayAdded,
    readingState: {
      ...structuredClone(readingState),
      records,
      formalDayKeys: derived.dayKeys,
      bookStatuses: { ...structuredClone(readingState.bookStatuses), [record.workId]: record.status }
    },
    eventPayloads
  };
}

export function readingsForWork(records, workId) {
  const list = recordsFrom(records);
  if (!list || !list.every(isReadingRecord) || typeof workId !== 'string' || workId.length === 0) return [];
  return list
    .filter((record) => record.workId === workId)
    .map((record) => structuredClone(record))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
}

export function startStandaloneChallenge(startedAt) {
  const timestamp = canonicalTimestamp(startedAt);
  return timestamp ? {
    ok: true,
    challenge: {
      registeredAt: timestamp,
      goalDays: STANDALONE_GOAL_DAYS,
      halfwayDays: STANDALONE_HALFWAY_DAYS
    }
  } : { ok: false, reason: 'invalidStartTime' };
}

export function deriveProgramStatus({ challenge, formalDayKeys = [] } = {}) {
  if (challenge == null) return ProgramStatuses.NotStarted;
  if (!isReadingChallenge(challenge)) throw new TypeError('Invalid standalone challenge');
  if (!Array.isArray(formalDayKeys)
    || !formalDayKeys.every(isLocalDayKey)
    || new Set(formalDayKeys).size !== formalDayKeys.length) {
    throw new TypeError('Invalid formal reading days');
  }
  if (challenge.registeredAt === null) return ProgramStatuses.NotStarted;
  const count = formalDayKeys.length;
  if (count >= challenge.goalDays) return ProgramStatuses.Completed;
  if (count >= challenge.halfwayDays) return ProgramStatuses.Halfway;
  if (count > 0) return ProgramStatuses.Active;
  return ProgramStatuses.Registered;
}

export function readingProgress({ challenge, formalDayKeys = [] } = {}) {
  const status = deriveProgramStatus({ challenge, formalDayKeys });
  return {
    status,
    readingDayCount: formalDayKeys.length,
    halfwayDayCount: challenge?.halfwayDays ?? STANDALONE_HALFWAY_DAYS,
    goalDayCount: challenge?.goalDays ?? STANDALONE_GOAL_DAYS
  };
}
