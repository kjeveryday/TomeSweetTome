import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createBookEdition, createBookWork, isBookEdition, isBookWork, providerEditionAliasKey
} from '../src/contracts.js';
import { providerResponse } from '../src/providers.js';
import {
  createIsbnBookRecords,
  createProviderWorkBookRecords,
  reconcileBookWorkRouting,
  recordsById
} from '../src/systems/book-records.js';
import { searchBookMetadataResult } from '../src/systems/book-metadata.js';

test('canonical ISBN capture creates valid fallback work, edition, alias, and frozen identity', () => {
  const result = createIsbnBookRecords('ISBN-10: 0064400557');
  assert.equal(result.ok, true);
  assert.deepEqual(result.identity, { identityVersion: 'stacklings:v1', identityKey: '9780064400558' });
  assert.equal(result.work.id, 'work:isbn:9780064400558');
  assert.equal(result.edition.id, 'edition:isbn:9780064400558');
  assert.equal(isBookWork(result.work), true);
  assert.equal(isBookEdition(result.edition), true);
  assert.deepEqual(result.aliases, [{ key: 'isbn13:9780064400558', workId: result.work.id }]);
});

test('repeated ISBN normalization produces byte-identical record maps', () => {
  const first = recordsById(createIsbnBookRecords('978-0-06-440055-8'));
  const second = recordsById(createIsbnBookRecords('0064400557'));
  assert.deepEqual(second, first);
});

test('valid metadata candidates replace fallback records without changing the ISBN identity', () => {
  const work = createBookWork({ id: 'work:provider:open-library:OL1W', title: 'Book', authors: ['Author'], metadataStatus: 'resolved', editionIds: ['edition:provider:open-library:OL1M'] });
  const edition = createBookEdition({ id: 'edition:provider:open-library:OL1M', workId: work.id, isbn13: '9780064400558', metadataSource: 'fixture' });
  const metadata = providerResponse({
    source: 'fixture', providerId: 'metadata:test', fetchedAt: 0,
    data: {
      work, edition,
      aliases: [{ key: 'isbn13:9780064400558', workId: work.id }],
      editionAliases: [{ key: providerEditionAliasKey('test', 'edition-1'), editionId: edition.id }],
      provenance: { title: 'fixture' }
    }
  });
  const result = createIsbnBookRecords('9780064400558', metadata);
  assert.equal(result.ok, true);
  assert.equal(result.work.id, work.id);
  assert.equal(result.identity.identityKey, '9780064400558');
  assert.equal(recordsById(result).editionAliases['provider-edition:test:edition-1'], edition.id);
});

test('unavailable metadata keeps valid unknown fallback records', () => {
  const unavailable = providerResponse({ source: 'unavailable', providerId: 'metadata:test', fetchedAt: 0, data: null });
  const result = createIsbnBookRecords('9780064400558', unavailable);
  assert.equal(result.ok, true);
  assert.equal(result.work.metadataStatus, 'unknown');
  assert.equal(result.edition.metadataSource, 'unavailable');
});

test('provider work search records preserve the provider work identity and edition routing', async () => {
  const metadata = await searchBookMetadataResult(
    { title: 'The Book', author: 'Ada Author' },
    async () => ({
      ok: true,
      async json() {
        return { docs: [{ key: '/works/OL123W', title: 'The Book', author_name: ['Ada Author'], edition_key: ['OL456M'] }] };
      }
    }),
    42
  );
  const result = createProviderWorkBookRecords(metadata);
  assert.equal(result.ok, true);
  assert.deepEqual(result.identity, { identityVersion: 'stacklings:work:v1', identityKey: '/works/OL123W' });
  assert.equal(result.edition.isbn13, undefined);
  assert.equal(result.provenance.source, 'live');
  assert.equal(recordsById(result).editionAliases['provider-edition:open-library:OL456M'], result.edition.id);
});

test('provider work record conversion fails safely for unavailable or malformed results', () => {
  const unavailable = providerResponse({
    source: 'unavailable', providerId: 'metadata:open-library-search', fetchedAt: 0, data: null
  });
  assert.deepEqual(createProviderWorkBookRecords(unavailable), { ok: false, reason: 'metadataUnavailable' });
  assert.deepEqual(createProviderWorkBookRecords({}), { ok: false, reason: 'invalidBookRecords' });
});

test('metadata candidates must retain the captured ISBN alias', () => {
  const work = createBookWork({ id: 'work:1', metadataStatus: 'partial', editionIds: ['edition:1'] });
  const edition = createBookEdition({ id: 'edition:1', workId: work.id, metadataSource: 'fixture' });
  const metadata = providerResponse({
    source: 'fixture', providerId: 'metadata:test', fetchedAt: 0,
    data: { work, edition, aliases: [], editionAliases: [], provenance: {} }
  });
  assert.equal(createIsbnBookRecords('9780064400558', metadata).reason, 'missingIsbnAlias');
});

test('metadata cannot route a captured ISBN to a conflicting edition ISBN', () => {
  const work = createBookWork({ id: 'work:1', metadataStatus: 'partial', editionIds: ['edition:1'] });
  const edition = createBookEdition({ id: 'edition:1', workId: work.id, isbn13: '9780399226908', metadataSource: 'fixture' });
  const metadata = providerResponse({
    source: 'fixture', providerId: 'metadata:test', fetchedAt: 0,
    data: { work, edition, aliases: [{ key: 'isbn13:9780064400558', workId: work.id }], editionAliases: [], provenance: {} }
  });
  assert.equal(createIsbnBookRecords('9780064400558', metadata).reason, 'editionIsbnMismatch');
});

test('malformed metadata data fails safely without throwing', () => {
  const malformed = [
    null,
    {},
    { work: null, edition: null, aliases: [] },
    { work: {}, edition: {}, aliases: 'not-an-array', provenance: {} },
    { work: createBookWork({ id: 'work:1' }), edition: null, aliases: [], provenance: {} }
  ];
  for (const data of malformed) {
    const response = providerResponse({ source: 'fixture', providerId: 'metadata:test', fetchedAt: 0, data });
    let result;
    assert.doesNotThrow(() => { result = createIsbnBookRecords('9780064400558', response); });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalidBookRecords');
  }

  const uncloneable = {
    source: 'fixture',
    providerId: 'metadata:test',
    fetchedAt: '1970-01-01T00:00:00.000Z',
    data: {
      work: createBookWork({ id: 'work:1', editionIds: ['edition:1'] }),
      edition: createBookEdition({ id: 'edition:1', workId: 'work:1', metadataSource: 'fixture' }),
      aliases: [{ key: 'isbn13:9780064400558', workId: 'work:1' }],
      editionAliases: [],
      provenance: { invalid: () => {} }
    }
  };
  assert.doesNotThrow(() => {
    assert.equal(createIsbnBookRecords('9780064400558', uncloneable).reason, 'invalidBookRecords');
  });
});

function reconciliationFixture() {
  const canonical = createBookWork({ id: 'work:canonical', title: 'Book', metadataStatus: 'resolved', editionIds: ['edition:a'] });
  const alias = createBookWork({ id: 'work:alias', title: 'Book edition', metadataStatus: 'partial', editionIds: ['edition:b'] });
  return {
    works: { [canonical.id]: canonical, [alias.id]: alias },
    editions: {
      'edition:a': createBookEdition({ id: 'edition:a', workId: canonical.id, isbn13: '9780064400558', metadataSource: 'fixture' }),
      'edition:b': createBookEdition({ id: 'edition:b', workId: alias.id, isbn13: '9780399226908', metadataSource: 'fixture' })
    },
    aliases: {
      'isbn13:9780064400558': canonical.id,
      'isbn13:9780399226908': alias.id
    },
    editionAliases: {}
  };
}

test('safe reconciliation reroutes editions and aliases idempotently while preserving identity inputs', () => {
  const records = reconciliationFixture();
  const creature = { id: 'creature:b', workId: 'work:alias', identityVersion: 'stacklings:v1', identityKey: '9780399226908' };
  const before = structuredClone(creature);
  const first = reconcileBookWorkRouting(records, {
    canonicalWorkId: 'work:canonical', aliasedWorkIds: ['work:alias'], ownedCreatures: [creature]
  });
  assert.equal(first.ok, true);
  assert.deepEqual(creature, before);
  assert.equal(first.records.editions['edition:b'].workId, 'work:canonical');
  assert.equal(first.records.aliases['isbn13:9780399226908'], 'work:canonical');
  assert.equal(Object.hasOwn(first.records.works, 'work:alias'), false);
  assert.deepEqual(first.creatureWorkUpdates, [{ creatureId: creature.id, workId: 'work:canonical' }]);
  assert.deepEqual(first.preservedIdentities, [{ creatureId: creature.id, identityVersion: creature.identityVersion, identityKey: creature.identityKey }]);

  const second = reconcileBookWorkRouting(first.records, {
    canonicalWorkId: 'work:canonical', aliasedWorkIds: ['work:alias'], ownedCreatures: [creature]
  });
  assert.equal(second.ok, true);
  assert.deepEqual(second.records, first.records);
});

test('reconciliation preserves two owned identities and routes both creatures to the canonical work', () => {
  const records = reconciliationFixture();
  const creatures = [
    { id: 'creature:a', workId: 'work:canonical', identityVersion: 'stacklings:v1', identityKey: '9780064400558' },
    { id: 'creature:b', workId: 'work:alias', identityVersion: 'stacklings:v1', identityKey: '9780399226908' }
  ];
  const result = reconcileBookWorkRouting(records, {
    canonicalWorkId: 'work:canonical',
    aliasedWorkIds: ['work:alias'],
    ownedCreatures: creatures
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.creatureWorkUpdates, [
    { creatureId: 'creature:a', workId: 'work:canonical' },
    { creatureId: 'creature:b', workId: 'work:canonical' }
  ]);
  assert.deepEqual(result.preservedIdentities, creatures.map(({ id, identityVersion, identityKey }) => ({
    creatureId: id, identityVersion, identityKey
  })));
  assert.equal(Object.hasOwn(result.records.works, 'work:alias'), false);
});
