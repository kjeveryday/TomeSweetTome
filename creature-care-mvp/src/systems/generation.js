// Deterministic, offline creature generation from a canonical ISBN.
// The versioned SHA-256 mapping is frozen: metadata may add flavor later, but
// must never reroll this base identity.

import content from '../content.json' with { type: 'json' };
import { canonicalizeIsbn } from './isbn.js';

function readUint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) >>> 0) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function hex32(value) {
  return value.toString(16).padStart(8, '0');
}

function publisherFor(isbn) {
  return content.generation.publishers.find((publisher) => isbn.startsWith(publisher.prefix))
    ?? content.generation.defaultPublisher;
}

function languageGroupFor(isbn) {
  const groupDigit = isbn[3];
  return content.generation.languageGroups[groupDigit] ?? content.generation.defaultLanguageGroup;
}

export function rarityFor(roll) {
  return content.generation.rarities.find((rarity) => roll < rarity.maxExclusive)
    ?? content.generation.rarities[content.generation.rarities.length - 1];
}

function generatedName(bytes) {
  const prefixes = content.generation.namePrefixes;
  const suffixes = content.generation.nameSuffixes;
  const prefix = prefixes[bytes[12] % prefixes.length];
  const suffix = suffixes[bytes[13] % suffixes.length];
  const overlaps = prefix.at(-1).toLowerCase() === suffix[0].toLowerCase();
  return `${overlaps ? prefix.slice(0, -1) : prefix}${suffix}`;
}

export async function generateCreature(input, cryptoProvider = globalThis.crypto) {
  const parsed = canonicalizeIsbn(input);
  if (!parsed.ok) return parsed;
  if (!cryptoProvider?.subtle) return { ok: false, reason: 'hashUnavailable' };

  const config = content.generation;
  const encoded = new TextEncoder().encode(`${config.seedVersion}:${parsed.isbn}`);
  const bytes = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', encoded));
  const speciesSeed = readUint32(bytes, 0);
  const individualSeed = readUint32(bytes, 4);
  const raritySeed = readUint32(bytes, 8);

  const paletteIndex = individualSeed & 0x1f;
  const patternBits = (individualSeed >>> 5) & 0xffff;
  const voiceIndex = (individualSeed >>> 21) & 0x07;
  const idleIndex = (individualSeed >>> 24) & 0x03;
  const quirkIndex = (individualSeed >>> 26) & 0x0f;
  const family = config.families[speciesSeed % config.families.length];
  const palette = config.palettes[paletteIndex % config.palettes.length];
  const pattern = config.patterns[(speciesSeed >>> 8) % config.patterns.length];
  const publisher = publisherFor(parsed.isbn);
  const rarityRoll = raritySeed % config.rarityRollRange;

  const creature = {
    kind: 'book',
    seedVersion: config.seedVersion,
    hashAlgorithm: config.hashAlgorithm,
    isbn: parsed.isbn,
    seed: `${hex32(speciesSeed)}${hex32(individualSeed)}${hex32(raritySeed)}`,
    name: generatedName(bytes),
    family: { ...family },
    palette: { index: paletteIndex, ...palette },
    pattern: {
      bits: patternBits,
      placements: Array.from({ length: config.markingCount }, (_, index) =>
        (patternBits >>> (index * config.bitsPerMarking)) & config.markingMask
      ),
      ...pattern
    },
    voice: { ...config.voices[voiceIndex % config.voices.length] },
    idle: { ...config.idles[idleIndex % config.idles.length] },
    quirk: { ...config.quirks[quirkIndex % config.quirks.length] },
    rarity: { roll: rarityRoll, ...rarityFor(rarityRoll) },
    publisher: { ...publisher },
    languageGroup: { ...languageGroupFor(parsed.isbn) }
  };

  return { ok: true, isbn: parsed.isbn, creature };
}
