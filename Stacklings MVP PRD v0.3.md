# Stacklings MVP Product Requirements

Version 0.3  
Date: July 15, 2026  
Status: Developer implementation specification

## 1. Product goal

Extend the working `creature-care-mvp` into a book-powered creature game without replacing its existing event reducer, care rules, persistence, ISBN scanner, deterministic generator, metadata lookup, or tests.

The primary interface audience is ages 6–12. The same records and rules must support younger children being read to and older readers completing longer works without creating a lesser or greater form of progress.

The minimum complete loop is:

1. Add a book by scanning its barcode, entering its ISBN, or searching by title and author.
2. See a creature preview.
3. Record that reading occurred, with or without a timer.
4. Reveal the creature associated with that work.
5. Care for the active creature and return to the same book or another book later.
6. Receive book recommendations through visiting creatures.

The product must use functional language. Do not introduce names for mechanics, currencies, progress systems, rooms, modes, or events unless the name already exists in approved product content.

## 2. Existing v1 baseline

The following behavior already works and must be extended rather than rebuilt:

| Capability | Current state | MVP treatment |
|---|---|---|
| Barcode image scanning | Implemented locally with a manual ISBN fallback | Preserve |
| ISBN validation and normalization | Implemented for valid book identifiers | Preserve |
| Deterministic creature generation | Implemented with a versioned SHA-256 seed | Preserve existing identities |
| Book metadata | Implemented with pinned fixtures and Open Library enrichment | Keep behind a provider interface |
| Care actions and mood | Implemented | Preserve behavior and tests |
| Daily care-action cap | Implemented | Preserve; separate from reading progress |
| Growth and absence behavior | Implemented | Preserve; add book relationship development separately |
| Local persistence | Implemented in `localStorage` | Keep as the guest storage adapter |
| Automated tests | 63 tests passing on July 15, 2026 | All must remain passing |

The existing code stores one active creature plus prior generated identities. The MVP must convert this into explicit collection records without losing existing saves.

## 3. Binding product rules

1. Any sustained reading can count, including print, ebooks, audiobooks, comics, reading aloud, being read to, rereading, and reading in any language.
2. Formal challenge progress is based on distinct reading days, not minutes, pages, titles, difficulty, or completion.
3. The default challenge is 20 distinct reading days. Halfway is 10 days. A library program may supply an eight-week program window; standalone participation has no forced deadline.
4. Monthly themes may change content and presentation. They must not erase creature, collection, book, or reading history.
5. Missing days never reset progress or harm a creature.
6. Reading progress is capped at one formal reading day per local calendar date. Multiple books may still create or develop multiple creatures on that date.
7. A timer is optional. An untimed “I read this” action is equally valid.
8. Minutes may be stored privately when the timer is used. Minutes do not create currency, power, public totals, or additional formal progress.
9. A scan creates a preview. The first reading record for that work reveals and adds its creature.
10. Continued reading on distinct days develops the existing creature through non-ranked visual, behavioral, or interaction changes.
11. Finishing a book creates a significant visible response, such as a permanent completion marker. Finishing is not required to keep the creature or complete the reading challenge.
12. Different editions and formats of the same work share one base creature when work matching is available. Existing v1 creatures never reroll.
13. One creature is active. A limited set may be visible. Every discovered creature remains available in the collection.
14. Creatures never die, lose permanent progress, or appear harmed because the player was absent.
15. There is no individual leaderboard, public reading total, open chat, direct messaging, friend list, trading, or user-to-user recommendation system in MVP.
16. Community progress uses at most one normalized contribution per participant per reading day. It never advances from raw book or minute totals.
17. Accounts are optional for the core loop. The app must clearly explain that an account saves and synchronizes progress. Synchronized accounts for the primary audience are created and managed through a guardian account flow.
18. A signed-in account is required before linking library credentials, using patron actions, or joining account-based library events.
19. Library availability and patron actions use provider interfaces. Mock data is used when an approved live integration is unavailable and must be labeled as sample data.
20. Every optional module must be removable without breaking the minimum complete loop.

## 4. Module map

| Module | Required for core loop | Owns | Depends on |
|---|---:|---|---|
| State and storage | Yes | State schema, reducer, migration, storage adapters | Nothing |
| Player account | No | Guest/account state, synchronization, session | State and storage |
| Book records | Yes | ISBNs, work identity, editions, metadata | State and storage; metadata provider |
| Reading | Yes | Reading records, timer, reading-day progress, book status | Book records; state and storage |
| Creature generation and collection | Yes | Preview, reveal, work-creature link, active creature, collection | Book records; reading |
| Care and development | Yes | Existing care state, book relationship development, optional care items | Creature collection; reading |
| Recommendations | Yes | Recommendation request, visitor presentation, explanation, reset | Book records; recent reading data |
| Library catalog | No | Branches, availability, official record links | Book records; catalog provider |
| Library patron actions | No | Library credential link, hold/borrow requests | Player account; library provider |
| Community events | No | Event configuration, registration, aggregate progress | Player account; reading; admin provider |
| Settings and evidence | Yes | Privacy controls, account/library controls, research content | Provider status; static content |

The core loop must work with player accounts, library catalog, library patron actions, and community events disabled.

### Approved delivery phases

| Phase | Required outcome | Included modules |
|---|---|---|
| Phase 1 — Core guest MVP | Complete local reading and creature loop without an account or live service | State and storage, book records, reading, creature generation and collection, care and development, fixture recommendations, settings and evidence; optional-service contracts remain disabled |
| Phase 2 — Account and library services | Optional guardian-managed synchronization and library data without changing the Phase 1 records | Player account, synchronized storage, catalog fixture, approved live catalog provider when available, library patron provider seam |
| Phase 3 — Community events | Optional staff-managed participation without child-to-child communication | Community event provider, administrator username search and registration, normalized aggregate progress, audit log |

Each phase is additive. A later phase must use the shared records, events, providers, and feature flags defined by the earlier phase. Disabling a later phase must restore the complete prior-phase experience without data loss.

## 5. Shared state and events

All state changes continue through the existing pure reducer. A module may emit an event but may not directly change another module’s state.

### Shared records

```ts
interface BookWork {
  id: string;
  title: string;
  authors: string[];
  metadataStatus: "unknown" | "partial" | "resolved";
  editionIds: string[];
}

interface BookEdition {
  id: string;
  workId: string;
  isbn13?: string;
  format?: string;
  metadataSource: string;
}

interface ReadingRecord {
  id: string;
  workId: string;
  occurredAt: string;
  localDayKey: string;
  durationSeconds?: number;
  mode?: "independent" | "shared" | "read_aloud" | "listened";
  status?: "reading" | "finished" | "paused" | "not_for_me";
}

interface CreatureRecord {
  id: string;
  workId: string;
  identityVersion: string;
  identityKey: string;
  baseTraits: object;
  revealed: boolean;
  relationshipDayKeys: string[];
  finished: boolean;
  careState: object;
}

interface PlayerAccess {
  accountStatus: "guest" | "signed_in";
  libraryStatus: "disconnected" | "connected";
}
```

### Shared events

```text
BookAdded
BookMetadataResolved
BookWorkReconciled
ReadingRecorded
ReadingDayRecorded
BookStatusChanged
CreaturePreviewCreated
CreatureRevealed
CreatureRelationshipChanged
CareActionPerformed
CareItemGranted
CareItemUsed
RecommendationRequested
RecommendationDelivered
CatalogAvailabilityResolved
AccountSignedIn
LibraryConnected
EventRegistrationChanged
CommunityContributionRecorded
```

Events must contain stable IDs, an event version, and a timestamp. Event names and payloads are shared contracts and must be reviewed before an agent changes them.

## 6. Module requirements

### 6.1 State and storage

- Migrate existing `creatureCare.save.v1` data without losing the active creature, prior creature identities, care progress, stickers, or timestamps.
- Implement `LocalStorageAdapter` for guests and `SyncedStorageAdapter` for signed-in accounts.
- The application uses one storage adapter at a time. Signing in merges the current local save into the account after showing the user what will happen.
- A guest save is recoverable only on the current browser. The account screen must state this before sign-in.
- Expose `load`, `save`, `export`, `delete`, and `healthCheck` through the adapter contract.

### 6.2 Player account

- Guest play begins without registration.
- Account creation is optional and described as the way to save and synchronize progress.
- Accounts for the primary audience are guardian-managed. Do not enable collection of real child account data until the guardian notice, consent, retention, export, deletion, and recovery requirements have been approved.
- Library linking is available only after sign-in.
- Do not create public profiles. A username is visible only to the account holder and authorized event administrators.
- Keep account and library connection as separate fields so the account module can work without a library provider.
- If account services are unavailable, guest play remains fully functional.

### 6.3 Book records

- Preserve barcode image input and manual ISBN input.
- Add title-and-author search as the fallback for books without a usable ISBN.
- Normalize editions into a work record when metadata supports it.
- Generation accepts `{identityVersion, identityKey}` instead of assuming every identity key is an ISBN.
- Use a stable provider work ID when available. Otherwise use the existing ISBN identity. Existing v1 ISBN identities remain unchanged.
- If later metadata connects editions to one work, create an alias for future captures. Do not reroll a creature already owned.
- Metadata may be missing. A missing record must not block an honor-based reading record.

### 6.4 Reading

- The user selects a book and chooses either “I read this” or the optional timer.
- Starting the timer creates only a private session. Stopping it offers the same reading confirmation as the untimed route.
- The first accepted reading record on a local date emits one `ReadingDayRecorded` event. Later records that date remain attached to their books but do not add formal progress.
- Reading a different book may reveal a different creature even when formal daily progress is already recorded.
- Rereading and shared reading use the same record shape and are never treated as lesser routes.
- Paused and not-for-me statuses preserve all progress and the creature.
- Program status is derived as registered, active, halfway at 10 days, and completed at 20 days.

### 6.5 Creature generation and collection

- Adding a book produces a deterministic preview.
- The first reading record reveals the preview and adds the creature to the collection.
- One work has one creature per player. Repeated scans open the existing book/creature record.
- Several new books recorded in one session may reveal several creatures. Present them as one compact group and retain an individual record for each.
- Support one active creature, a configurable number of visible creatures, and an unbounded archived collection.
- Returning a borrowed book never removes its creature.

### 6.6 Care and development

- Preserve all current care, mood, clock, absence, and persistence behavior unless a separate approved change says otherwise.
- Care is always available and never requires reading.
- A creature records at most one relationship day for its work per local date.
- Continued relationship days select the next configured non-ranked visual, behavioral, or interaction response. Minutes, pages, and book length do not make a creature stronger.
- A long-book reader receives a meaningful relationship response on continued reading days. A short-book reader receives discovery responses for new books and relationship responses for rereading.
- Finishing a book records a permanent visible completion response without granting power.
- Optional care items are limited to treats in MVP:
  - The first formal reading day may grant one treat based on a broad book category.
  - The grant does not increase with minutes or number of books.
  - Using a treat performs the normal feed effect with a different animation. It does not grant additional reading progress, creature power, or care progress beyond the existing care rules.
  - Treats do not expire and cannot be purchased or traded.
- The entire care-item path is controlled by a feature flag.

### 6.7 Recommendations

- The MVP recommendation input is recent broad book categories plus an optional selected branch.
- Do not infer reading ability, identity, or sensitive personal traits.
- A new user may receive a general recommendation before enough history exists.
- A recommendation is presented through a visiting creature and includes one or more books that may be saved or dismissed.
- Every personalized recommendation provides a short reason and controls to reset recent preference data or delete recommendation inputs.
- No recommendation reveals another user or creates a route to contact another user.
- `RecommendationProvider` must support a deterministic fixture implementation and a future live implementation.
- If the module is disabled, the core reading and care loop remains complete.

### 6.8 Library catalog

- Keep bibliographic metadata separate from live library availability.
- Implement this provider contract:

```ts
interface CatalogProvider {
  search(query: string, branchId?: string): Promise<CatalogSearchResult>;
  getAvailability(editionId: string, branchId?: string): Promise<AvailabilityResult>;
  getBranches(): Promise<LibraryBranch[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

- Build `MockCatalogProvider` first using realistic branch, edition, availability, timestamp, and official-link fields.
- Add an approved live provider when credentials are available. Do not make production scraping a required dependency.
- Label fixture results “Sample availability.” Label live results with source and last-checked time.
- If availability cannot be retrieved, show the official catalog link rather than reporting a false unavailable or available state.
- Recommendations use branch availability only when the provider is live or explicitly in sample mode.

### 6.9 Library patron actions

- Require a signed-in account before connecting library credentials.
- Keep patron authentication and hold/borrow operations behind `LibraryPatronProvider`.
- Never store a card PIN in client state or logs.
- When a live provider is unavailable, the module may demonstrate the complete flow with fixtures but must label it as a demonstration and provide the official library link.
- Disabling this module must not disable catalog browsing or guest play.

### 6.10 Community events

- Require a signed-in account and connected library for account-based event participation.
- An authorized administrator can create an event, search an exact or partial username, and register or remove that account from the event.
- Username search returns only the minimum fields needed to identify the account. It never exposes reading history, age, library card number, or private book data.
- Record administrator ID, event ID, account ID, action, and timestamp in an audit log.
- Community progress accepts no more than one contribution per registered participant per reading day.
- Show aggregate progress and shared visual changes. Do not show individual totals or rankings.
- There is no chat, messaging, commenting, friend list, trading, or participant search for ordinary users.
- Disabling this module must remove event and community surfaces without affecting personal progress.

### 6.11 Settings and evidence

Settings must include:

- Guest/account state and a plain explanation of save and synchronization behavior.
- Library connection state and provider status.
- Export and delete controls.
- Recommendation explanation, reset, and delete controls.
- A “Research and design” section containing the approved content below.

| Design rule | In-app explanation | Source |
|---|---|---|
| Frequent reading | Stacklings records whether reading happened on a day. Research supports frequent connected-text reading, while no universal minute requirement fits every child. The exact 20-day goal is a configurable program target, not a medical dosage. | [What Works Clearinghouse practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/21/Published) |
| Shared reading counts | Reading aloud and being read to count. Shared reading supports language-rich interaction and early relationships. | [American Academy of Pediatrics policy statement](https://publications.aap.org/pediatrics/article/154/6/e2024069090/199467/Literacy-Promotion-An-Essential-Component-of) |
| Choice and no penalties | Players choose what and how to read. Missing days, stopping a book, or changing formats never removes progress. | [Children and Libraries review of motivation in summer reading](https://journals.ala.org/index.php/cal/article/view/6236/8124) |
| Reading-related rewards | The game avoids paying by minute or book count. Research found that a book reward or no reward sustained later reading better than an unrelated token reward. | [Marinak and Gambrell, 2008](https://doi.org/10.1080/19388070701749546) |
| Limited external rewards | Treats and recognition are capped and do not create power or competition. Broad motivation research cautions that controlling tangible rewards can undermine intrinsic motivation. | [Deci, Koestner, and Ryan, 1999](https://pubmed.ncbi.nlm.nih.gov/10589297/) |
| Library reading programs | The design uses a simple goal, self-reporting, visible progress, and recognition, which are common components of established public-library summer reading programs. | [Collaborative Summer Library Program](https://www.cslpreads.org/childrens-program/) |
| Program outcomes | Public-library summer reading participation has been associated with positive reading and library outcomes, while the study design also had important participation and matching limitations. | [The Dominican Study](https://www.ireadprogram.org/content/documents/report.pdf) |

Research content lives in versioned data with `title`, `summary`, `sourceLabel`, `sourceUrl`, and `lastReviewedAt`. The screen must not claim that research validates the exact creature design or proves that the configured threshold is optimal.

## 7. Provider contracts and fallbacks

| Provider | Development implementation | Production implementation | Failure behavior |
|---|---|---|---|
| Metadata provider | Existing pinned data plus Open Library | Approved metadata sources | Keep ISBN/work record with unknown metadata |
| Storage adapter | Local storage and in-memory sync fixture | Account-backed synchronization | Continue locally and show sync status |
| Account provider | Local test accounts | Approved authentication service | Guest mode remains available |
| Recommendation provider | Deterministic fixture recommendations | Curated or approved recommendation service | Show general recommendations or no visitor |
| Catalog provider | Sample branch and availability data | Approved library catalog API | Show official catalog link and unknown status |
| Library patron provider | Demonstration-only fixture | Approved patron/hold API | Disable in-app action and show official link |
| Event admin provider | Local administrator fixture | Authenticated role-based service | Hide admin controls |

Provider responses must identify their source as `fixture`, `live`, or `unavailable`. The UI must never present fixture data as live.

## 8. Feature flags

```text
timer
accounts
careItems
recommendationVisitors
libraryCatalog
libraryPatronActions
communityEvents
researchSettings
```

Every optional module must have tests showing that the application still starts and the minimum complete loop still works when its flag is off.

## 9. Implementation sequence

1. Freeze shared records, events, provider interfaces, feature flags, and save migration.
2. Migrate the existing single-creature save into book, creature, and collection records.
3. Add reading records, reading-day progress, and optional timer.
4. Change scan behavior from immediate acquisition to preview followed by first-reading reveal.
5. Add collection selection and book relationship development.
6. Add recommendations using the fixture provider.
7. Add settings, research content, export, and delete controls.
8. Add account and synchronized-storage providers.
9. Add catalog and patron provider seams, then connect live services only when approved credentials exist.
10. Add community events and administrator registration behind its feature flag.

## 10. Multi-agent implementation rules

1. One agent owns the shared contract files. Contract changes require review by every module that consumes them.
2. Each module owns its state slice, pure reducer cases, provider adapter, UI surface, and tests.
3. Agents communicate through the shared events and provider interfaces. They must not import another module’s private implementation.
4. Every provider has a mock implementation committed with the contract so another agent can integrate without waiting for a live service.
5. Every module is developed behind its feature flag until its integration tests pass.
6. Save migration and shared event tests run in every module branch.
7. Integration tests use the public interface, not private module functions.
8. Any new mechanic, user-facing system name, currency, ranking rule, or social interaction requires a product decision before implementation.

## 11. MVP acceptance criteria

1. All existing v1 tests remain green.
2. A guest can add a valid book, record reading without a timer, reveal its creature, care for it, close the app, and return with state preserved.
3. The timer route produces the same reading-day result as the untimed route.
4. Reading three books on one day may reveal three creatures but records only one formal reading day and at most one treat.
5. Continued reading of one long book produces relationship responses on later reading days without using pages, minutes, or strength.
6. Rereading a short book develops its existing creature and never creates a duplicate.
7. Finishing creates a visible completion response but is not required for challenge completion.
8. Existing v1 creature identities remain stable after save migration.
9. Guest play works with every optional feature flag off.
10. Signing in migrates the local save and restores it through the synchronized storage test provider.
11. Recommendation fixtures can produce, explain, save, dismiss, reset, and delete a recommendation without exposing another user.
12. Catalog fixtures are clearly labeled as sample availability; unavailable live data falls back to the official catalog link.
13. An authorized test administrator can find a username and register the account for an event without seeing private reading data.
14. Community progress uses normalized daily contributions and exposes no individual ranking.
15. The settings screen displays the research summaries and opens every source link.
16. No public profile, chat, direct message, friend list, trading, user recommendation, public minutes, or duration-based power exists.

## 12. Out of scope

The MVP excludes everything listed in `Stacklings MVP Parking Lot v0.1`, plus monetization, advertising, combat, breeding, open social features, reading quizzes, reading-level scoring, continuous surveillance, and production scraping of library catalog pages.
