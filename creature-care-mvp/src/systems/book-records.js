// Pure work/edition normalization for ISBN captures. This module does not own
// collection state and deliberately does not resolve title/author identities or
// the two-owned-creature reconciliation conflict.

import {
  LEGACY_ISBN_IDENTITY_VERSION,
  MetadataStatuses,
  PROVIDER_WORK_IDENTITY_VERSION,
  createBookEdition,
  createBookWork,
  editionIdForIsbn,
  isbnAliasKey,
  isBookEdition,
  isBookWork,
  isEditionAliasKey,
  isWorkAliasKey,
  isCanonicalIsbn13,
  workIdForIsbn
} from '../contracts.js';
import { ProviderSources, isMetadataResult } from '../providers.js';
import { canonicalizeIsbn } from './isbn.js';

function fallbackRecords(isbn13, metadataSource = 'unavailable') {
  const workId = workIdForIsbn(isbn13);
  const editionId = editionIdForIsbn(isbn13);
  return {
    work: createBookWork({
      id: workId,
      metadataStatus: MetadataStatuses.Unknown,
      editionIds: [editionId]
    }),
    edition: createBookEdition({
      id: editionId,
      workId,
      isbn13,
      metadataSource
    }),
    aliases: [{ key: isbnAliasKey(isbn13), workId }],
    editionAliases: [],
    provenance: {}
  };
}

export function createIsbnBookRecords(input, metadataResult = null) {
  const parsed = canonicalizeIsbn(input);
  if (!parsed.ok) return parsed;
  const isbn13 = parsed.isbn;

  let records = fallbackRecords(isbn13);
  let provenance = {
    source: ProviderSources.Unavailable,
    providerId: 'metadata:local-fallback',
    fetchedAt: '1970-01-01T00:00:00.000Z',
    fields: {}
  };
  if (metadataResult != null) {
    try {
      if (!isMetadataResult(metadataResult)) return { ok: false, reason: 'invalidBookRecords' };
      provenance = {
        source: metadataResult.source,
        providerId: metadataResult.providerId,
        fetchedAt: metadataResult.fetchedAt,
        fields: {}
      };
      if (metadataResult.source !== ProviderSources.Unavailable) {
        records = structuredClone(metadataResult.data);
        provenance.fields = structuredClone(records.provenance);
        if (!records.aliases.some((alias) => alias.key === isbnAliasKey(isbn13))) {
          return { ok: false, reason: 'missingIsbnAlias' };
        }
        if (records.edition.isbn13 && records.edition.isbn13 !== isbn13) {
          return { ok: false, reason: 'editionIsbnMismatch' };
        }
        records.edition.isbn13 = isbn13;
      }
    } catch {
      return { ok: false, reason: 'invalidBookRecords' };
    }
  }

  if (!isBookWork(records.work)
    || !isBookEdition(records.edition)
    || !Array.isArray(records.aliases)
    || !Array.isArray(records.editionAliases)
    || records.edition.workId !== records.work.id
    || !records.work.editionIds.includes(records.edition.id)) {
    return { ok: false, reason: 'invalidBookRecords' };
  }

  return {
    ok: true,
    identity: { identityVersion: LEGACY_ISBN_IDENTITY_VERSION, identityKey: isbn13 },
    work: records.work,
    edition: records.edition,
    aliases: records.aliases,
    editionAliases: records.editionAliases,
    provenance
  };
}

export function createProviderWorkBookRecords(metadataResult) {
  try {
    if (!isMetadataResult(metadataResult)) return { ok: false, reason: 'invalidBookRecords' };
    if (metadataResult.source === ProviderSources.Unavailable) {
      return { ok: false, reason: 'metadataUnavailable' };
    }
    const records = structuredClone(metadataResult.data);
    const identity = records.identity;
    if (identity?.identityVersion !== PROVIDER_WORK_IDENTITY_VERSION
      || typeof identity.identityKey !== 'string'
      || identity.identityKey.length === 0
      || !records.aliases.some((alias) => alias.workId === records.work.id)
      || !records.editionAliases.some((alias) => alias.editionId === records.edition.id)) {
      return { ok: false, reason: 'invalidBookRecords' };
    }
    return {
      ok: true,
      identity: structuredClone(identity),
      work: records.work,
      edition: records.edition,
      aliases: records.aliases,
      editionAliases: records.editionAliases,
      provenance: {
        source: metadataResult.source,
        providerId: metadataResult.providerId,
        fetchedAt: metadataResult.fetchedAt,
        fields: structuredClone(records.provenance)
      }
    };
  } catch {
    return { ok: false, reason: 'invalidBookRecords' };
  }
}

export function recordsById(result) {
  if (!result?.ok) return result;
  return {
    works: { [result.work.id]: structuredClone(result.work) },
    editions: { [result.edition.id]: structuredClone(result.edition) },
    aliases: Object.fromEntries(result.aliases.map(({ key, workId }) => [key, workId])),
    editionAliases: Object.fromEntries(result.editionAliases.map(({ key, editionId }) => [key, editionId]))
  };
}

export function isIsbnIdentity(identity) {
  return identity?.identityVersion === LEGACY_ISBN_IDENTITY_VERSION
    && isCanonicalIsbn13(identity.identityKey);
}

function validRecordMaps(records) {
  if (!records || typeof records !== 'object' || Array.isArray(records)) return false;
  const { works, editions, aliases, editionAliases } = records;
  if (!works || typeof works !== 'object' || Array.isArray(works)
    || !editions || typeof editions !== 'object' || Array.isArray(editions)
    || !aliases || typeof aliases !== 'object' || Array.isArray(aliases)
    || !editionAliases || typeof editionAliases !== 'object' || Array.isArray(editionAliases)) return false;
  if (!Object.entries(works).every(([id, work]) => id === work?.id && isBookWork(work))) return false;
  if (!Object.entries(editions).every(([id, edition]) => id === edition?.id && isBookEdition(edition))) return false;
  if (!Object.entries(aliases).every(([key, workId]) => isWorkAliasKey(key) && Object.hasOwn(works, workId))) return false;
  if (!Object.entries(editionAliases).every(([key, editionId]) => isEditionAliasKey(key) && Object.hasOwn(editions, editionId))) return false;
  for (const work of Object.values(works)) {
    if (!work.editionIds.every((editionId) => editions[editionId]?.workId === work.id)) return false;
  }
  return Object.values(editions).every((edition) => works[edition.workId]?.editionIds.includes(edition.id));
}

export function reconcileBookWorkRouting(records, {
  canonicalWorkId,
  aliasedWorkIds = [],
  ownedCreatures = []
} = {}) {
  if (!validRecordMaps(records)) return { ok: false, reason: 'invalidBookRecords' };
  if (typeof canonicalWorkId !== 'string' || !Object.hasOwn(records.works, canonicalWorkId)) {
    return { ok: false, reason: 'missingCanonicalWork' };
  }
  if (!Array.isArray(aliasedWorkIds)
    || !aliasedWorkIds.every((id) => typeof id === 'string')
    || new Set(aliasedWorkIds).size !== aliasedWorkIds.length
    || !Array.isArray(ownedCreatures)) {
    return { ok: false, reason: 'invalidReconciliation' };
  }

  const affectedWorkIds = new Set([canonicalWorkId, ...aliasedWorkIds]);
  const affectedOwned = ownedCreatures.filter((creature) => affectedWorkIds.has(creature?.workId));

  let next;
  try {
    next = structuredClone(records);
  } catch {
    return { ok: false, reason: 'invalidBookRecords' };
  }
  const canonical = next.works[canonicalWorkId];
  const editionIds = new Set(canonical.editionIds);
  for (const aliasedWorkId of aliasedWorkIds) {
    if (aliasedWorkId === canonicalWorkId) continue;
    const aliased = next.works[aliasedWorkId];
    if (!aliased) continue; // Already reconciled is a successful no-op.
    for (const editionId of aliased.editionIds) {
      next.editions[editionId].workId = canonicalWorkId;
      editionIds.add(editionId);
    }
    delete next.works[aliasedWorkId];
    for (const [key, workId] of Object.entries(next.aliases)) {
      if (workId === aliasedWorkId) next.aliases[key] = canonicalWorkId;
    }
  }
  canonical.editionIds = [...editionIds];
  if (!validRecordMaps(next)) return { ok: false, reason: 'invalidBookRecords' };

  const creatureWorkUpdates = affectedOwned.map((creature) => ({
    creatureId: creature.id,
    workId: canonicalWorkId
  }));
  return {
    ok: true,
    records: next,
    creatureWorkUpdates,
    preservedIdentities: affectedOwned.map(({ id, identityVersion, identityKey }) => ({
      creatureId: id,
      identityVersion,
      identityKey
    }))
  };
}
