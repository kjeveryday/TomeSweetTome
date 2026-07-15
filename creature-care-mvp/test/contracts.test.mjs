import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_VERSIONS,
  EVENT_PAYLOAD_VALIDATORS,
  SharedEventTypes,
  createBookEdition,
  createBookWork,
  createEventEnvelope,
  createPlayerAccess,
  creatureIdForIdentity,
  editionIdForIsbn,
  isBookEdition,
  isBookWork,
  isCreatureRecord,
  isEventEnvelope,
  isPlayerAccess,
  isReadingRecord,
  isbnAliasKey,
  providerEditionAliasKey,
  providerEditionId,
  providerWorkAliasKey,
  providerWorkId,
  workIdForIsbn
} from '../src/contracts.js';
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_NAMES,
  isFeatureFlagSet,
  resolveFeatureFlags
} from '../src/feature-flags.js';
import {
  AvailabilityStatuses,
  CatalogProvider,
  FixtureMetadataProvider,
  PatronActionStatuses,
  ProviderSources,
  isAvailabilityResult,
  isCatalogSearchResult,
  isMetadataResult,
  isPatronActionResult,
  isProviderHealthResponse,
  isRecommendationResult,
  isProviderResponse,
  providerResponse
} from '../src/providers.js';
import { createEventIdFactory, hatched } from '../src/events.js';

test('shared record identifiers are stable and keep legacy ISBN identity keys unchanged', () => {
  const isbn = '9780064400558';
  assert.equal(workIdForIsbn(isbn), `work:isbn:${isbn}`);
  assert.equal(editionIdForIsbn(isbn), `edition:isbn:${isbn}`);
  assert.equal(creatureIdForIdentity('stacklings:v1', isbn), 'creature:stacklings%3Av1:9780064400558');
  assert.equal(providerWorkId('open-library', 'OL1W'), 'work:provider:open-library:OL1W');
  assert.equal(providerEditionId('open-library', 'OL2M'), 'edition:provider:open-library:OL2M');
  assert.equal(isbnAliasKey(isbn), `isbn13:${isbn}`);
  assert.equal(providerWorkAliasKey('open-library', 'OL1W'), 'provider-work:open-library:OL1W');
  assert.equal(providerEditionAliasKey('open-library', 'OL2M'), 'provider-edition:open-library:OL2M');
});

test('BookWork and BookEdition contracts validate required fields and unique edition aliases', () => {
  const work = createBookWork({
    id: 'work:isbn:9780064400558',
    title: "Charlotte's Web",
    authors: ['E. B. White'],
    metadataStatus: 'resolved',
    editionIds: ['edition:isbn:9780064400558', 'edition:isbn:9780064400558']
  });
  const edition = createBookEdition({
    id: work.editionIds[0],
    workId: work.id,
    isbn13: '9780064400558',
    metadataSource: 'fixture:pinned-books'
  });
  assert.equal(work.editionIds.length, 1);
  assert.equal(isBookWork(work), true);
  assert.equal(isBookEdition(edition), true);
  assert.equal(isBookEdition({ ...edition, isbn13: 'not-an-isbn' }), false);
});

test('ReadingRecord accepts equivalent modes and private duration but rejects malformed values', () => {
  const base = {
    id: 'reading:1',
    workId: 'work:1',
    occurredAt: '2026-07-15T12:00:00.000Z',
    localDayKey: '2026-7-15'
  };
  for (const mode of ['independent', 'shared', 'read_aloud', 'listened']) {
    assert.equal(isReadingRecord({ ...base, mode }), true);
  }
  assert.equal(isReadingRecord({ ...base, durationSeconds: 0 }), true);
  assert.equal(isReadingRecord({ ...base, durationSeconds: -1 }), false);
  assert.equal(isReadingRecord({ ...base, mode: 'lesser_route' }), false);
});

test('CreatureRecord requires one work identity and unique relationship days', () => {
  const record = {
    id: 'creature:1',
    workId: 'work:1',
    identityVersion: 'stacklings:v1',
    identityKey: '9780064400558',
    baseTraits: { kind: 'book' },
    revealed: false,
    relationshipDayKeys: ['2026-7-15'],
    finished: false,
    careState: { status: 'uninitialized' }
  };
  assert.equal(isCreatureRecord(record), true);
  assert.equal(isCreatureRecord({ ...record, relationshipDayKeys: ['2026-7-15', '2026-7-15'] }), false);
  assert.equal(isCreatureRecord({ ...record, relationshipDayKeys: ['banana'] }), false);
  assert.equal(isCreatureRecord({ ...record, careState: {} }), false);
});

test('PlayerAccess keeps account and library status separate', () => {
  const access = createPlayerAccess();
  assert.deepEqual(access, { accountStatus: 'guest', libraryStatus: 'disconnected' });
  assert.equal(isPlayerAccess(access), true);
  assert.equal(isPlayerAccess({ accountStatus: 'guest', libraryStatus: 'connected' }), false);
  assert.equal(isPlayerAccess({ accountStatus: 'signed_in', libraryStatus: 'connected' }), true);
  assert.equal(isPlayerAccess({ accountStatus: 'public', libraryStatus: 'connected' }), false);
});

test('all approved shared event names have version 1 and enforce a stable envelope', () => {
  for (const type of Object.values(SharedEventTypes)) assert.equal(EVENT_VERSIONS[type], 1);
  const event = createEventEnvelope({
    id: 'reading:recorded:1',
    type: SharedEventTypes.ReadingRecorded,
    timestamp: 0,
    payload: { readingRecordId: 'reading:1', workId: 'work:1' }
  });
  assert.equal(isEventEnvelope(event), true);
  assert.equal(event.timestamp, '1970-01-01T00:00:00.000Z');
  assert.throws(() => createEventEnvelope({ ...event, version: 2 }), /Unsupported/);
  assert.throws(() => createEventEnvelope({ id: '', type: event.type, timestamp: 0 }), /Event id/);
});

test('every shared event v1 payload has an acceptance and rejection contract', () => {
  const payloads = {
    BookAdded: { workId: 'work:1', editionId: 'edition:1' },
    BookMetadataResolved: { workId: 'work:1', editionId: 'edition:1', metadataStatus: 'resolved', source: 'fixture' },
    BookWorkReconciled: { canonicalWorkId: 'work:1', aliasedWorkIds: ['work:old'], editionIds: ['edition:1'] },
    ReadingRecorded: { readingRecordId: 'reading:1', workId: 'work:1' },
    ReadingDayRecorded: { readingRecordId: 'reading:1', localDayKey: '2026-7-15' },
    BookStatusChanged: { workId: 'work:1', status: 'finished' },
    CreaturePreviewCreated: { creatureId: 'creature:1', workId: 'work:1' },
    CreatureRevealed: { creatureId: 'creature:1', workId: 'work:1', readingRecordId: 'reading:1' },
    CreatureRelationshipChanged: { creatureId: 'creature:1', workId: 'work:1', readingRecordId: 'reading:1', localDayKey: '2026-7-15', responseId: 'response:1' },
    ActiveCreatureChanged: { creatureId: 'creature:1' },
    CareActionPerformed: { actionId: 'feed', cpGranted: 1 },
    CareItemGranted: { grantId: 'grant:1', itemId: 'item:1', localDayKey: '2026-7-15', sourceReadingRecordId: 'reading:1' },
    CareItemUsed: { useId: 'use:1', itemId: 'item:1', creatureId: 'creature:1', actionId: 'feed', cpGranted: 0 },
    RecommendationRequested: { requestId: 'request:1', categoryIds: [] },
    RecommendationDelivered: { requestId: 'request:1', recommendationId: 'recommendation:1', source: 'fixture', workIds: ['work:1'], editionIds: ['edition:1'] },
    CatalogAvailabilityResolved: { editionId: 'edition:1', availabilityStatus: 'unknown', source: 'unavailable', checkedAt: '2026-07-15T12:00:00.000Z', officialUrl: 'https://example.test/catalog' },
    AccountSignedIn: { accountId: 'account:opaque' },
    LibraryConnected: { connectionStatus: 'connected', providerReference: 'provider:opaque' },
    EventRegistrationChanged: { eventId: 'program:1', accountId: 'account:1', administratorId: 'admin:1', registered: true },
    CommunityContributionRecorded: { eventId: 'program:1', accountId: 'account:1', localDayKey: '2026-7-15' }
  };
  for (const [type, validator] of Object.entries(EVENT_PAYLOAD_VALIDATORS)) {
    assert.equal(validator(payloads[type]), true, `${type} accepts its frozen payload`);
    assert.equal(validator({}), false, `${type} rejects a missing payload`);
    assert.equal(isEventEnvelope(createEventEnvelope({ id: `event:${type}`, type, timestamp: 0, payload: payloads[type] })), true);
  }
  assert.equal(EVENT_PAYLOAD_VALIDATORS.CareItemUsed({
    useId: 'use:2', itemId: 'item:1', creatureId: 'creature:1', actionId: 'play', cpGranted: 0
  }), false);
  assert.equal(EVENT_PAYLOAD_VALIDATORS.BookMetadataResolved({ ...payloads.BookMetadataResolved, source: 'mock' }), false);
  assert.equal(EVENT_PAYLOAD_VALIDATORS.RecommendationDelivered({ ...payloads.RecommendationDelivered, source: 'mock' }), false);
  assert.equal(EVENT_PAYLOAD_VALIDATORS.RecommendationDelivered({ ...payloads.RecommendationDelivered, source: 'unavailable' }), false);
  assert.equal(EVENT_PAYLOAD_VALIDATORS.CatalogAvailabilityResolved({
    ...payloads.CatalogAvailabilityResolved, source: 'unavailable', availabilityStatus: 'available'
  }), false);
});

test('existing v1 constructors carry versioned envelope fields without changing reducer fields', () => {
  const event = hatched(123, 'event:hatch:123');
  assert.equal(event.id, 'event:hatch:123');
  assert.equal(event.version, 1);
  assert.equal(event.at, 123);
  assert.deepEqual(event.payload, {});
  assert.equal(event.timestamp, '1970-01-01T00:00:00.123Z');
});

test('application event ID factory prevents same-millisecond compatibility collisions', () => {
  const nextId = createEventIdFactory('test-session');
  const first = nextId('CareActionPerformed', 1000);
  const second = nextId('CareActionPerformed', 1000);
  assert.notEqual(first, second);
  assert.match(first, /^event:test-session:1000:1:/);
  assert.match(second, /^event:test-session:1000:2:/);
});

test('feature flags freeze the approved names and safely ignore unknown overrides', () => {
  assert.deepEqual(FEATURE_FLAG_NAMES, [
    'timer', 'accounts', 'careItems', 'recommendationVisitors',
    'libraryCatalog', 'libraryPatronActions', 'communityEvents', 'researchSettings'
  ]);
  assert.equal(Object.values(DEFAULT_FEATURE_FLAGS).every((value) => value === false), true);
  const resolved = resolveFeatureFlags({ timer: true, communityEvents: 'yes', inventedMode: true });
  assert.equal(resolved.timer, true);
  assert.equal(resolved.communityEvents, false);
  assert.equal(Object.hasOwn(resolved, 'inventedMode'), false);
  assert.equal(isFeatureFlagSet(resolved), true);
  assert.equal(isFeatureFlagSet({ ...resolved, inventedMode: false }), false);
});

test('provider health and metadata fixture responses keep source, data, and unavailable states explicit', () => {
  const record = {
    work: createBookWork({ id: 'work:1', title: 'Fixture book', metadataStatus: 'partial', editionIds: ['edition:1'] }),
    edition: createBookEdition({ id: 'edition:1', workId: 'work:1', metadataSource: 'fixture' }),
    aliases: [{ key: 'isbn13:9780064400558', workId: 'work:1' }],
    provenance: { title: 'fixture' }
  };
  const provider = new FixtureMetadataProvider({ 'stacklings:v1:9780064400558': record });
  const found = provider.resolve({ identityVersion: 'stacklings:v1', identityKey: '9780064400558' }, 0);
  assert.equal(isMetadataResult(found), true);
  assert.equal(found.source, 'fixture');
  const missing = provider.resolve({ identityVersion: 'stacklings:v1', identityKey: '9780399226908' }, 0);
  assert.equal(isMetadataResult(missing), true);
  assert.equal(missing.source, 'unavailable');
  assert.equal(isProviderHealthResponse(provider.healthCheck(0)), true);
  assert.throws(() => provider.healthCheck('July 15, 2026'), /fetchedAt/);
  assert.equal(isMetadataResult({ ...found, data: { ...record, work: { ...record.work, editionIds: [] } } }), false);
  assert.equal(isMetadataResult({ ...found, data: { ...record, aliases: [{ key: 'invented:key', workId: 'work:1' }] } }), false);
  assert.equal(isMetadataResult({ ...found, data: { ...record, aliases: [record.aliases[0], record.aliases[0]] } }), false);
});

test('local day keys use the existing canonical non-padded device-local representation', () => {
  const base = {
    id: 'reading:canonical-day',
    workId: 'work:1',
    occurredAt: '2026-07-05T12:00:00.000Z',
    localDayKey: '2026-7-5'
  };
  assert.equal(isReadingRecord(base), true);
  assert.equal(isReadingRecord({ ...base, localDayKey: '2026-07-05' }), false);
  assert.throws(() => createEventEnvelope({
    id: 'event:noncanonical-time',
    type: SharedEventTypes.ReadingRecorded,
    timestamp: 'July 5, 2026',
    payload: { readingRecordId: base.id, workId: base.workId }
  }), /timestamp/);
});

test('availability failure is unknown with an official link and fixture data is labeled sample', () => {
  const baseData = {
    editionId: 'edition:1',
    status: AvailabilityStatuses.Unknown,
    checkedAt: '2026-07-15T12:00:00.000Z',
    officialUrl: 'https://example.test/catalog'
  };
  const unavailable = providerResponse({ source: 'unavailable', providerId: 'catalog:test', fetchedAt: 0, data: baseData, officialUrl: baseData.officialUrl });
  assert.equal(isAvailabilityResult(unavailable), true);
  assert.equal(isAvailabilityResult({ ...unavailable, data: { ...baseData, status: 'available' } }), false);
  const fixture = providerResponse({ source: 'fixture', providerId: 'catalog:test', fetchedAt: 0, data: { ...baseData, label: 'Sample availability' } });
  assert.equal(isAvailabilityResult(fixture), true);
  assert.equal(isAvailabilityResult({ ...fixture, data: { ...baseData } }), false);
});

test('catalog, recommendation, and patron results enforce their frozen Phase 1 failure labels', () => {
  const catalog = providerResponse({
    source: 'fixture', providerId: 'catalog:fixture', fetchedAt: 0,
    data: { items: [{ workId: 'work:1', editionId: 'edition:1', title: 'Book', authors: ['Author'], officialUrl: 'https://example.test/book' }] }
  });
  assert.equal(isCatalogSearchResult(catalog), true);
  assert.equal(isCatalogSearchResult({ ...catalog, data: { items: [{ ...catalog.data.items[0], officialUrl: 'javascript:bad' }] } }), false);

  const recommendation = providerResponse({
    source: 'fixture', providerId: 'recommendation:fixture', fetchedAt: 0,
    data: { requestId: 'request:1', recommendations: [{ id: 'recommendation:1', reason: 'A general fixture choice', workIds: ['work:1'], editionIds: ['edition:1'] }] }
  });
  assert.equal(isRecommendationResult(recommendation), true);
  assert.equal(isRecommendationResult({ ...recommendation, source: 'unavailable' }), false);
  assert.equal(isRecommendationResult({ ...recommendation, source: 'unavailable', data: { requestId: 'request:1', recommendations: [] } }), true);

  const patron = providerResponse({
    source: 'fixture', providerId: 'patron:fixture', fetchedAt: 0,
    data: { requestId: 'patron:1', status: PatronActionStatuses.Demonstration, officialUrl: 'https://example.test/library', label: 'Demonstration' }
  });
  assert.equal(isPatronActionResult(patron), true);
  assert.equal(isPatronActionResult({ ...patron, data: { ...patron.data, label: 'Live' } }), false);
});

test('provider source state is separate, explicit, and restricted to fixture/live/unavailable', () => {
  const fixture = providerResponse({
    source: ProviderSources.Fixture,
    providerId: 'catalog:fixture',
    fetchedAt: 0,
    data: { availabilityStatus: 'unknown' },
    officialUrl: 'https://example.test/catalog'
  });
  assert.equal(isProviderResponse(fixture), true);
  assert.equal(fixture.source, 'fixture');
  assert.equal(fixture.data.availabilityStatus, 'unknown');
  assert.throws(() => providerResponse({ source: 'mock', providerId: 'x', fetchedAt: 0 }), /Invalid provider source/);
});

test('provider interfaces fail explicitly until a fixture or approved adapter implements them', () => {
  const catalog = new CatalogProvider();
  assert.throws(() => catalog.search('book'), /not implemented/);
  assert.throws(() => catalog.getAvailability('edition:1'), /not implemented/);
  assert.throws(() => catalog.getBranches(), /not implemented/);
  assert.throws(() => catalog.healthCheck(), /not implemented/);
});
