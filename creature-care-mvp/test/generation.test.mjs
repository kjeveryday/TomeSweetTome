import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCreature, rarityFor } from '../src/systems/generation.js';

test('same edition always produces the same fully resolved creature', async () => {
  const first = await generateCreature('978-0-06-440055-8');
  const second = await generateCreature('0064400557');
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.equal(first.creature.seedVersion, 'stacklings:v1');
  assert.equal(first.creature.hashAlgorithm, 'SHA-256');
});

test('legacy string and frozen identity object inputs produce byte-identical v1 output', async () => {
  const legacy = await generateCreature('9780064400558');
  const versioned = await generateCreature({ identityVersion: 'stacklings:v1', identityKey: '9780064400558' });
  assert.deepEqual(versioned, legacy);
  assert.equal((await generateCreature({ identityVersion: 'stacklings:v2', identityKey: '9780064400558' })).reason, 'unsupportedIdentityVersion');
});

test('provider work identity generation is deterministic and uses neutral metadata defaults', async () => {
  const identity = { identityVersion: 'stacklings:work:v1', identityKey: '/works/OL123W' };
  const first = await generateCreature(identity);
  const second = await generateCreature(structuredClone(identity));
  assert.equal(first.ok, true);
  assert.deepEqual(second, first);
  assert.deepEqual(first.identity, identity);
  assert.equal(first.creature.seedVersion, identity.identityVersion);
  assert.equal(first.creature.identityKey, identity.identityKey);
  assert.equal(Object.hasOwn(first.creature, 'isbn'), false);
  assert.equal(first.creature.publisher.label, 'Mystery press');
  assert.equal(first.creature.languageGroup.id, 'international');
});

test('generic generation rejects empty or noncanonical identity keys without fabricating an ISBN', async () => {
  for (const identityKey of ['', '  /works/OL123W', 'work:123', '/books/OL123M', 123, null]) {
    const result = await generateCreature({ identityVersion: 'stacklings:work:v1', identityKey });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalidIdentityKey');
  }
});

test('known books have frozen SHA-256 v1 identities', async () => {
  const fixtures = [
    ['9780064400558', 'a48ddcaa7f011236a7efa197', 'Mossprig', 'puffkin', 'coral', 'spots', 'HarperCollins'],
    ['9780399226908', '35bf9ba76e8a6eacb04850a1', 'Tinkin', 'inklit', 'rose', 'petals', 'Putnam / Philomel'],
    ['9780590353403', '225fff8fcdc4142c8ece961a', 'Fablefin', 'inklit', 'rose', 'petals', 'Scholastic']
  ];
  for (const [isbn, seed, name, family, palette, pattern, publisher] of fixtures) {
    const result = await generateCreature(isbn);
    assert.deepEqual(
      {
        seed: result.creature.seed,
        name: result.creature.name,
        family: result.creature.family.id,
        palette: result.creature.palette.id,
        pattern: result.creature.pattern.id,
        publisher: result.creature.publisher.label
      },
      { seed, name, family, palette, pattern, publisher }
    );
  }
});

test('the 16 pattern bits produce four stable marking placements', async () => {
  const { creature } = await generateCreature('9780064400558');
  assert.equal(creature.pattern.bits, 2193);
  assert.deepEqual(creature.pattern.placements, [1, 9, 8, 0]);
  assert.equal(creature.pattern.placements.length, 4);
});

test('rarity is cosmetic and honors every content-defined boundary', () => {
  assert.equal(rarityFor(699).id, 'common');
  assert.equal(rarityFor(700).id, 'uncommon');
  assert.equal(rarityFor(899).id, 'uncommon');
  assert.equal(rarityFor(900).id, 'rare');
  assert.equal(rarityFor(979).id, 'rare');
  assert.equal(rarityFor(980).id, 'luminous');
});
