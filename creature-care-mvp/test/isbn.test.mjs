import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeIsbn,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13
} from '../src/systems/isbn.js';

test('ISBN-13 normalization accepts labels, spaces, and hyphens', () => {
  assert.deepEqual(canonicalizeIsbn('ISBN-13: 978-0-06-440055-8'), {
    ok: true, isbn: '9780064400558', source: 'isbn13'
  });
  assert.equal(isValidIsbn13('9780064400558'), true);
});

test('valid ISBN-10 converts to the canonical Bookland ISBN-13', () => {
  assert.equal(isValidIsbn10('0064400557'), true);
  assert.equal(isbn10To13('0064400557'), '9780064400558');
  assert.equal(canonicalizeIsbn('080442957x').isbn, '9780804429573');
});

test('invalid, malformed, and non-book codes are rejected precisely', () => {
  assert.equal(canonicalizeIsbn('').reason, 'empty');
  assert.equal(canonicalizeIsbn('9780064400557').reason, 'invalidChecksum');
  assert.equal(canonicalizeIsbn('0064400558').reason, 'invalidChecksum');
  assert.equal(canonicalizeIsbn('9780X64400558').reason, 'invalidChecksum');
  assert.equal(canonicalizeIsbn('9780_064400558').reason, 'invalidCharacters');
  assert.equal(canonicalizeIsbn('123').reason, 'wrongLength');
  assert.equal(canonicalizeIsbn('4006381333931').reason, 'notBookBarcode');
});

