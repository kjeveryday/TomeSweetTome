// INDEPENDENT VERIFICATION — ISBN / book-creature generator.
//
// Adversarial companion to isbn.test.mjs, barcode.test.mjs, generation.test.mjs,
// book-creature.test.mjs, and book-metadata.test.mjs. This file does not trust the
// source's own internal helpers as oracles: seed hashing is recomputed with
// node:crypto, the ISBN-13 check-digit algorithm is reimplemented independently,
// and field selection is re-derived with Buffer arithmetic rather than reusing
// generation.js's own bit-shifting. Where this file's independent computation
// disagrees with source, the test documents the actual (possibly wrong) behavior
// rather than being adjusted to match — see the final report for any such cases.
//
// Per the review charter: this file MUST NOT modify any existing source or test
// file, and MUST be run in isolation: `node --test test/verify-isbn.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import content from '../src/content.json' with { type: 'json' };
import {
  canonicalizeIsbn,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  isbn13CheckDigit
} from '../src/systems/isbn.js';
import { generateCreature, rarityFor } from '../src/systems/generation.js';
import { decodeBookBarcode } from '../src/systems/barcode.js';
import { applyEvent, initialState } from '../src/state.js';
import { EventTypes, LocalRecommendationEventTypes, creatureGenerated, hatched } from '../src/events.js';
import { SharedEventTypes } from '../src/contracts.js';

// ---------------------------------------------------------------------------
// Independent oracles (deliberately NOT calling into src/systems/isbn.js or
// src/systems/generation.js for the arithmetic itself — only for the values
// under test).
// ---------------------------------------------------------------------------

// Standard ISBN-13 / EAN-13 check-digit algorithm, reimplemented from the public
// specification (not copied from isbn13CheckDigit) so it can serve as a real
// second opinion rather than restating the source's own code.
function independentCheckDigit13(twelveDigits) {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const weight = index % 2 === 0 ? 1 : 3;
    sum += Number(twelveDigits[index]) * weight;
  }
  return String((10 - (sum % 10)) % 10);
}

function buildValidIsbn13(prefix3, rest9) {
  const twelve = `${prefix3}${rest9}`;
  return `${twelve}${independentCheckDigit13(twelve)}`;
}

// Deterministic synthetic batch: 40 well-formed 978-prefixed and 10 well-formed
// 979-prefixed ISBN-13s, none of which are hardcoded magic numbers — each is
// built from this file's own check-digit function, independent of isbn.js.
const SYNTHETIC_978 = Array.from({ length: 40 }, (_, i) =>
  buildValidIsbn13('978', String(1000000 + i * 137).padStart(9, '0')));
const SYNTHETIC_979 = Array.from({ length: 10 }, (_, i) =>
  buildValidIsbn13('979', String(2000000 + i * 251).padStart(9, '0')));
const SYNTHETIC_BATCH = [...SYNTHETIC_978, ...SYNTHETIC_979];

const KNOWN_FIXTURES = ['9780064400558', '9780399226908', '9780590353403'];

// Re-derives every generated field from raw SHA-256 bytes using Buffer reads
// (Node's own big-endian integer reader), independent of generation.js's
// hand-rolled readUint32/hex32 helpers.
function independentGeneration(isbn) {
  const seedVersion = content.generation.seedVersion;
  const digest = createHash('sha256').update(`${seedVersion}:${isbn}`, 'utf8').digest();
  const seedHex = digest.toString('hex').slice(0, 24);
  const speciesSeed = digest.readUInt32BE(0);
  const individualSeed = digest.readUInt32BE(4);
  const raritySeed = digest.readUInt32BE(8);

  const g = content.generation;
  const familyId = g.families[speciesSeed % g.families.length].id;
  const paletteId = g.palettes[(individualSeed & 0x1f) % g.palettes.length].id;
  const patternId = g.patterns[(speciesSeed >>> 8) % g.patterns.length].id;
  const voiceId = g.voices[((individualSeed >>> 21) & 0x07) % g.voices.length].id;
  const idleId = g.idles[((individualSeed >>> 24) & 0x03) % g.idles.length].id;
  const quirkId = g.quirks[((individualSeed >>> 26) & 0x0f) % g.quirks.length].id;
  const rarityRoll = raritySeed % g.rarityRollRange;
  const rarityId = (g.rarities.find((r) => rarityRoll < r.maxExclusive) ?? g.rarities.at(-1)).id;

  const prefix = g.namePrefixes[digest[12] % g.namePrefixes.length];
  const suffix = g.nameSuffixes[digest[13] % g.nameSuffixes.length];
  const overlaps = prefix.at(-1).toLowerCase() === suffix[0].toLowerCase();
  const name = `${overlaps ? prefix.slice(0, -1) : prefix}${suffix}`;

  return { seedHex, familyId, paletteId, patternId, voiceId, idleId, quirkId, rarityId, rarityRoll, name };
}

function findUndefinedPaths(value, path = '$') {
  if (value === undefined) return [path];
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => findUndefinedPaths(v, `${path}.${key}`));
}

// =============================================================================
// A. ISBN validation — rejection and acceptance corners
// =============================================================================

test('rejects all-numeric strings of the wrong length (9, 11, 12, 14 digits)', () => {
  assert.equal(canonicalizeIsbn('978006440').reason, 'wrongLength'); // 9
  assert.equal(canonicalizeIsbn('97800644005').reason, 'wrongLength'); // 11
  assert.equal(canonicalizeIsbn('978006440055').reason, 'wrongLength'); // 12
  assert.equal(canonicalizeIsbn('97800644005580').reason, 'wrongLength'); // 14
});

test('rejects a checksum-valid 13-digit code whose prefix is neither 978 nor 979', () => {
  // All-zero: checksum trivially valid (0), prefix is "000".
  assert.deepEqual(canonicalizeIsbn('0000000000000'), { ok: false, reason: 'notBookBarcode' });
  // A well-formed, checksum-valid EAN-13 built with prefix 977 (ISSN/serials range).
  const notABook = buildValidIsbn13('977', '000000000');
  assert.equal(isValidIsbn13(notABook), true, 'sanity: this vector must be checksum-valid');
  assert.deepEqual(canonicalizeIsbn(notABook), { ok: false, reason: 'notBookBarcode' });
});

test('accepts a well-formed 979-prefixed ISBN-13 (not just 978)', () => {
  const isbn979 = buildValidIsbn13('979', '852100000');
  assert.deepEqual(canonicalizeIsbn(isbn979), { ok: true, isbn: isbn979, source: 'isbn13' });
});

test('rejects a 979-prefixed 13-digit code with a corrupted check digit', () => {
  const isbn979 = buildValidIsbn13('979', '852100000');
  const corrupted = isbn979.slice(0, 12) + String((Number(isbn979[12]) + 1) % 10);
  assert.equal(canonicalizeIsbn(corrupted).reason, 'invalidChecksum');
});

test('rejects non-digit characters, including a realistic "(pbk.)" cataloging suffix', () => {
  assert.equal(canonicalizeIsbn('9780064400558 (pbk.)').reason, 'invalidCharacters');
  assert.equal(canonicalizeIsbn('9780_064400558').reason, 'invalidCharacters');
  assert.equal(canonicalizeIsbn('9780O64400558').reason, 'invalidCharacters'); // letter O, not zero
});

test('an ISBN-10 check character "X" is only valid in the final position', () => {
  // X moved to the front of an otherwise plausible 10-character candidate.
  assert.equal(canonicalizeIsbn('X064400557').reason, 'invalidChecksum');
});

test('ISBN-10 check character X is accepted identically in upper and lower case', () => {
  const lower = canonicalizeIsbn('080442957x');
  const upper = canonicalizeIsbn('080442957X');
  assert.equal(lower.ok, true);
  assert.deepEqual(lower, upper);
});

test('isValidIsbn10 exported directly is case-sensitive; canonicalizeIsbn compensates by uppercasing first', () => {
  // Documents a real nuance: the low-level exported helper only recognizes
  // uppercase X. This is not a defect in canonicalizeIsbn's public contract
  // (it uppercases before delegating), but a caller invoking isValidIsbn10
  // directly with a lowercase isbn must uppercase it first.
  assert.equal(isValidIsbn10('080442957x'), false);
  assert.equal(isValidIsbn10('080442957X'), true);
});

test('label stripping accepts "ISBN:", "ISBN-13:", and "ISBN-10:" but not hyphen-less "ISBN13:"', () => {
  assert.deepEqual(canonicalizeIsbn('ISBN: 9780064400558'), { ok: true, isbn: '9780064400558', source: 'isbn13' });
  assert.deepEqual(canonicalizeIsbn('ISBN-13: 9780064400558'), { ok: true, isbn: '9780064400558', source: 'isbn13' });
  assert.equal(canonicalizeIsbn('ISBN-10: 0064400557').source, 'isbn10');
  // SPEC AMBIGUITY (documented, not scored as a defect — see final report):
  // the label regex is `^ISBN(?:-1[03])?\s*:?\s*`, which requires a literal
  // hyphen between "ISBN" and "13"/"10". Without it, "ISBN" alone is consumed
  // as the label and the leftover "13: 9780064400558" fails the character
  // class on ':', producing invalidCharacters rather than a parsed ISBN.
  assert.equal(canonicalizeIsbn('ISBN13: 9780064400558').reason, 'invalidCharacters');
});

test('internal tabs, newlines, and doubled hyphens are all treated as ignorable separators', () => {
  assert.equal(canonicalizeIsbn('978\t0-06-440055--8').isbn, '9780064400558');
  assert.equal(canonicalizeIsbn('978-0-06\n-440055-8').isbn, '9780064400558');
  assert.equal(canonicalizeIsbn('  ISBN-13:978-0-06-440055-8  ').isbn, '9780064400558');
});

test('empty and whitespace-only input are rejected as "empty", distinct from other failures', () => {
  assert.equal(canonicalizeIsbn('').reason, 'empty');
  assert.equal(canonicalizeIsbn('   ').reason, 'empty');
  assert.equal(canonicalizeIsbn(null).reason, 'empty');
  assert.equal(canonicalizeIsbn(undefined).reason, 'empty');
});

test('non-string input types are coerced rather than crashing (defensive contract)', () => {
  // A raw JS number, as might arrive from a careless caller.
  assert.deepEqual(canonicalizeIsbn(9780064400558), { ok: true, isbn: '9780064400558', source: 'isbn13' });
});

test('independent ISBN-13 check-digit computation matches source for boundary vectors', () => {
  const vectors = ['000000000000', '999999999999', '978006440055', '978039922690', '979852100000'];
  for (const twelve of vectors) {
    assert.equal(
      isbn13CheckDigit(twelve),
      independentCheckDigit13(twelve),
      `check digit for ${twelve} should match the independently computed value`
    );
  }
});

test('isbn10To13 always yields a 978-prefixed ISBN-13 (correct: ISBN-10 predates the 979 range)', () => {
  assert.equal(isValidIsbn10('0064400557'), true);
  const converted = isbn10To13('0064400557');
  assert.equal(converted, '9780064400558');
  assert.equal(converted.startsWith('978'), true);
  assert.equal(isValidIsbn13(converted), true);
});

// =============================================================================
// B. Determinism and the exact seed prefix
// =============================================================================

test('the same edition is byte-identical across ISBN-13, ISBN-10, and labeled/hyphenated input forms', async () => {
  const viaIsbn13 = await generateCreature('9780064400558');
  const viaIsbn10 = await generateCreature('0064400557');
  const viaLabel = await generateCreature('ISBN-13: 978-0-06-440055-8');
  const repeat = await generateCreature('9780064400558');
  assert.equal(viaIsbn13.ok, true);
  assert.deepEqual(viaIsbn10, viaIsbn13);
  assert.deepEqual(viaLabel, viaIsbn13);
  assert.deepEqual(repeat, viaIsbn13);
});

test('creature.seed is exactly the first 24 hex chars of SHA-256("stacklings:v1:" + isbn13), independently recomputed', async () => {
  for (const isbn of [...KNOWN_FIXTURES, ...SYNTHETIC_BATCH]) {
    const expected = createHash('sha256').update(`stacklings:v1:${isbn}`, 'utf8').digest('hex').slice(0, 24);
    const { creature } = await generateCreature(isbn);
    assert.equal(creature.seed, expected, `seed mismatch for ${isbn}`);
  }
});

test('the seed prefix is load-bearing: near-miss prefixes (wrong case, missing colon, wrong version) do not match', async () => {
  const isbn = '9780064400558';
  const { creature } = await generateCreature(isbn);
  const wrongCase = createHash('sha256').update(`Stacklings:v1:${isbn}`, 'utf8').digest('hex').slice(0, 24);
  const missingColon = createHash('sha256').update(`stacklings:v1${isbn}`, 'utf8').digest('hex').slice(0, 24);
  const wrongVersion = createHash('sha256').update(`stacklings:v2:${isbn}`, 'utf8').digest('hex').slice(0, 24);
  const noSeparatorAtAll = createHash('sha256').update(`stacklingsv1${isbn}`, 'utf8').digest('hex').slice(0, 24);
  assert.notEqual(creature.seed, wrongCase);
  assert.notEqual(creature.seed, missingColon);
  assert.notEqual(creature.seed, wrongVersion);
  assert.notEqual(creature.seed, noSeparatorAtAll);
  // And the correct exact prefix does match, closing the loop.
  const correct = createHash('sha256').update(`stacklings:v1:${isbn}`, 'utf8').digest('hex').slice(0, 24);
  assert.equal(creature.seed, correct);
});

test('content.json pins the seed version to exactly "stacklings:v1" and the creature echoes it verbatim', async () => {
  assert.equal(content.generation.seedVersion, 'stacklings:v1');
  assert.equal(content.generation.hashAlgorithm, 'SHA-256');
  const { creature } = await generateCreature('9780064400558');
  assert.equal(creature.seedVersion, 'stacklings:v1');
  assert.equal(creature.hashAlgorithm, 'SHA-256');
});

// =============================================================================
// C. Field mapping, constrained sets, and distribution
// =============================================================================

test('every selected field for a batch of valid ISBNs matches an independently re-derived index (Buffer-based, not source bit-math)', async () => {
  for (const isbn of [...KNOWN_FIXTURES, ...SYNTHETIC_BATCH]) {
    const { creature } = await generateCreature(isbn);
    const ind = independentGeneration(isbn);
    assert.equal(creature.seed, ind.seedHex, `seed for ${isbn}`);
    assert.equal(creature.family.id, ind.familyId, `family for ${isbn}`);
    assert.equal(creature.palette.id, ind.paletteId, `palette for ${isbn}`);
    assert.equal(creature.pattern.id, ind.patternId, `pattern for ${isbn}`);
    assert.equal(creature.voice.id, ind.voiceId, `voice for ${isbn}`);
    assert.equal(creature.idle.id, ind.idleId, `idle for ${isbn}`);
    assert.equal(creature.quirk.id, ind.quirkId, `quirk for ${isbn}`);
    assert.equal(creature.rarity.id, ind.rarityId, `rarity for ${isbn}`);
    assert.equal(creature.rarity.roll, ind.rarityRoll, `rarity roll for ${isbn}`);
    assert.equal(creature.name, ind.name, `name for ${isbn}`);
  }
});

test('no generated creature field is ever undefined, and every selection is a defined content.json entry', async () => {
  const g = content.generation;
  const familyIds = new Set(g.families.map((f) => f.id));
  const paletteIds = new Set(g.palettes.map((p) => p.id));
  const patternIds = new Set(g.patterns.map((p) => p.id));
  const voiceIds = new Set(g.voices.map((v) => v.id));
  const idleIds = new Set(g.idles.map((i) => i.id));
  const quirkIds = new Set(g.quirks.map((q) => q.id));
  const rarityIds = new Set(g.rarities.map((r) => r.id));
  const publisherLabels = new Set([...g.publishers.map((p) => p.label), g.defaultPublisher.label]);
  const languageIds = new Set([...Object.values(g.languageGroups).map((l) => l.id), g.defaultLanguageGroup.id]);

  for (const isbn of [...KNOWN_FIXTURES, ...SYNTHETIC_BATCH]) {
    const { creature } = await generateCreature(isbn);
    assert.deepEqual(findUndefinedPaths(creature), [], `no undefined fields for ${isbn}`);
    assert.ok(familyIds.has(creature.family.id), `family in set for ${isbn}`);
    assert.ok(paletteIds.has(creature.palette.id), `palette in set for ${isbn}`);
    assert.ok(patternIds.has(creature.pattern.id), `pattern in set for ${isbn}`);
    assert.ok(voiceIds.has(creature.voice.id), `voice in set for ${isbn}`);
    assert.ok(idleIds.has(creature.idle.id), `idle in set for ${isbn}`);
    assert.ok(quirkIds.has(creature.quirk.id), `quirk in set for ${isbn}`);
    assert.ok(rarityIds.has(creature.rarity.id), `rarity in set for ${isbn}`);
    assert.ok(publisherLabels.has(creature.publisher.label), `publisher in set for ${isbn}`);
    assert.ok(languageIds.has(creature.languageGroup.id), `language group in set for ${isbn}`);
    assert.equal(creature.pattern.placements.length, content.generation.markingCount, `4 placements for ${isbn}`);
    for (const placement of creature.pattern.placements) {
      assert.ok(Number.isInteger(placement) && placement >= 0 && placement <= content.generation.markingMask,
        `placement ${placement} in [0, markingMask] for ${isbn}`);
    }
  }
});

test('distinct ISBNs spread across many families, palettes, patterns, voices, idles, quirks, and rarities (not degenerate)', async () => {
  const seen = {
    family: new Set(), palette: new Set(), pattern: new Set(),
    voice: new Set(), idle: new Set(), quirk: new Set(), rarity: new Set(), seed: new Set()
  };
  for (const isbn of SYNTHETIC_BATCH) {
    const { creature } = await generateCreature(isbn);
    seen.family.add(creature.family.id);
    seen.palette.add(creature.palette.id);
    seen.pattern.add(creature.pattern.id);
    seen.voice.add(creature.voice.id);
    seen.idle.add(creature.idle.id);
    seen.quirk.add(creature.quirk.id);
    seen.rarity.add(creature.rarity.id);
    seen.seed.add(creature.seed);
  }
  // Thresholds set comfortably below what a 50-ISBN batch actually produces
  // (observed: 12/12 families, 16/16 palettes, 6/6 patterns, 8/8 voices,
  // 4/4 idles, 16/16 quirks, 3/4 rarities, 50/50 unique seeds) so this is a
  // genuine spread check, not a brittle exact-count regression.
  assert.ok(seen.family.size >= 6, `expected spread across families, saw ${seen.family.size}`);
  assert.ok(seen.palette.size >= 8, `expected spread across palettes, saw ${seen.palette.size}`);
  assert.ok(seen.pattern.size >= 4, `expected spread across patterns, saw ${seen.pattern.size}`);
  assert.ok(seen.voice.size >= 4, `expected spread across voices, saw ${seen.voice.size}`);
  assert.ok(seen.idle.size >= 3, `expected spread across idles, saw ${seen.idle.size}`);
  assert.ok(seen.quirk.size >= 8, `expected spread across quirks, saw ${seen.quirk.size}`);
  assert.ok(seen.rarity.size >= 2, `expected spread across rarities, saw ${seen.rarity.size}`);
  assert.equal(seen.seed.size, SYNTHETIC_BATCH.length, 'every ISBN in the batch should get a distinct seed');
});

test('publisher birthmark matches by exact prefix, does not false-match a near-miss prefix, and falls back to the default', () => {
  const candlewick = buildValidIsbn13('978', '07636' + '0000'.padEnd(4, '0').slice(0, 4));
  assert.equal(candlewick.startsWith('97807636'), true, 'sanity: constructed vector actually has the Candlewick prefix');
  const nearMiss = buildValidIsbn13('978', '0763500'.padEnd(9, '0')); // starts 9780763 5..., NOT 97807636
  assert.equal(nearMiss.startsWith('97807636'), false, 'sanity: near-miss vector must NOT share the 8-digit prefix');

  const g = content.generation;
  function publisherFor(isbn) {
    return g.publishers.find((p) => isbn.startsWith(p.prefix)) ?? g.defaultPublisher;
  }
  assert.equal(publisherFor(candlewick).label, 'Candlewick');
  assert.equal(publisherFor(nearMiss).label, 'Mystery press');

  // Cross-check against the real generator output too, not just the local re-implementation.
  return Promise.all([
    generateCreature(candlewick).then((r) => assert.equal(r.creature.publisher.label, 'Candlewick')),
    generateCreature(nearMiss).then((r) => assert.equal(r.creature.publisher.label, 'Mystery press'))
  ]);
});

test('language coat maps group digits 0-5 and 7 to their configured coat, and 6/8/9 fall back to the international default', async () => {
  const expected = {
    '0': 'english-a', '1': 'english-b', '2': 'french', '3': 'german',
    '4': 'japanese', '5': 'russian', '6': 'international', '7': 'chinese',
    '8': 'international', '9': 'international'
  };
  for (const [digit, expectedId] of Object.entries(expected)) {
    const isbn = buildValidIsbn13('978', `${digit}00000000`.slice(0, 9));
    assert.equal(isbn[3], digit, 'sanity: constructed ISBN has the intended group digit at index 3');
    const { creature } = await generateCreature(isbn);
    assert.equal(creature.languageGroup.id, expectedId, `group digit ${digit} for isbn ${isbn}`);
  }
});

test('rarity boundaries are honored at both extremes, including the maximum reachable roll of 999', () => {
  assert.equal(rarityFor(0).id, 'common');
  assert.equal(rarityFor(699).id, 'common');
  assert.equal(rarityFor(700).id, 'uncommon');
  assert.equal(rarityFor(899).id, 'uncommon');
  assert.equal(rarityFor(900).id, 'rare');
  assert.equal(rarityFor(979).id, 'rare');
  assert.equal(rarityFor(980).id, 'luminous');
  assert.equal(rarityFor(999).id, 'luminous'); // 999 is the true max since roll = raritySeed % 1000
});

// =============================================================================
// D. On-device only: no network upload, no image persistence
// =============================================================================

test('the barcode and ISBN modules reference no network, storage, or beacon APIs (static source check)', () => {
  const barcodeSrc = readFileSync(new URL('../src/systems/barcode.js', import.meta.url), 'utf8');
  const isbnSrc = readFileSync(new URL('../src/systems/isbn.js', import.meta.url), 'utf8');
  const forbidden = ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'navigator.'];
  for (const token of forbidden) {
    assert.equal(barcodeSrc.includes(token), false, `barcode.js must not reference ${token}`);
    assert.equal(isbnSrc.includes(token), false, `isbn.js must not reference ${token}`);
  }
});

test('generation.js has zero import dependency on the barcode/camera module (manual ISBN entry needs no BarcodeDetector)', () => {
  const genSrc = readFileSync(new URL('../src/systems/generation.js', import.meta.url), 'utf8');
  assert.equal(/barcode/i.test(genSrc), false);
});

test('a successful barcode decode returns only descriptive capture metadata — never the image/bitmap/file — and closes the bitmap', async () => {
  let closed = false;
  class FakeDetector {
    static async getSupportedFormats() { return ['ean_13']; }
    async detect() { return [{ rawValue: '9780064400558', format: 'ean_13' }]; }
  }
  const environment = {
    BarcodeDetector: FakeDetector,
    async createImageBitmap() { return { width: 800, height: 600, close() { closed = true; } }; }
  };
  const result = await decodeBookBarcode({ type: 'image/jpeg' }, environment);
  assert.equal(result.ok, true);
  assert.deepEqual(
    Object.keys(result.capture).sort(),
    ['decoder', 'formats', 'imageHeight', 'imageType', 'imageWidth', 'rawValues', 'source'].sort()
  );
  for (const forbiddenKey of ['image', 'bitmap', 'file', 'blob', 'data', 'pixels']) {
    assert.equal(forbiddenKey in result.capture, false, `capture must not carry a "${forbiddenKey}" field`);
  }
  assert.equal(closed, true, 'the decoded bitmap must be closed, not retained');
});

// =============================================================================
// E. CreatureGenerated — generation-side event contract
// =============================================================================

test('the original events, CreatureGenerated, and frozen Phase 1 shared events are all canonical', () => {
  const original = [
    'Hatched', 'TimeElapsed', 'DayRolledOver', 'CareActionPerformed',
    'CreatureStateChanged', 'GiftGranted', 'TuckedIn', 'ResourceGranted'
  ];
  // Local intra-module events (v1 originals + Package 6 recommendation preference events)
  // are declared but not part of the frozen PRD section-5 shared contract.
  const expected = new Set([
    ...original,
    'CreatureGenerated',
    ...Object.values(LocalRecommendationEventTypes),
    ...Object.values(SharedEventTypes)
  ]);
  const all = new Set(Object.values(EventTypes));
  assert.equal(all.size, expected.size, 'no undeclared event names are present');
  for (const name of original) assert.ok(all.has(name), `${name} still present`);
  assert.ok(all.has('CreatureGenerated'));
  for (const name of Object.values(LocalRecommendationEventTypes)) assert.ok(all.has(name), `${name} declared`);
  for (const name of Object.values(SharedEventTypes)) assert.ok(all.has(name), `${name} is frozen`);
});

test('applying CreatureGenerated with a null or non-book creature payload is a complete no-op', () => {
  const seeded = { ...initialState(), hatched: true, name: 'Pip', stage: 2, cp: 15, stickers: ['star'] };
  assert.deepEqual(applyEvent(seeded, creatureGenerated(null, 1000)), seeded);
  assert.deepEqual(applyEvent(seeded, creatureGenerated(undefined, 1000)), seeded);
  const wrongKind = { kind: 'treat', isbn: '9780064400558', name: 'Not A Book Creature' };
  assert.deepEqual(applyEvent(seeded, creatureGenerated(wrongKind, 1000)), seeded);
});

test('a real CreatureGenerated event preserves every unrelated field at extreme/edge values', async () => {
  const first = (await generateCreature('9780064400558')).creature;
  const second = (await generateCreature('9780590353403')).creature;

  let state = applyEvent(initialState(), creatureGenerated(first, 0));
  state = applyEvent(state, hatched(0));
  // Push every preserved field to an edge/extreme value.
  state = {
    ...state,
    stage: content.species.stages.at(-1).stage,
    stats: { fullness: 1, spirit: 2, energy: 3 },
    cp: 999,
    actionsToday: content.care.dailyCpCap,
    dayKey: '2026-7-15',
    stickers: content.stickers.map((s) => s.id),
    tuckedIn: true
  };
  const preserved = { ...state };

  const after = applyEvent(state, creatureGenerated(second, 12345));

  for (const key of ['hatched', 'stage', 'stats', 'cp', 'actionsToday', 'dayKey', 'stickers', 'tuckedIn']) {
    assert.deepEqual(after[key], preserved[key], `${key} must be untouched by CreatureGenerated`);
  }
  assert.equal(after.creature.isbn, second.isbn);
  assert.equal(after.name, second.name);
  assert.deepEqual(after.creatureHistory.at(-1), first, 'the prior identity is archived in creatureHistory');
});
