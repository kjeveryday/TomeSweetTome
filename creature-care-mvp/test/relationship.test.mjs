import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentRelationshipResponse,
  finishedResponse,
  nextRelationshipResponse,
  recordRelationshipDay,
  relationshipLevel,
  shouldMarkFinished,
  validateRelationshipContent
} from '../src/systems/relationship.js';
import { content } from './helpers.mjs';

const RESPONSES = content.relationship.responses;

function creature(overrides = {}) {
  return {
    id: 'creature:1',
    workId: 'work:1',
    identityVersion: 'stacklings:v1',
    identityKey: '9780064400558',
    baseTraits: {},
    revealed: true,
    relationshipDayKeys: [],
    finished: false,
    careState: { status: 'uninitialized' },
    ...overrides
  };
}

// --- recordRelationshipDay ---------------------------------------------------

test('the reveal day is relationship day 1: empty relationshipDayKeys advances to response 0', () => {
  const result = recordRelationshipDay(creature(), '2026-7-15');
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.dayIndex, 0);
  assert.equal(result.responseId, RESPONSES[0].id);
  assert.deepEqual(result.relationshipDayKeys, ['2026-7-15']);
});

test('recording the same local day twice is a per-date dedup no-op and never mutates the input', () => {
  const original = creature({ relationshipDayKeys: ['2026-7-15'] });
  const snapshot = structuredClone(original);
  const result = recordRelationshipDay(original, '2026-7-15');
  assert.deepEqual(result, { ok: true, changed: false });
  assert.deepEqual(original, snapshot);
});

test('distinct later days advance the response cyclically through the whole list', () => {
  let dayKeys = [];
  for (let index = 0; index < RESPONSES.length; index += 1) {
    const localDayKey = `2026-7-${index + 1}`;
    const result = recordRelationshipDay(creature({ relationshipDayKeys: dayKeys }), localDayKey);
    assert.equal(result.ok, true);
    assert.equal(result.changed, true);
    assert.equal(result.dayIndex, index);
    assert.equal(result.responseId, RESPONSES[index].id);
    dayKeys = result.relationshipDayKeys;
  }
});

test('the response cycle wraps back to the first response after the list is exhausted', () => {
  const dayKeys = Array.from({ length: RESPONSES.length }, (_, index) => `2026-7-${index + 1}`);
  const result = recordRelationshipDay(creature({ relationshipDayKeys: dayKeys }), '2026-8-1');
  assert.equal(result.ok, true);
  assert.equal(result.dayIndex, RESPONSES.length);
  assert.equal(result.responseId, RESPONSES[0].id);
});

test('recordRelationshipDay never mutates the input creature or its relationshipDayKeys array', () => {
  const original = creature({ relationshipDayKeys: ['2026-7-15'] });
  const snapshot = structuredClone(original);
  const result = recordRelationshipDay(original, '2026-7-16');
  assert.equal(result.ok, true);
  assert.deepEqual(original, snapshot);
  assert.notEqual(result.relationshipDayKeys, original.relationshipDayKeys);
});

test('recordRelationshipDay rejects malformed input without throwing', () => {
  assert.deepEqual(recordRelationshipDay(null, '2026-7-15'), { ok: false, reason: 'invalidCreature' });
  assert.deepEqual(recordRelationshipDay({}, '2026-7-15'), { ok: false, reason: 'invalidCreature' });
  assert.deepEqual(recordRelationshipDay({ relationshipDayKeys: 'nope' }, '2026-7-15'), { ok: false, reason: 'invalidCreature' });
  assert.deepEqual(recordRelationshipDay({ relationshipDayKeys: ['not-a-day-key'] }, '2026-7-15'), { ok: false, reason: 'invalidCreature' });
  assert.deepEqual(recordRelationshipDay(creature(), 'not-a-day-key'), { ok: false, reason: 'invalidLocalDayKey' });
  assert.deepEqual(recordRelationshipDay(creature(), 42), { ok: false, reason: 'invalidLocalDayKey' });
  assert.deepEqual(recordRelationshipDay(creature(), null), { ok: false, reason: 'invalidLocalDayKey' });
  assert.deepEqual(recordRelationshipDay(), { ok: false, reason: 'invalidCreature' });
});

// --- non-ranked / no strength ---------------------------------------------------

test('a successful recordRelationshipDay result contains only day-key/index/response fields, never CP or stats', () => {
  const result = recordRelationshipDay(creature(), '2026-7-15');
  assert.deepEqual(Object.keys(result).sort(), ['changed', 'dayIndex', 'localDayKey', 'ok', 'relationshipDayKeys', 'responseId'].sort());
  for (const key of Object.keys(result)) {
    assert.equal(/cp|stat|power|stage/i.test(key), false);
  }
});

test('the response objects returned by this module are shaped only as icon/id/text content, never as stats', () => {
  const response = nextRelationshipResponse(0);
  assert.deepEqual(Object.keys(response).sort(), ['icon', 'id', 'text']);
  const current = currentRelationshipResponse(creature({ relationshipDayKeys: ['2026-7-15'] }));
  assert.deepEqual(Object.keys(current).sort(), ['icon', 'id', 'text']);
});

// --- nextRelationshipResponse ---------------------------------------------------

test('nextRelationshipResponse returns a structuredClone, independent of the content module', () => {
  const response = nextRelationshipResponse(0);
  response.text = 'mutated';
  assert.notEqual(RESPONSES[0].text, 'mutated');
});

test('nextRelationshipResponse rejects malformed input without throwing', () => {
  assert.equal(nextRelationshipResponse(-1), null);
  assert.equal(nextRelationshipResponse(1.5), null);
  assert.equal(nextRelationshipResponse('0'), null);
  assert.equal(nextRelationshipResponse(null), null);
  assert.equal(nextRelationshipResponse(0, []), null);
  assert.equal(nextRelationshipResponse(0, null), null);
  assert.equal(nextRelationshipResponse(0, {}), null);
});

// --- relationshipLevel ---------------------------------------------------

test('relationshipLevel counts distinct relationship days', () => {
  assert.equal(relationshipLevel(creature()), 0);
  assert.equal(relationshipLevel(creature({ relationshipDayKeys: ['2026-7-15'] })), 1);
  assert.equal(relationshipLevel(creature({ relationshipDayKeys: ['2026-7-15', '2026-7-16', '2026-7-17'] })), 3);
});

test('relationshipLevel returns 0 for malformed input without throwing', () => {
  assert.equal(relationshipLevel(null), 0);
  assert.equal(relationshipLevel({}), 0);
  assert.equal(relationshipLevel({ relationshipDayKeys: ['bad'] }), 0);
  assert.equal(relationshipLevel({ relationshipDayKeys: 'nope' }), 0);
  assert.equal(relationshipLevel(undefined), 0);
});

// --- currentRelationshipResponse ---------------------------------------------------

test('currentRelationshipResponse returns null at level 0 and the most-recent day response otherwise', () => {
  assert.equal(currentRelationshipResponse(creature()), null);
  const oneDay = currentRelationshipResponse(creature({ relationshipDayKeys: ['2026-7-15'] }));
  assert.equal(oneDay.id, RESPONSES[0].id);
  const threeDays = currentRelationshipResponse(creature({
    relationshipDayKeys: ['2026-7-15', '2026-7-16', '2026-7-17']
  }));
  assert.equal(threeDays.id, RESPONSES[2].id);
});

test('currentRelationshipResponse wraps around at the end of the response list', () => {
  const dayKeys = Array.from({ length: RESPONSES.length + 1 }, (_, index) => `2026-7-${index + 1}`);
  const wrapped = currentRelationshipResponse(creature({ relationshipDayKeys: dayKeys }));
  assert.equal(wrapped.id, RESPONSES[0].id);
});

test('currentRelationshipResponse never throws for malformed input', () => {
  assert.equal(currentRelationshipResponse(null), null);
  assert.equal(currentRelationshipResponse({}), null);
  assert.equal(currentRelationshipResponse(creature({ relationshipDayKeys: ['2026-7-15'] }), []), null);
  assert.equal(currentRelationshipResponse(creature({ relationshipDayKeys: ['2026-7-15'] }), null), null);
});

// --- shouldMarkFinished ---------------------------------------------------

test('shouldMarkFinished is true only on the reading-to-finished transition', () => {
  assert.equal(shouldMarkFinished(creature({ finished: false }), 'finished'), true);
  assert.equal(shouldMarkFinished(creature({ finished: true }), 'finished'), false);
  assert.equal(shouldMarkFinished(creature({ finished: false }), 'reading'), false);
  assert.equal(shouldMarkFinished(creature({ finished: false }), 'paused'), false);
  assert.equal(shouldMarkFinished(creature({ finished: false }), 'not_for_me'), false);
});

test('finished is permanent: once true, later statuses never flip it back to a mark-finished transition', () => {
  const finishedCreature = creature({ finished: true });
  assert.equal(shouldMarkFinished(finishedCreature, 'finished'), false);
  assert.equal(shouldMarkFinished(finishedCreature, 'paused'), false);
  assert.equal(shouldMarkFinished(finishedCreature, 'not_for_me'), false);
  assert.equal(shouldMarkFinished(finishedCreature, 'reading'), false);
});

test('shouldMarkFinished never throws for malformed input', () => {
  assert.equal(shouldMarkFinished(null, 'finished'), false);
  assert.equal(shouldMarkFinished(undefined, 'finished'), false);
  assert.equal(shouldMarkFinished('creature', 'finished'), false);
  assert.equal(shouldMarkFinished({}, 'finished'), true);
  assert.equal(shouldMarkFinished(creature(), undefined), false);
  assert.equal(shouldMarkFinished(creature(), 42), false);
});

// --- finishedResponse ---------------------------------------------------

test('finishedResponse returns a structuredClone of the configured finished response', () => {
  const response = finishedResponse();
  assert.deepEqual(response, content.relationship.finishedResponse);
  response.text = 'mutated';
  assert.notEqual(content.relationship.finishedResponse.text, 'mutated');
});

test('finishedResponse guards against missing content without throwing', () => {
  assert.equal(finishedResponse(null), null);
  assert.equal(finishedResponse({}), null);
  assert.equal(finishedResponse({ finishedResponse: null }), null);
  assert.equal(finishedResponse('nope'), null);
});

test('finishedResponse falls back to the real content when called with no argument', () => {
  assert.deepEqual(finishedResponse(), content.relationship.finishedResponse);
});

// --- validateRelationshipContent ---------------------------------------------------

test('validateRelationshipContent accepts the real content.relationship.responses', () => {
  assert.equal(validateRelationshipContent(RESPONSES), true);
});

test('validateRelationshipContent rejects an empty array, duplicate ids, and non-object entries', () => {
  assert.equal(validateRelationshipContent([]), false);
  assert.equal(validateRelationshipContent([{ id: 'a' }, { id: 'a' }]), false);
  assert.equal(validateRelationshipContent([{ id: 'a' }, 'not-an-object']), false);
  assert.equal(validateRelationshipContent([{ id: '' }]), false);
  assert.equal(validateRelationshipContent([{ notAnId: 'a' }]), false);
  assert.equal(validateRelationshipContent(null), false);
  assert.equal(validateRelationshipContent('nope'), false);
  assert.equal(validateRelationshipContent(undefined), false);
});
