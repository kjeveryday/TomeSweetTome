# Stacklings MVP shared contracts

Status: frozen for Phase 1 package integration  
Schema version: 2  
Event payload version: 1

The executable definitions and validators live in `creature-care-mvp/src/contracts.js`, `feature-flags.js`, `providers.js`, and `systems/migration.js`. This document records the decisions consumers need without duplicating every field.

## Record and identifier rules

- A work, edition, reading record, creature, and event has a stable, nonempty ID.
- ISBN fallback IDs are `work:isbn:<isbn13>` and `edition:isbn:<isbn13>`. The ISBN must be canonical, checksum-valid, and start with 978 or 979.
- Provider IDs are namespaced as `work:provider:<providerId>:<recordId>` and `edition:provider:<providerId>:<recordId>` with encoded components.
- Alias keys identify an external work or edition identifier and point directly to the matching canonical record, never to another alias. Frozen key forms are `isbn13:<isbn13>`, `provider-work:<providerId>:<recordId>`, and `provider-edition:<providerId>:<recordId>`.
- Work aliases (`isbn13` and `provider-work`) route to a canonical `BookWork`. Provider-edition aliases live in a separate index and route to a canonical `BookEdition`; they are never treated as work aliases.
- Work-keyed metadata provenance stores provider source, provider ID, fetch timestamp, and a field-to-source map. It remains separate from reading progress and library availability.
- An edition belongs to one work. Every work edition ID must resolve to an edition whose `workId` points back to that work. A canonical ISBN may identify only one edition record in a save.
- A player normally has at most one `CreatureRecord` per canonical work. When later metadata reconciles two works that already have creatures, both remain and the canonical work ID is recorded in `collection.reconciledDuplicateWorkIds`. Validation permits duplicates only for those marked reconciliation exceptions. Reconciliation never changes `identityVersion`, `identityKey`, or `baseTraits`.
- `CreatureRecord.careState` is either `{status: "uninitialized"}` for a migrated identity that has never owned separate care state, or a complete `{status: "ready", stats, stage, cp, actionsToday, dayKey, stickers, tuckedIn}` record. An empty object is invalid.
- Existing ISBN creatures retain `identityVersion: "stacklings:v1"` and the 13 ISBN digits as `identityKey`. Provider reconciliation does not replace that generator input.
- A non-ISBN search result uses `identityVersion: "stacklings:work:v1"` and the stable Open Library `/works/OL…W` key as `identityKey`. Query display text is NFKC-normalized, trimmed, and whitespace-collapsed; lowercase comparison never replaces the provider key. Generation uses the same SHA-256 trait-byte mapping with the existing neutral publisher and language defaults and does not fabricate an ISBN.
- Active, visible, and archived collection IDs must reference existing creatures and contain no duplicates. The active creature cannot also be archived.
- Visible and archived IDs are disjoint, and a non-null active creature is visible. Before an uninitialized migrated creature can become active, the collection package must initialize a complete nonpunitive care state through the active-selection event.

## Reading time and local-day rules

- `occurredAt` is the confirmation timestamp in canonical ISO format. A timer start does not determine the formal day.
- `localDayKey` is captured from the device-local calendar date when the reading confirmation is accepted, using the existing `YYYY-M-D` form. It is stored as evidence and is not recomputed after synchronization, travel, or replay.
- Offline replay retains the original event ID, `occurredAt`, and `localDayKey`. Replayed IDs are handled idempotently by the reading module.
- The Phase 1 UI does not backdate reading records. A future backdating feature would require a PRD change and an explicit correction/audit rule.
- Every accepted reading may create a `ReadingRecord`, but the formal-day index contains unique local day keys. A work relationship also contains at most one copy of a local day key.
- `ReadingRecord.status` records the status supplied with that reading. `BookStatusChanged` is the current work-status event. A creature's permanent `finished` marker is not removed by later rereading or a later paused/not-for-me status.

## Event envelope

Shared events use `{id, type, version, timestamp, payload}`. IDs are supplied by the dispatching module and remain unchanged on replay. Version 1 payload validators are frozen for every event named in PRD section 5. The existing v1 constructors keep their top-level reducer fields for compatibility; the application dispatcher replaces their compatibility fallback ID with a session-sequenced ID before applying or logging the event.

`BookAdded` version 1 carries the stable `workId` and `editionId` together with one complete validated `work`/`edition` pair, direct work aliases, direct edition aliases, and metadata provenance. The work in one event names exactly that supplied edition; the reducer unions it with editions already stored for the work. `BookMetadataResolved` carries the same self-contained records plus matching metadata status and provider source. The IDs and record relationships must agree. Replaying the same capture is idempotent; a dangling edition, conflicting edition, or conflicting alias route is rejected rather than silently rewriting an owned identity.

`ActiveCreatureChanged` is the functional collection-selection event required to make care replay deterministic. `CareActionPerformed` version 1 targets the active creature at the point where the event is applied. Event order therefore selects the care target; a replay applies the preceding active-selection event before the care event. The root v1 care fields are a compatibility projection of the active creature's ready care state, and the storage boundary synchronizes and validates that projection after every event.

`BookWorkReconciled` version 1 carries:

- `canonicalWorkId`
- unique `aliasedWorkIds`
- unique `editionIds`
- optional `preservedCreatureId`

The event is idempotent: applying it again with the same event ID makes no further change. It changes edition, alias, and creature routing to the canonical work but cannot rewrite a preserved creature identity. If more than one already-owned creature is affected, every identity remains and the reducer records the canonical work as a reconciled duplicate exception.

## Provider response rules

- Provider responses use `{source, providerId, fetchedAt, data}` with optional bounded `errorCode` and `officialUrl`.
- `source` is exactly `fixture`, `live`, or `unavailable`. Storage health is not a content provider response; storage adapters return `storageKind` separately.
- Provider health uses the same response envelope and data status `available` or `unavailable`.
- Metadata results carry normalized work and edition candidates, direct alias candidates, and provenance. An unavailable metadata provider returns `data: null`; reading remains available.
- Catalog availability is edition-specific. Confirmed item status is `available`, `unavailable`, or `unknown`, separate from provider source. Provider source `unavailable` requires item status `unknown` and an official link. Fixture availability uses the exact label `Sample availability`.
- Patron fixture results use the exact label `Demonstration`. No card number or PIN belongs in an event, reducer state, provider result, or log.
- Guest plus connected-library access is invalid. Library connection requires `accountStatus: "signed_in"`.

The catalog availability vocabulary beyond the three shared states, freshness calculation, and official-search fallback details remain package 9 decisions. No live catalog or patron service may be enabled without approved access and the privacy gate.

## Storage and migration

- The current key is `stacklings.save.v2`. The envelope contains `schemaVersion`, `savedAt`, monotonic `lastSeen`, the exact approved feature-flag set, and state.
- Guests use `LocalStorageAdapter`. The account phase receives the same adapter surface through the deterministic synchronized-storage fixture: `load`, `save`, `export`, `delete`, and `healthCheck`.
- Migration reads `creatureCare.save.v1` only when a valid current save is unavailable. It is deterministic, independent of accounts and network services, and idempotent for a current envelope.
- Migration preserves the legacy top-level state for v1 compatibility and creates explicit work, edition, and collection records. Valid v1 seeds and identity keys remain byte-for-byte unchanged.
- A malformed optional legacy generator payload is retained inside an unlinked legacy creature record rather than allowed to create an invalid ISBN edition. Malformed required care state produces a fresh safe envelope.
- Current-envelope validation rejects malformed records, duplicate formal days, dangling or mismatched work/edition/work-alias/edition-alias/provenance/reading/creature references, duplicate ISBN editions, unmarked duplicate creatures for one work, stale duplicate-exception markers, and invalid collection IDs. Earlier schema-2 saves deterministically receive empty edition-alias, provenance, and reconciled-duplicate indexes without changing care, collection, reading, or identity data.

## Feature flags

The exact keys are `timer`, `accounts`, `careItems`, `recommendationVisitors`, `libraryCatalog`, `libraryPatronActions`, `communityEvents`, and `researchSettings`. The storage boundary rejects extra keys. All flags default off at the foundation gate; each Phase 1 package enables its surface only after its own integration and feature-off tests pass.
