// Shared Phase 1 record and event contracts.
// These helpers are pure and intentionally contain no storage, DOM, or network access.

export const CURRENT_SCHEMA_VERSION = 2;
export const LEGACY_ISBN_IDENTITY_VERSION = 'stacklings:v1';
export const PROVIDER_WORK_IDENTITY_VERSION = 'stacklings:work:v1';

export const MetadataStatuses = Object.freeze({
  Unknown: 'unknown',
  Partial: 'partial',
  Resolved: 'resolved'
});

export const ReadingModes = Object.freeze({
  Independent: 'independent',
  Shared: 'shared',
  ReadAloud: 'read_aloud',
  Listened: 'listened'
});

export const BookStatuses = Object.freeze({
  Reading: 'reading',
  Finished: 'finished',
  Paused: 'paused',
  NotForMe: 'not_for_me'
});

export const AccountStatuses = Object.freeze({ Guest: 'guest', SignedIn: 'signed_in' });
export const LibraryStatuses = Object.freeze({ Disconnected: 'disconnected', Connected: 'connected' });
export const ProviderSources = Object.freeze({ Fixture: 'fixture', Live: 'live', Unavailable: 'unavailable' });
export const AvailabilityStatuses = Object.freeze({ Available: 'available', Unavailable: 'unavailable', Unknown: 'unknown' });

export const SharedEventTypes = Object.freeze({
  BookAdded: 'BookAdded',
  BookMetadataResolved: 'BookMetadataResolved',
  BookWorkReconciled: 'BookWorkReconciled',
  ReadingRecorded: 'ReadingRecorded',
  ReadingDayRecorded: 'ReadingDayRecorded',
  BookStatusChanged: 'BookStatusChanged',
  CreaturePreviewCreated: 'CreaturePreviewCreated',
  CreatureRevealed: 'CreatureRevealed',
  CreatureRelationshipChanged: 'CreatureRelationshipChanged',
  ActiveCreatureChanged: 'ActiveCreatureChanged',
  CareActionPerformed: 'CareActionPerformed',
  CareItemGranted: 'CareItemGranted',
  CareItemUsed: 'CareItemUsed',
  RecommendationRequested: 'RecommendationRequested',
  RecommendationDelivered: 'RecommendationDelivered',
  CatalogAvailabilityResolved: 'CatalogAvailabilityResolved',
  AccountSignedIn: 'AccountSignedIn',
  LibraryConnected: 'LibraryConnected',
  EventRegistrationChanged: 'EventRegistrationChanged',
  CommunityContributionRecorded: 'CommunityContributionRecorded'
});

export const EVENT_VERSIONS = Object.freeze(
  Object.fromEntries(Object.values(SharedEventTypes).map((type) => [type, 1]))
);

const values = (record) => new Set(Object.values(record));
const METADATA_STATUSES = values(MetadataStatuses);
const READING_MODES = values(ReadingModes);
const BOOK_STATUSES = values(BookStatuses);
const ACCOUNT_STATUSES = values(AccountStatuses);
const LIBRARY_STATUSES = values(LibraryStatuses);
const PROVIDER_SOURCES = values(ProviderSources);
const AVAILABILITY_STATUSES = values(AvailabilityStatuses);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isStringArray = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const hasString = (record, key) => isObject(record) && typeof record[key] === 'string' && record[key].length > 0;

export const workIdForIsbn = (isbn13) => `work:isbn:${isbn13}`;
export const editionIdForIsbn = (isbn13) => `edition:isbn:${isbn13}`;
export const providerWorkId = (providerId, recordId) =>
  `work:provider:${encodeURIComponent(providerId)}:${encodeURIComponent(recordId)}`;
export const providerEditionId = (providerId, recordId) =>
  `edition:provider:${encodeURIComponent(providerId)}:${encodeURIComponent(recordId)}`;
export const isbnAliasKey = (isbn13) => `isbn13:${isbn13}`;
export const providerWorkAliasKey = (providerId, recordId) =>
  `provider-work:${encodeURIComponent(providerId)}:${encodeURIComponent(recordId)}`;
export const providerEditionAliasKey = (providerId, recordId) =>
  `provider-edition:${encodeURIComponent(providerId)}:${encodeURIComponent(recordId)}`;
export const creatureIdForIdentity = (identityVersion, identityKey) =>
  `creature:${encodeURIComponent(identityVersion)}:${encodeURIComponent(identityKey)}`;

export function isCanonicalIsbn13(value) {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) sum += Number(value[index]) * (index % 2 === 0 ? 1 : 3);
  return Number(value[12]) === (10 - (sum % 10)) % 10;
}

export function isLocalDayKey(value) {
  const match = /^(\d{4})-([1-9]|1[0-2])-([1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isAliasKey(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('isbn13:')) return isCanonicalIsbn13(value.slice('isbn13:'.length));
  return /^provider-(?:work|edition):[^:]+:[^:]+$/.test(value);
}

export function isWorkAliasKey(value) {
  return typeof value === 'string'
    && (value.startsWith('isbn13:') ? isCanonicalIsbn13(value.slice('isbn13:'.length)) : /^provider-work:[^:]+:[^:]+$/.test(value));
}

export function isEditionAliasKey(value) {
  return typeof value === 'string' && /^provider-edition:[^:]+:[^:]+$/.test(value);
}

export function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function createBookWork({ id, title = '', authors = [], metadataStatus = MetadataStatuses.Unknown, editionIds = [] }) {
  return { id, title, authors: [...authors], metadataStatus, editionIds: [...new Set(editionIds)] };
}

export function isBookWork(value) {
  return hasString(value, 'id')
    && typeof value.title === 'string'
    && isStringArray(value.authors)
    && METADATA_STATUSES.has(value.metadataStatus)
    && isStringArray(value.editionIds)
    && new Set(value.editionIds).size === value.editionIds.length;
}

export function createBookEdition({ id, workId, isbn13, format, metadataSource = 'unknown' }) {
  return {
    id,
    workId,
    ...(isbn13 ? { isbn13 } : {}),
    ...(format ? { format } : {}),
    metadataSource
  };
}

export function isBookEdition(value) {
  return hasString(value, 'id')
    && hasString(value, 'workId')
    && (!Object.hasOwn(value, 'isbn13') || isCanonicalIsbn13(value.isbn13))
    && (!Object.hasOwn(value, 'format') || typeof value.format === 'string')
    && typeof value.metadataSource === 'string';
}

export function isReadingRecord(value) {
  return hasString(value, 'id')
    && hasString(value, 'workId')
    && hasString(value, 'occurredAt')
    && isIsoTimestamp(value.occurredAt)
    && isLocalDayKey(value.localDayKey)
    && (!Object.hasOwn(value, 'durationSeconds') || (Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0))
    && (!Object.hasOwn(value, 'mode') || READING_MODES.has(value.mode))
    && (!Object.hasOwn(value, 'status') || BOOK_STATUSES.has(value.status));
}

export function isCreatureRecord(value) {
  return hasString(value, 'id')
    && hasString(value, 'workId')
    && hasString(value, 'identityVersion')
    && hasString(value, 'identityKey')
    && isObject(value.baseTraits)
    && typeof value.revealed === 'boolean'
    && isStringArray(value.relationshipDayKeys)
    && value.relationshipDayKeys.every(isLocalDayKey)
    && new Set(value.relationshipDayKeys).size === value.relationshipDayKeys.length
    && typeof value.finished === 'boolean'
    && isCareState(value.careState);
}

export function isCareState(value) {
  if (!isObject(value)) return false;
  if (value.status === 'uninitialized') return Object.keys(value).length === 1;
  return value.status === 'ready'
    && isObject(value.stats)
    && ['fullness', 'spirit', 'energy'].every((key) => Number.isFinite(value.stats[key]) && value.stats[key] >= 0 && value.stats[key] <= 100)
    && Number.isInteger(value.stage) && value.stage >= 1
    && Number.isFinite(value.cp) && value.cp >= 0
    && Number.isInteger(value.actionsToday) && value.actionsToday >= 0
    && (value.dayKey === null || isLocalDayKey(value.dayKey))
    && isStringArray(value.stickers)
    && typeof value.tuckedIn === 'boolean';
}

export function createPlayerAccess() {
  return { accountStatus: AccountStatuses.Guest, libraryStatus: LibraryStatuses.Disconnected };
}

export function isPlayerAccess(value) {
  return isObject(value)
    && ACCOUNT_STATUSES.has(value.accountStatus)
    && LIBRARY_STATUSES.has(value.libraryStatus)
    && !(value.accountStatus === AccountStatuses.Guest && value.libraryStatus === LibraryStatuses.Connected);
}

const optionalString = (payload, key) => !Object.hasOwn(payload, key) || typeof payload[key] === 'string';
const requiredStrings = (payload, keys) => keys.every((key) => hasString(payload, key));
const uniqueStrings = (value) => isStringArray(value) && new Set(value).size === value.length;
const isAliasCandidate = (value) => isObject(value) && isWorkAliasKey(value.key) && hasString(value, 'workId');
const isEditionAliasCandidate = (value) => isObject(value)
  && isEditionAliasKey(value.key) && hasString(value, 'editionId');
const isProvenance = (value) => isObject(value)
  && PROVIDER_SOURCES.has(value.source)
  && hasString(value, 'providerId')
  && isIsoTimestamp(value.fetchedAt)
  && isObject(value.fields)
  && Object.values(value.fields).every((fieldSource) => typeof fieldSource === 'string');
const isBookRecordPayload = (payload) => isBookWork(payload.work)
  && isBookEdition(payload.edition)
  && payload.workId === payload.work.id
  && payload.editionId === payload.edition.id
  && payload.edition.workId === payload.work.id
  && payload.work.editionIds.length === 1
  && payload.work.editionIds[0] === payload.edition.id
  && Array.isArray(payload.aliases)
  && payload.aliases.every((alias) => isAliasCandidate(alias) && alias.workId === payload.work.id)
  && new Set(payload.aliases.map((alias) => alias.key)).size === payload.aliases.length
  && Array.isArray(payload.editionAliases)
  && payload.editionAliases.every((alias) => isEditionAliasCandidate(alias) && alias.editionId === payload.edition.id)
  && new Set(payload.editionAliases.map((alias) => alias.key)).size === payload.editionAliases.length
  && isProvenance(payload.provenance);

export const EVENT_PAYLOAD_VALIDATORS = Object.freeze({
  [SharedEventTypes.BookAdded]: (p) => requiredStrings(p, ['workId', 'editionId']) && isBookRecordPayload(p),
  [SharedEventTypes.BookMetadataResolved]: (p) => requiredStrings(p, ['workId', 'editionId', 'metadataStatus', 'source'])
    && METADATA_STATUSES.has(p.metadataStatus) && PROVIDER_SOURCES.has(p.source) && isBookRecordPayload(p)
    && p.metadataStatus === p.work.metadataStatus && p.source === p.provenance.source,
  [SharedEventTypes.BookWorkReconciled]: (p) => requiredStrings(p, ['canonicalWorkId'])
    && uniqueStrings(p.aliasedWorkIds) && uniqueStrings(p.editionIds) && optionalString(p, 'preservedCreatureId'),
  [SharedEventTypes.ReadingRecorded]: (p) => requiredStrings(p, ['readingRecordId', 'workId']),
  [SharedEventTypes.ReadingDayRecorded]: (p) => requiredStrings(p, ['readingRecordId', 'localDayKey']) && isLocalDayKey(p.localDayKey),
  [SharedEventTypes.BookStatusChanged]: (p) => requiredStrings(p, ['workId', 'status']) && BOOK_STATUSES.has(p.status),
  [SharedEventTypes.CreaturePreviewCreated]: (p) => requiredStrings(p, ['creatureId', 'workId']),
  [SharedEventTypes.CreatureRevealed]: (p) => requiredStrings(p, ['creatureId', 'workId', 'readingRecordId']),
  [SharedEventTypes.CreatureRelationshipChanged]: (p) => requiredStrings(
    p, ['creatureId', 'workId', 'readingRecordId', 'localDayKey', 'responseId']
  ) && isLocalDayKey(p.localDayKey),
  [SharedEventTypes.ActiveCreatureChanged]: (p) => requiredStrings(p, ['creatureId']),
  [SharedEventTypes.CareActionPerformed]: (p) => requiredStrings(p, ['actionId'])
    && Number.isFinite(p.cpGranted) && p.cpGranted >= 0,
  [SharedEventTypes.CareItemGranted]: (p) => requiredStrings(
    p, ['grantId', 'itemId', 'localDayKey', 'sourceReadingRecordId']
  ) && isLocalDayKey(p.localDayKey) && optionalString(p, 'categoryId'),
  [SharedEventTypes.CareItemUsed]: (p) => requiredStrings(p, ['useId', 'itemId', 'creatureId', 'actionId'])
    && p.actionId === 'feed' && Number.isFinite(p.cpGranted) && p.cpGranted >= 0,
  [SharedEventTypes.RecommendationRequested]: (p) => requiredStrings(p, ['requestId'])
    && uniqueStrings(p.categoryIds) && optionalString(p, 'branchId'),
  [SharedEventTypes.RecommendationDelivered]: (p) => requiredStrings(p, ['requestId', 'recommendationId', 'source'])
    && PROVIDER_SOURCES.has(p.source) && uniqueStrings(p.workIds) && uniqueStrings(p.editionIds)
    && (p.source !== ProviderSources.Unavailable || (p.workIds.length === 0 && p.editionIds.length === 0)),
  [SharedEventTypes.CatalogAvailabilityResolved]: (p) => requiredStrings(
    p, ['editionId', 'availabilityStatus', 'source', 'checkedAt', 'officialUrl']
  ) && optionalString(p, 'branchId') && isIsoTimestamp(p.checkedAt)
    && PROVIDER_SOURCES.has(p.source) && AVAILABILITY_STATUSES.has(p.availabilityStatus)
    && (p.source !== ProviderSources.Unavailable || p.availabilityStatus === AvailabilityStatuses.Unknown),
  [SharedEventTypes.AccountSignedIn]: (p) => requiredStrings(p, ['accountId']),
  [SharedEventTypes.LibraryConnected]: (p) => requiredStrings(p, ['connectionStatus', 'providerReference'])
    && LIBRARY_STATUSES.has(p.connectionStatus),
  [SharedEventTypes.EventRegistrationChanged]: (p) => requiredStrings(
    p, ['eventId', 'accountId', 'administratorId']
  ) && typeof p.registered === 'boolean',
  [SharedEventTypes.CommunityContributionRecorded]: (p) => requiredStrings(
    p, ['eventId', 'accountId', 'localDayKey']
  ) && isLocalDayKey(p.localDayKey)
});

export function createEventEnvelope({ id, type, timestamp, payload = {}, version = EVENT_VERSIONS[type] }) {
  if (!hasString({ id }, 'id')) throw new TypeError('Event id must be a non-empty string');
  if (!Object.hasOwn(EVENT_VERSIONS, type)) throw new TypeError(`Unknown shared event type: ${type}`);
  if (version !== EVENT_VERSIONS[type]) throw new TypeError(`Unsupported ${type} event version: ${version}`);
  const normalizedTimestamp = typeof timestamp === 'number' ? new Date(timestamp).toISOString() : timestamp;
  if (!isIsoTimestamp(normalizedTimestamp)) {
    throw new TypeError('Event timestamp must be an ISO date string or finite millisecond timestamp');
  }
  if (!isObject(payload)) throw new TypeError('Event payload must be an object');
  if (!EVENT_PAYLOAD_VALIDATORS[type](payload)) throw new TypeError(`Invalid ${type} v${version} payload`);
  return { id, type, version, timestamp: normalizedTimestamp, payload: structuredClone(payload) };
}

export function isEventEnvelope(value) {
  return isObject(value)
    && hasString(value, 'id')
    && Object.hasOwn(EVENT_VERSIONS, value.type)
    && value.version === EVENT_VERSIONS[value.type]
    && isIsoTimestamp(value.timestamp)
    && isObject(value.payload)
    && EVENT_PAYLOAD_VALIDATORS[value.type](value.payload);
}
