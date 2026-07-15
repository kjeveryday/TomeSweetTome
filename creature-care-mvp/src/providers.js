// Shared provider response and interface contracts. Provider-specific modules
// may add fields, but every response must keep this source-state distinction.

import {
  AvailabilityStatuses,
  ProviderSources,
  isAliasKey,
  isEditionAliasKey,
  isWorkAliasKey,
  isBookEdition,
  isBookWork
} from './contracts.js';

export { AvailabilityStatuses, ProviderSources } from './contracts.js';

export const PatronActionStatuses = Object.freeze({
  Demonstration: 'demonstration',
  Submitted: 'submitted',
  Unavailable: 'unavailable'
});

const SOURCES = new Set(Object.values(ProviderSources));
const AVAILABILITY = new Set(Object.values(AvailabilityStatuses));
const PATRON_STATUSES = new Set(Object.values(PatronActionStatuses));
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string' && value.length > 0;
const isIsoTimestamp = (value) => typeof value === 'string'
  && Number.isFinite(Date.parse(value))
  && new Date(Date.parse(value)).toISOString() === value;
const isHttpUrl = (value) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

export function providerResponse({ source, providerId, fetchedAt, data = null, errorCode, officialUrl }) {
  if (!SOURCES.has(source)) throw new TypeError(`Invalid provider source: ${source}`);
  if (typeof providerId !== 'string' || providerId.length === 0) throw new TypeError('providerId is required');
  const timestamp = typeof fetchedAt === 'number' ? new Date(fetchedAt).toISOString() : fetchedAt;
  if (!isIsoTimestamp(timestamp)) {
    throw new TypeError('fetchedAt must be an ISO date string or finite millisecond timestamp');
  }
  return {
    source,
    providerId,
    fetchedAt: timestamp,
    data: structuredClone(data),
    ...(errorCode ? { errorCode } : {}),
    ...(officialUrl ? { officialUrl } : {})
  };
}

export function isProviderResponse(value) {
  return isObject(value)
    && SOURCES.has(value.source)
    && isString(value.providerId)
    && isIsoTimestamp(value.fetchedAt)
    && Object.hasOwn(value, 'data')
    && (!Object.hasOwn(value, 'errorCode') || isString(value.errorCode))
    && (!Object.hasOwn(value, 'officialUrl') || isHttpUrl(value.officialUrl));
}

export function isProviderHealthResponse(value) {
  return isProviderResponse(value)
    && isObject(value.data)
    && ['available', 'unavailable'].includes(value.data.status)
    && (value.source !== ProviderSources.Unavailable || value.data.status === 'unavailable');
}

export function isMetadataIdentity(value) {
  return isObject(value) && isString(value.identityVersion) && isString(value.identityKey);
}

export function isMetadataResult(value) {
  if (!isProviderResponse(value)) return false;
  if (value.source === ProviderSources.Unavailable) return value.data === null;
  const data = value.data;
  return isObject(data)
    && isBookWork(data.work)
    && isBookEdition(data.edition)
    && data.edition.workId === data.work.id
    && data.work.editionIds.includes(data.edition.id)
    && Array.isArray(data.aliases)
    && data.aliases.every((alias) => isObject(alias) && isWorkAliasKey(alias.key) && alias.workId === data.work.id)
    && new Set(data.aliases.map((alias) => alias.key)).size === data.aliases.length
    && Array.isArray(data.editionAliases)
    && data.editionAliases.every((alias) => isObject(alias)
      && isEditionAliasKey(alias.key) && alias.editionId === data.edition.id)
    && new Set(data.editionAliases.map((alias) => alias.key)).size === data.editionAliases.length
    && isObject(data.provenance);
}

export function isLibraryBranch(value) {
  return isObject(value) && isString(value.id) && isString(value.name);
}

export function isCatalogSearchResult(value) {
  return isProviderResponse(value)
    && Array.isArray(value.data?.items)
    && value.data.items.every((item) => isObject(item)
      && isString(item.workId) && isString(item.editionId) && isString(item.title)
      && Array.isArray(item.authors) && item.authors.every(isString)
      && isHttpUrl(item.officialUrl));
}

export function isAvailabilityResult(value) {
  if (!isProviderResponse(value) || !isObject(value.data)) return false;
  const data = value.data;
  if (!isString(data.editionId) || !AVAILABILITY.has(data.status) || !isIsoTimestamp(data.checkedAt)) return false;
  if (!isHttpUrl(data.officialUrl) || (Object.hasOwn(data, 'branchId') && !isString(data.branchId))) return false;
  if (value.source === ProviderSources.Unavailable && data.status !== AvailabilityStatuses.Unknown) return false;
  if (value.source === ProviderSources.Fixture && data.label !== 'Sample availability') return false;
  return true;
}

export function isRecommendationResult(value) {
  return isProviderResponse(value)
    && isString(value.data?.requestId)
    && Array.isArray(value.data?.recommendations)
    && value.data.recommendations.every((item) => isObject(item)
      && isString(item.id) && isString(item.reason)
      && Array.isArray(item.workIds) && item.workIds.every(isString)
      && Array.isArray(item.editionIds) && item.editionIds.every(isString))
    && (value.source !== ProviderSources.Unavailable || value.data.recommendations.length === 0);
}

export function isPatronActionResult(value) {
  return isProviderResponse(value)
    && isObject(value.data)
    && isString(value.data.requestId)
    && PATRON_STATUSES.has(value.data.status)
    && isHttpUrl(value.data.officialUrl)
    && (value.source !== ProviderSources.Fixture || value.data.label === 'Demonstration');
}

export class FixtureMetadataProvider {
  constructor(records = {}, providerId = 'metadata:fixture', searchRecords = {}) {
    this.records = structuredClone(records);
    this.searchRecords = structuredClone(searchRecords);
    this.providerId = providerId;
  }

  resolve(identity, now = 0) {
    if (!isMetadataIdentity(identity)) throw new TypeError('Invalid metadata identity');
    const data = this.records[`${identity.identityVersion}:${identity.identityKey}`] ?? null;
    return providerResponse({
      source: data ? ProviderSources.Fixture : ProviderSources.Unavailable,
      providerId: this.providerId,
      fetchedAt: now,
      data,
      ...(data ? {} : { errorCode: 'not_found' })
    });
  }

  search(query, now = 0) {
    if (!isObject(query) || !isString(query.comparisonKey)) throw new TypeError('Invalid metadata search query');
    const data = this.searchRecords[query.comparisonKey] ?? null;
    return providerResponse({
      source: data ? ProviderSources.Fixture : ProviderSources.Unavailable,
      providerId: this.providerId,
      fetchedAt: now,
      data,
      ...(data ? {} : { errorCode: 'not_found' })
    });
  }

  healthCheck(now = 0) {
    return providerResponse({
      source: ProviderSources.Fixture,
      providerId: this.providerId,
      fetchedAt: now,
      data: { status: 'available' }
    });
  }
}

export class CatalogProvider {
  search(_query, _branchId) { throw new Error('CatalogProvider.search is not implemented'); }
  getAvailability(_editionId, _branchId) { throw new Error('CatalogProvider.getAvailability is not implemented'); }
  getBranches() { throw new Error('CatalogProvider.getBranches is not implemented'); }
  healthCheck() { throw new Error('CatalogProvider.healthCheck is not implemented'); }
}

export class RecommendationProvider {
  recommend(_input) { throw new Error('RecommendationProvider.recommend is not implemented'); }
  healthCheck() { throw new Error('RecommendationProvider.healthCheck is not implemented'); }
}

export class MetadataProvider {
  resolve(_identity) { throw new Error('MetadataProvider.resolve is not implemented'); }
  search(_query) { throw new Error('MetadataProvider.search is not implemented'); }
  healthCheck() { throw new Error('MetadataProvider.healthCheck is not implemented'); }
}

export class LibraryPatronProvider {
  connect(_input) { throw new Error('LibraryPatronProvider.connect is not implemented'); }
  performAction(_input) { throw new Error('LibraryPatronProvider.performAction is not implemented'); }
  healthCheck() { throw new Error('LibraryPatronProvider.healthCheck is not implemented'); }
}

export class AccountProvider {
  signIn(_input) { throw new Error('AccountProvider.signIn is not implemented'); }
  signOut() { throw new Error('AccountProvider.signOut is not implemented'); }
  healthCheck() { throw new Error('AccountProvider.healthCheck is not implemented'); }
}

export class EventAdminProvider {
  searchAccounts(_query) { throw new Error('EventAdminProvider.searchAccounts is not implemented'); }
  changeRegistration(_input) { throw new Error('EventAdminProvider.changeRegistration is not implemented'); }
  healthCheck() { throw new Error('EventAdminProvider.healthCheck is not implemented'); }
}
