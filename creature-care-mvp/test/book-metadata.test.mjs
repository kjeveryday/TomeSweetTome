import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupBookMetadata, mapBookMetadata, enrichCreatureWithBookData } from '../src/systems/book-metadata.js';

test('pinned MVP books include stable bibliographic data', async () => {
  const book = await lookupBookMetadata('9780064400558', () => {
    throw new Error('pinned records should not need the network');
  });
  assert.equal(book.title, "Charlotte's Web");
  assert.deepEqual(book.authors, ['E. B. White']);
  assert.equal(book.pageCount, 184);
  assert.equal(book.status, 'found');
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
