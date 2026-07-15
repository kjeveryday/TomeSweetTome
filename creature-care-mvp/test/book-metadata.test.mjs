import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMetadataResult } from '../src/providers.js';
import {
  lookupBookMetadata,
  lookupBookMetadataResult,
  normalizeTitleAuthorQuery,
  searchBookMetadataResult,
  mapBookMetadata,
  enrichCreatureWithBookData,
  enrichCreatureWithMetadataResult
} from '../src/systems/book-metadata.js';

test('title and author query normalization is deterministic without lowercasing display input', () => {
  const composed = normalizeTitleAuthorQuery({ title: '  The\u00a0Book  ', author: ' ADA   Author ' });
  const compatibility = normalizeTitleAuthorQuery({ title: 'Ｔｈｅ Book', author: 'Ada Author' });
  assert.deepEqual(composed, {
    ok: true,
    title: 'The Book',
    author: 'ADA Author',
    comparisonKey: 'the book\u0000ada author'
  });
  assert.equal(compatibility.comparisonKey, composed.comparisonKey);
  assert.equal(compatibility.title, 'The Book');
  assert.deepEqual(normalizeTitleAuthorQuery({ title: 'Book', author: '   ' }), {
    ok: false, reason: 'invalidBookSearch'
  });
});

test('title and author search uses one fetch and stable provider work and edition keys', async () => {
  let calls = 0;
  let requestedUrl;
  const fetchProvider = async (url) => {
    calls += 1;
    requestedUrl = new URL(url);
    return {
      ok: true,
      async json() {
        return {
          docs: [{
            key: '/works/OL123W',
            title: 'The Book',
            author_name: ['Ada Author'],
            edition_key: ['OL456M', 'OL789M'],
            first_publish_year: 2018,
            publisher: ['Sample Press']
          }]
        };
      }
    };
  };
  const result = await searchBookMetadataResult(
    { title: '  The   Book ', author: ' ADA Author ' }, fetchProvider, 123
  );
  assert.equal(calls, 1);
  assert.equal(requestedUrl.searchParams.get('title'), 'The Book');
  assert.equal(requestedUrl.searchParams.get('author'), 'ADA Author');
  assert.equal(result.source, 'live');
  assert.deepEqual(result.data.identity, {
    identityVersion: 'stacklings:work:v1', identityKey: '/works/OL123W'
  });
  assert.equal(result.data.work.id, 'work:provider:open-library:%2Fworks%2FOL123W');
  assert.equal(result.data.edition.id, 'edition:provider:open-library:OL456M');
  assert.equal(result.data.aliases[0].workId, result.data.work.id);
  assert.equal(result.data.editionAliases[0].editionId, result.data.edition.id);
  assert.equal(result.data.query.comparisonKey, 'the book\u0000ada author');
});

test('title and author search rejects missing or malformed matches without inventing identity', async () => {
  const responses = [
    { docs: [] },
    { docs: [{ key: '/works/OL123W', title: 'Other Book', author_name: ['Ada Author'], edition_key: ['OL456M'] }] },
    { docs: [{ key: '/works/not-stable', title: 'The Book', author_name: ['Ada Author'], edition_key: ['OL456M'] }] },
    { docs: [{ key: '/works/OL123W', title: 'The Book', author_name: ['Ada Author'], edition_key: [] }] },
    { notDocs: true }
  ];
  for (const payload of responses) {
    const result = await searchBookMetadataResult(
      { title: 'The Book', author: 'Ada Author' },
      async () => ({ ok: true, async json() { return payload; } }),
      0
    );
    assert.equal(result.source, 'unavailable');
    assert.equal(result.data, null);
    assert.ok(['not_found', 'malformed_result'].includes(result.errorCode));
  }
});

test('title and author search is unavailable-safe when the provider cannot run', async () => {
  const missing = await searchBookMetadataResult({ title: 'The Book', author: 'Ada Author' }, null, 0);
  assert.equal(missing.source, 'unavailable');
  assert.equal(missing.errorCode, 'provider_unavailable');
  const failed = await searchBookMetadataResult(
    { title: 'The Book', author: 'Ada Author' },
    async () => { throw new Error('offline'); },
    0
  );
  assert.equal(failed.source, 'unavailable');
  assert.equal(failed.data, null);
});

test('pinned MVP books include stable bibliographic data', async () => {
  const book = await lookupBookMetadata('9780064400558', () => {
    throw new Error('pinned records should not need the network');
  });
  assert.equal(book.title, "Charlotte's Web");
  assert.deepEqual(book.authors, ['E. B. White']);
  assert.equal(book.pageCount, 184);
  assert.equal(book.status, 'found');
});

test('pinned metadata is a valid deterministic fixture work and edition result', async () => {
  const result = await lookupBookMetadataResult('9780064400558', undefined, 0);
  assert.equal(isMetadataResult(result), true);
  assert.equal(result.source, 'fixture');
  assert.equal(result.data.work.metadataStatus, 'resolved');
  assert.deepEqual(result.data.aliases, [{ key: 'isbn13:9780064400558', workId: result.data.work.id }]);
});

test('missing provider returns an unavailable result without losing the ISBN path', async () => {
  const result = await lookupBookMetadataResult('9780306406157', null, 0);
  assert.equal(isMetadataResult(result), true);
  assert.equal(result.source, 'unavailable');
  assert.equal(result.data, null);
});

test('partial live metadata remains a valid work and edition result', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return { ok: true, async json() { return { 'ISBN:9780306406157': { title: 'Title only', key: '/books/OL1M' } }; } };
  };
  const result = await lookupBookMetadataResult('9780306406157', fakeFetch, 0);
  assert.equal(isMetadataResult(result), true);
  assert.equal(result.source, 'live');
  assert.equal(result.data.work.metadataStatus, 'partial');
  assert.equal(result.data.editionAliases[0].editionId, result.data.edition.id);
  const creature = enrichCreatureWithMetadataResult({ isbn: '9780306406157' }, result);
  assert.equal(creature.book.title, 'Title only');
  assert.equal(calls, 1);
});

test('book mappings explain the source, rule, result, and affected trait', async () => {
  const book = await lookupBookMetadata('9780399226908');
  const mappings = mapBookMetadata(book);
  assert.equal(mappings.length, 6);
  assert.ok(mappings.every((mapping) => mapping.source && mapping.rule && mapping.result && mapping.affects));
  assert.equal(mappings.find((mapping) => mapping.source === 'Page count').result, 'Tiny / fast-growing');
  assert.equal(mappings.find((mapping) => mapping.source === 'Physical format').result, 'Round, chunky body plan');
});

test('remote metadata is normalized and saved on the creature', async () => {
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return {
        'ISBN:9780306406157': {
          title: 'A Test Book',
          authors: [{ name: 'Ada Author' }],
          publishers: [{ name: 'Sample Press' }],
          publish_date: '2018',
          number_of_pages: 144,
          subjects: [{ name: 'Mystery fiction' }]
        }
      };
    }
  });
  const enriched = await enrichCreatureWithBookData({ isbn: '9780306406157', name: 'Tester' }, fakeFetch);
  assert.equal(enriched.book.title, 'A Test Book');
  assert.equal(enriched.bookMapping[0].result, 'Shade semantic element');
});
