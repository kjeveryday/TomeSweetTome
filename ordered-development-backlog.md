# Stacklings MVP ordered development backlog

Status: active implementation backlog  
Authority: `Stacklings MVP PRD v0.3.md`  
Last updated: July 15, 2026

This backlog follows the dependency order in PRD section 9. Phase 1 packages are active. Phase 2 and Phase 3 packages remain disabled until their phase begins and the privacy gate is satisfied. The 177-test v1 baseline and Phase 0 hardening are complete.

## Shared rules for every package

- Run the complete test suite before work starts and after each completed package.
- Keep all state changes in the pure reducer and communicate through the frozen shared events and provider interfaces.
- Keep the local guest loop working with every optional flag off.
- Use deterministic fixtures for every provider before adding a dependent module.
- Run migration and shared-event tests for every package.
- Exercise the affected flow in a locally served browser, including feature-off and provider-unavailable behavior where applicable.
- Apply the revision and source-fit checks in `# WRITING.md` to documentation and user-facing copy.
- Commit only a completed, green package. Do not push without explicit authorization.

## 1. Shared contracts, storage schema, and migration — complete

- **Objective and PRD references:** Freeze shared records, IDs, event envelopes and payload versions, provider interfaces, feature flags, the versioned save envelope, and deterministic migration from `creatureCare.save.v1` (PRD 5, 6.1, 7-10; acceptance 11.1, 11.8-11.9).
- **Owned files:** `src/contracts.js`, `src/feature-flags.js`, `src/providers.js`, `src/systems/migration.js`, `src/systems/storage.js`, shared contract/migration tests, and coordinator-owned wiring changes in `src/events.js`, `src/state.js`, and `src/app.js`.
- **Shared records read/written:** `BookWork`, `BookEdition`, `ReadingRecord`, `CreatureRecord`, `PlayerAccess`, the root Phase 1 state, and the versioned storage envelope.
- **Events consumed/emitted:** Freeze all PRD section 5 events. Existing v1 event constructors remain compatible; new events use the shared envelope with stable ID, version, timestamp, and payload.
- **Provider dependencies:** Contract and deterministic fixture shapes only. No live dependency.
- **Feature flags:** Freeze `timer`, `accounts`, `careItems`, `recommendationVisitors`, `libraryCatalog`, `libraryPatronActions`, `communityEvents`, and `researchSettings`; later-phase flags default off.
- **Migration impact:** Introduces the current schema version and migration entrypoint. Preserve the active v1 creature, prior identities, care state, stickers, CP, stage, daily-cap state, timestamps, and exact deterministic identity. Fresh, valid legacy, pre-generator, corrupted, and repeated migrations are covered.
- **Dependencies:** Closed Phase 0 baseline only.
- **Tests:** Record validators, stable ID/alias rules, event envelope/version tests, provider source-state tests, flag defaults/overrides, adapter contract, migration preservation, corruption recovery, and idempotency. Run all 177 existing tests.
- **Browser checks:** Fresh guest boot and migrated legacy boot; existing hatch, scan, care, close, and reopen behavior remains intact.
- **Feature-off behavior:** The app boots with every optional flag off and uses local storage without accounts or network services.
- **Acceptance criteria:** Shared-contract and migration tests pass; the complete suite is green; no v1 identity or care behavior changes; corrupted saves fail safely; repeated migration produces the same current envelope.

## 2. Book records and identity reconciliation — complete

**Implementation status (2026-07-15):** Complete and green at 240 tests. Manual and image ISBN input converge on frozen v1 identities. Title-and-author search normalizes the query, uses stable Open Library work and edition IDs, and generates a deterministic `stacklings:work:v1` identity with neutral ISBN-only traits. Fixture/live enrichment persists source and field provenance; work aliases and edition aliases have separate validated targets; missing or unavailable metadata fails safely; repeated capture upgrades metadata without duplicating the edition; and invalid routing cannot erase care or collection state. Late reconciliation is idempotent, retargets existing reading records without changing the distinct-day ledger, and preserves both already-owned creatures as a validated exception without changing either identity. Browser checks passed for live title-and-author search, search failure recovery, pinned metadata, unavailable-provider ISBN fallback, repeated capture, reload persistence, and all optional flags off. The Open Library work/edition field assumptions were checked against the [official Search API documentation](https://openlibrary.org/dev/docs/api/search).

- **Objective and PRD references:** Add explicit works, editions, identity inputs, metadata normalization, and aliases while preserving v1 ISBN identities (PRD 2-3, 5, 6.3, 7, 11.6, 11.8).
- **Owned files:** Book-record module, metadata adapter and fixture, book reducer slice, book UI surface, and book tests. Shared contract files remain coordinator-owned.
- **Shared records read/written:** Read/write `BookWork` and `BookEdition`; read creature identity contracts; write alias indexes and metadata provenance.
- **Events consumed/emitted:** Emit `BookAdded`, `BookMetadataResolved`, and `BookWorkReconciled`; consume no private module events.
- **Provider dependencies:** Metadata provider fixture first, then existing Open Library enrichment behind the interface. Responses identify `fixture`, `live`, or `unavailable`.
- **Feature flags:** No required flag for core book records. Live metadata remains optional and unavailable-safe.
- **Migration impact:** Read migrated ISBN works/editions and preserve their identity keys. Do not rewrite legacy generator inputs.
- **Dependencies:** Package 1.
- **Tests:** ISBN/manual/image convergence; missing metadata; deterministic title-author fallback after its normalization rule is frozen; edition aliases; repeated capture; reconciliation idempotency; v1 frozen identities; malformed/dangling aliases fail safely.
- **Browser checks:** Manual ISBN, barcode-image capture, title-and-author search, repeated search, pinned metadata, unavailable search, and missing metadata.
- **Feature-off behavior:** With all optional services off and network unavailable, a guest can still add an ISBN work and continue to reading.
- **Acceptance criteria:** Every captured edition resolves to one work record; metadata failure never blocks an honor-based reading record; owned identities never reroll.

## 3. Reading records, distinct-day progress, and optional timer — complete

**Implementation status (2026-07-15):** Complete and green at 270 tests. Standalone participation starts through an explicit local “Start challenge” action with a 20-day goal, a 10-day halfway state, and no deadline. Confirmed reading stores the complete record and its distinct formal day atomically; all approved reading routes, rereading, several books on one day, book statuses, and 0/10/20-day states are covered. The optional timer uses a monotonic in-memory clock and never creates CP, care power, or extra formal progress. An interrupted timer discards its duration on reload but leaves a one-time local prompt asking whether to record the reading as untimed; Yes follows the ordinary confirmation path and No clears the prompt. Browser checks passed for Start, untimed reading, same-day deduplication across books and modes, a later simulated local day, timer start/stop/cancel, one-time reload recovery, persistence, and timer-off behavior.

- **Objective and PRD references:** Record equivalent reading routes, derive one formal day per local date, support private optional duration, and derive 10-day/20-day status (PRD 3, 5, 6.4, 8, 11.3-11.7).
- **Owned files:** Reading module, reading reducer slice, timer/session adapter, reading UI, and reading tests.
- **Shared records read/written:** Write `ReadingRecord`; read `BookWork`; write formal reading-day index and derived program status.
- **Events consumed/emitted:** Emit `ReadingChallengeStarted`, `ReadingRecorded`, `ReadingDayRecorded`, and `BookStatusChanged`.
- **Provider dependencies:** None.
- **Feature flags:** `timer`; untimed confirmation is always available.
- **Migration impact:** New fields default empty without changing migrated care or collection records.
- **Dependencies:** Packages 1-2.
- **Tests:** Same-day deduplication, replay/idempotency, distinct later days, modes, rereading, paused/not-for-me, finish independence, timer confirmation equivalence, DST/local-day boundaries, malformed timestamps, and 0/10/20-day status.
- **Browser checks:** Untimed read, timer confirm/cancel, several books on one day, and a later simulated local day.
- **Feature-off behavior:** Timer controls disappear; “I read this” completes the same reading-day path.
- **Acceptance criteria:** Minutes, book count, length, format, and completion never add formal progress; missing days never reset it; reading modes are equivalent.

## 4. Preview, first-reading reveal, collection, and repeated scans

- **Objective and PRD references:** Change acquisition to deterministic preview followed by first-reading reveal; provide one creature per work, active selection, visible selection, and unbounded collection (PRD 3.9, 3.12-13, 6.5, 11.2, 11.4, 11.6, 11.8).
- **Owned files:** Collection module/reducer/UI/tests and generator adapter. Shared wiring changes are integrated by the coordinator.
- **Shared records read/written:** Read works, editions, and reading records; write `CreatureRecord`, active creature ID, visible IDs, and archived collection IDs.
- **Events consumed/emitted:** Consume `BookAdded`, `BookWorkReconciled`, and `ReadingRecorded`; emit `CreaturePreviewCreated` and `CreatureRevealed`.
- **Provider dependencies:** Metadata fixture only through book records; collection has no direct provider dependency.
- **Feature flags:** None for the core collection.
- **Migration impact:** Consume migrated active/history records without duplicating them or changing v1 base traits.
- **Dependencies:** Packages 1-3. The active-selection event and active-care projection rules are frozen in `shared-contracts.md`; switching must initialize an uninitialized migrated care state before Package 5 begins.
- **Tests:** Scan-only preview; first-reading reveal; repeated scans; A-to-B-to-A deduplication; several same-day reveals; edition aliases; active switching; returned books retained; migration compatibility.
- **Browser checks:** Add, preview, read, reveal, switch active creature, repeat scan, close, and reopen.
- **Feature-off behavior:** Every optional service off still supports the entire preview/reveal/collection loop.
- **Acceptance criteria:** One work normally has one creature; an approved late-reconciliation exception may retain multiple already-owned identities for the canonical work. Repeated capture opens the existing record; several works can reveal in one compact group; every creature remains in the collection.

## 5. Book relationship development and optional treats

- **Objective and PRD references:** Add one relationship day per work/date, configured non-ranked responses, permanent finish response, and the optional treat seam without changing formal reading or v1 care rules (PRD 3.10-11, 6.6, 8, 11.5-11.7).
- **Owned files:** Relationship/care-item module, reducer slice, UI, content, and tests. Existing care files are changed only by this package owner with coordinator integration.
- **Shared records read/written:** Read reading records and works; write `CreatureRecord.relationshipDayKeys`, `finished`, and care-item inventory/provenance.
- **Events consumed/emitted:** Consume `ReadingRecorded`, `ReadingDayRecorded`, and `BookStatusChanged`; emit `CreatureRelationshipChanged`, `CareItemGranted`, and `CareItemUsed`.
- **Provider dependencies:** Broad category from shared book metadata only; missing category never blocks reading or care.
- **Feature flags:** `careItems`; keep disabled until grant cadence and category-to-treat content are approved.
- **Migration impact:** Preserve the active v1 care state exactly. The inactive-creature clock/cap policy must be frozen before implementation.
- **Dependencies:** Packages 1-4.
- **Tests:** Relationship-day deduplication, next configured response, long-book/reread equality, finish idempotency, no CP/stage effects, unchanged absence behavior, treat replay/atomicity/persistence, cap semantics, and flag-off behavior.
- **Browser checks:** Continued reading on later days, finish response, unchanged care/absence flow, and treat controls on/off after approval.
- **Feature-off behavior:** No inventory, grant, use event, or treat UI; reading, relationship, care, and persistence remain complete.
- **Acceptance criteria:** Relationship development is distinct-day and non-ranked; finishing is permanent but optional; treats never create extra reading progress or power.

## 6. Fixture recommendations

**Implementation status (2026-07-15):** Complete and green at 416 tests, behind the `recommendationVisitors` flag (default off). Recent broad book categories (genres/subjects only — never ability, identity, ISBNs, or names) drive a deterministic `FixtureRecommendationProvider`; a new user gets the general fallback. `RecommendationRequested`/`RecommendationDelivered` are the shared events; save/dismiss/reset are modeled as **local (intra-module) events** (`LocalRecommendationEventTypes`, like the v1 `Hatched`/`TuckedIn` events) so every change still flows through the reducer without expanding the frozen PRD section-5 shared set. Reset/delete clears only the advisory preference slice and never removes books, creatures, or reading history. A visiting "book buddy" UI presents the reason, a clear "Sample suggestion" label, and the fixture books with save/dismiss/reset controls; feature-off renders no surface. Two adversarial reviews passed (privacy/no-PII + state invariants); the flag-off handlers were hardened to emit nothing when disabled. Browser-verified: feature-off hidden, category-based + general recommendations, save/dismiss/reset, and reset preserving owned data.

- **Objective and PRD references:** Provide deterministic visiting-creature recommendations with general fallback, reasons, save/dismiss, reset/delete, and no user-to-user path (PRD 6.7, 7-8, 11.11).
- **Owned files:** Recommendation provider contract implementation/fixture, reducer slice, visitor UI, content, and tests.
- **Shared records read/written:** Read recent broad categories and optional branch ID; write recommendation request/result and local save/dismiss/reset state.
- **Events consumed/emitted:** Emit `RecommendationRequested` and `RecommendationDelivered`.
- **Provider dependencies:** Deterministic `RecommendationProvider` fixture; future live adapter remains disabled.
- **Feature flags:** `recommendationVisitors`.
- **Migration impact:** Empty defaults only; reset/delete never removes books, creatures, or reading history.
- **Dependencies:** Packages 1-5 and metadata category seam from package 2.
- **Tests:** Stable ordered fixture, new-user general result, approved inputs only, source labeling, reasons, save/dismiss, reset/delete, unavailable/no-visitor fallback, and no user/PII fields.
- **Browser checks:** General and category-based fixture visitors; save, dismiss, reset, delete, unavailable, and flag-off states.
- **Feature-off behavior:** No visitor surface; add/read/reveal/care/persist loop is unchanged.
- **Acceptance criteria:** Fixture results are clearly sample data; no ability or sensitive inference; no route to another user; failure leaves the core loop complete.

## 7. Settings, research explanations, export, and delete

**Implementation status (2026-07-15):** Complete and green at 446 tests. A ⚙️ settings modal shows: guest/account state with a plain "saved only on this browser" explanation; service status that clearly tags the fixture recommendation provider as "Sample data" and never presents it as live (via `classifyProviderHealth`); an export of the current save envelope (view/copy/download); a two-step "Delete everything" that scopes deletion to this app's saves + local markers and reloads to a fresh guest start (recovery); a "Clear saved suggestions" privacy control; and a "Research & design" section (behind the `researchSettings` flag) rendering the exact 7 approved PRD-6.11 entries with working source links (`target=_blank rel="noopener noreferrer"`) and a prominent disclaimer that the research does not prove the creature design or that 20 days is optimal. New pure `src/systems/settings.js` (research-content validation incl. a clause-local no-overclaim guard, provider-health classification, account explanation). No new reducer events — settings reads state and invokes the existing public storage export/delete and recommendation-reset. The `researchSettings` flag gates only the research section. A correctness/privacy review passed; its one finding (a sentence-wide negation-skip that could let a future overclaiming content edit slip through) was hardened to be clause-local and regression-tested. Browser-verified: gear opens the modal, guest explanation, sample-data labeling, valid export, two-step delete + fresh recovery, all 7 research links, and research-flag-off hiding only the research section.

- **Objective and PRD references:** Add functional settings for guest state, provider status, export/delete, recommendation controls, and the exact approved research table with citations (PRD 6.11, 8, 11.15).
- **Owned files:** Settings module/UI/tests and versioned research content. Storage deletion/export use package 1 public interfaces.
- **Shared records read/written:** Read `PlayerAccess`, feature flags, provider health, and research content; invoke storage export/delete and recommendation reset/delete.
- **Events consumed/emitted:** No direct cross-module mutation; use public storage and recommendation commands. Any resulting state change uses frozen events.
- **Provider dependencies:** Provider health/status interfaces only.
- **Feature flags:** `researchSettings` controls the research section, not export/delete or guest save explanation.
- **Migration impact:** Export uses the current envelope; delete removes current and legacy app saves without touching unrelated browser data.
- **Dependencies:** Packages 1 and 6; provider status contracts from package 1.
- **Tests:** Seven versioned research entries and required fields, exact caveats, descriptive/source links, guest explanation, provider labels, valid export, scoped delete, recovery, and research flag off.
- **Browser checks:** Open every source link, export, delete with confirmation, reload fresh, provider status labels, and research flag off.
- **Feature-off behavior:** Research section is absent; privacy, export/delete, and core guest loop remain available.
- **Acceptance criteria:** Copy does not claim that research proves the creature design or that 20 days is universally optimal; export/delete work locally.

## 8. Account and synchronized-storage providers

- **Objective and PRD references:** Add optional guardian-managed account and synchronized-storage fixtures without changing Phase 1 records (PRD 3.17-18, 6.1-6.2, 7-9, 11.9-11.10).
- **Owned files:** Account provider/fixture, synchronized storage adapter, account reducer/UI/tests.
- **Shared records read/written:** `PlayerAccess`; current storage envelope; local-to-account merge preview/result.
- **Events consumed/emitted:** Emit `AccountSignedIn`; storage operations use the adapter contract.
- **Provider dependencies:** Local test account and in-memory synchronized-storage fixtures first. No real child data.
- **Feature flags:** `accounts`.
- **Migration impact:** Merge current local envelope after explicit preview; disabling accounts returns to complete Phase 1 without data loss.
- **Dependencies:** Phase 1 packages 1-7 and an approved privacy specification before live enablement.
- **Tests:** Guest default, merge preview, deterministic merge/reload, service unavailable, sign-out/local fallback, no public profile, and flag off.
- **Browser checks:** Guest explanation, fixture sign-in/merge/restore, unavailable service, sign-out, and flag off.
- **Feature-off behavior:** No account surface is required; guest local save remains authoritative.
- **Acceptance criteria:** Fixture synchronization restores the same records; no real child account data is collected; guest play never blocks.

## 9. Catalog and patron-provider seams

- **Objective and PRD references:** Add edition-level sample catalog availability and a disabled patron-action seam with official-link fallbacks (PRD 6.8-6.9, 7-9, 11.12).
- **Owned files:** Catalog/patron provider fixtures, reducer slices, UI, and tests.
- **Shared records read/written:** Read works/editions and `PlayerAccess`; write branch/availability results and opaque patron operation state.
- **Events consumed/emitted:** Emit `CatalogAvailabilityResolved` and `LibraryConnected`; patron commands stay behind the provider.
- **Provider dependencies:** `MockCatalogProvider` first; demonstration-only patron fixture. No production scraping.
- **Feature flags:** `libraryCatalog`, `libraryPatronActions`; patron actions also require `accounts` and signed-in state.
- **Migration impact:** Empty defaults only; disabling either module never removes personal data.
- **Dependencies:** Packages 1-8, approved credentials for any live provider, and privacy/security approval for real patron credentials.
- **Tests:** Edition/branch separation, fixture labels, live/unavailable distinction, freshness, official-link recovery, guest patron block, no PIN/card data, demonstration label, and independent flags.
- **Browser checks:** Sample availability, unavailable provider/official link, signed-out patron block, demonstration flow, and each flag off.
- **Feature-off behavior:** Patron off preserves catalog; both off preserve the complete prior-phase app.
- **Acceptance criteria:** Fixture says “Sample availability”; provider failure is unknown rather than false unavailable; no credential secret enters state or logs.

## 10. Community events and administrator registration

- **Objective and PRD references:** Add authorized fixture administration, account registration, normalized daily community contribution, aggregate progress, and audit log without child-to-child communication (PRD 3.15-20, 6.10, 7-9, 11.13-11.14, 11.16).
- **Owned files:** Community/admin provider fixture, reducer slice, admin and participant UI, audit records, and tests.
- **Shared records read/written:** Read account/library access and reading-day records; write event registration, normalized contribution, aggregate state, and audit log.
- **Events consumed/emitted:** Emit `EventRegistrationChanged` and `CommunityContributionRecorded`.
- **Provider dependencies:** Local authorized-administrator fixture first; future live service requires role-based authorization.
- **Feature flags:** `communityEvents`; requires enabled accounts and connected library for account-based participation.
- **Migration impact:** Empty defaults only; disabling removes community surfaces without touching personal progress.
- **Dependencies:** Packages 1-9 and the approved privacy gate before real administrator account search.
- **Tests:** Exact/partial username fixture, minimum returned fields, registration/removal audit, one contribution per participant/day, aggregate-only display, authorization failure, no private reading fields, and flag off.
- **Browser checks:** Authorized search/register/remove, participant aggregate view, unauthorized state, and flag off.
- **Feature-off behavior:** No event/admin surface; personal reading and collection state remain unchanged.
- **Acceptance criteria:** No rankings, public individual totals, chat, messaging, friend list, trading, ordinary-user search, or private reading disclosure.

## Product decisions and remaining questions

Resolved for package 2:

- **Non-ISBN identity:** `stacklings:work:v1` hashes the stable provider work key. Title and author are NFKC-normalized, trimmed, and whitespace-collapsed for search; comparison is case-insensitive without changing display text. ISBN-only publisher and language inputs use the existing neutral defaults.
- **Late reconciliation:** Both already-owned creatures remain. Their identities and traits do not change; both route to the canonical work through a validated `reconciledDuplicateWorkIds` exception.

Resolved for package 3:

- **Timer recovery:** An unconfirmed timer duration does not survive reload. A local interrupted-session marker may show a one-time “Did you want to record that reading?” prompt; accepting records ordinary untimed reading, and declining clears it.
- **Standalone registration:** The user explicitly starts the local challenge. It uses the default 20-day goal and 10-day halfway state without a deadline or library-program window.

Resolved for package 5 (approved 2026-07-15):

1. **Care scope after switching — "Gentle collection":** Inactive (non-active) creatures pause. They do not drift, decay, or accrue absence/catch-up while archived; their `careState` snapshot is frozen until reactivated. The daily care cap stays **per-creature** — each creature's own `careState.actionsToday`/`dayKey`, matching the already-frozen per-creature care state. Reactivating a creature never applies retroactive absence drift for the time it was inactive. This confirms and freezes the current behavior; Package 5 must not add inactive-creature drift.
2. **Relationship content — "Reveal = day 1":** The first-reading reveal day counts as the creature's first relationship day. Each subsequent distinct reading day for that work advances to the next configured non-ranked response. Response IDs/order are configured in `content.json` (`relationship.responses`) and are non-ranked (cyclic, no strength).
3. **Treats — seam only, flag OFF:** Build the `careItems` events/reducer/inventory/persistence seam behind the `careItems` feature flag (default off), no treat UI, using PRD 6.6 defaults (first formal reading day may grant one broad-category treat; using a treat performs the normal feed effect with a different animation and is subject to the existing daily care cap; treats never add reading progress or extra power). Final grant cadence, category→treat mapping, and treat UI are deferred until the flag is enabled in a later pass.

Approved after Phase 1 (2026-07-15) — navigation and visitor presentation:

5. **Phone shell with a 6-tab bottom nav.** The single scrolling column becomes six pages: **Discover** (scan/ISBN/title-author → meet a preview), **Pet Care** (the whole daily loop — feed/play/tidy, the optional timer, "I read this", tuck in — plus a small progress echo so logging keeps its receipt), **Habitat** (owned collection + visiting recommendations + future habitat editing), **Progress & Events** (full reading history of everything read, plus events), **Browse books** (Phase 2 library; ships as an "under construction" placeholder), and **Settings**. Reading actions live with care because reading *is* how you care for a creature; progress *reporting* lives on its own tab. Book discovery is deliberately in three places for three different intents: I have the book (Discover), one came to me (Habitat visitor), help me find one (Browse books).
6. **A recommendation visitor IS the recommended book's actual creature.** Mechanically it is an unrequested **preview**: the same unowned/unrevealed state, delivered by suggestion instead of by scanning. Reading its book reveals that same creature permanently, for free, because identity is deterministic. Because a creature's colours are generated from its book, the guest signal **must not be hue** — use non-colour cues (dashed outline, travel bag, outside the fence). Two hard rules: a visitor must read as a *guest*, never as an owned creature (or the earned-ness of the collection erodes); and a visitor must never read as *another player's pet* (this is the Animal Crossing grammar, and PRD 6.7 forbids revealing another user or creating a contact route). No visit timers or "leaving soon" pressure — that FOMO pattern is exactly what the never-punish pillar refuses.

Remaining questions:

4. **Availability vocabulary:** Freeze confirmed availability states, freshness rules, and official-search fallback shape before package 9.

Parked (see `Stacklings MVP Parking Lot v0.1.md`, "Deferred product work"), not implementation requirements until moved into a future PRD:

- **Habitat editing** — new scope; needs an approved earn rule that does not pay by minute, page, or book count.
- **Visitors that are the recommended book's real creature** (decision 6 above) — needs the guest-signal treatment and the prerequisite below.
- **Real identities for recommendation fixtures** — today's invented `work:fixture:*` ids prevent a visitor from rendering the creature the player would actually get.

Decision 5 (the six-tab phone shell) is built as of commit `7a609d4`. Decision 6 is approved in principle but parked until its fixture identities exist.
