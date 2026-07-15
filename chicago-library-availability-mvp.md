# Chicago Public Library Physical Availability App — MVP Brief

## Purpose

Build an MVP that helps people discover physical items they can borrow from Chicago Public Library (CPL), with availability shown by branch and refreshed as circulation status changes.

The MVP should answer:

> “Can I borrow this physical item now, and where can I get it?”

This brief is written for a developer agent. It distinguishes what can be built immediately from what requires cooperation or credentials from CPL or its vendors.

## Executive Summary

The product is technically feasible. CPL's public catalog already exposes title-, format-, and branch-level availability to patrons. The underlying systems are:

- **Polaris**, CPL's integrated library system (ILS), which manages inventory and circulation.
- **BiblioCommons/BiblioCore**, CPL's public discovery and catalog interface.

Polaris provides a REST API (PAPI), but CPL controls access through API credentials and endpoint permissions. No public CPL developer portal, self-service API-key program, or documented open catalog API was found as of July 14, 2026.

Therefore, the preferred production integration is authorized, read-only API access from CPL. A prototype can use mock/sample data or a narrowly scoped adapter against public catalog pages, but scraping should not be treated as a reliable production dependency without written permission.

## Product Scope

### MVP user experience

A user can:

1. Search for a title, author, ISBN, or keyword.
2. Restrict results to physical, borrowable formats.
3. See whether an edition is available anywhere in CPL.
4. See availability by branch.
5. Filter or sort by nearest branch, available now, and format.
6. Open the corresponding official CPL catalog record to place a hold or complete account-related actions.
7. See when availability was last refreshed and understand that shelf status can change before arrival.

### Physical formats

Begin with:

- Books
- Paperbacks
- Large-print books
- Audiobook CDs
- DVDs/Blu-rays
- Music CDs and LPs

Design the format model so CPL's “Library of Things” and other physical collections can be included later.

### Explicitly out of scope for the first MVP

- Patron authentication
- Library-card storage
- Placing or cancelling holds inside the app
- Renewals, fines, checkout history, or account data
- Digital availability from Libby/OverDrive or other e-content vendors
- Guaranteed shelf presence
- Multi-library-system support

These features introduce substantially greater privacy, security, vendor, and contractual requirements.

## Confirmed System Context

### Public catalog

CPL's BiblioCommons catalog displays:

- Bibliographic records and editions
- Physical formats
- Overall status such as “Available” or “All copies in use”
- Location availability by branch
- Holds and copy counts in some contexts
- Links for placing holds

Example search:

<https://chipublib.bibliocommons.com/v2/search?origin=core-catalog-explore&query=Beloved&searchType=title>

Example physical record:

<https://chipublib.bibliocommons.com/v2/record/S166C800421>

### Inventory and circulation system

CPL uses Polaris as its ILS and BiblioCommons as the discovery layer. Publicly available reporting describes BiblioCommons as integrated with CPL's Polaris system through an API.

Polaris PAPI supports REST-based library applications. The library controls access using API keys and endpoint-level permissions. Official documentation states that third parties should contact the library's technical staff to request access.

CPL also operates an authorized-partner patron-verification service described as “powered by the Polaris API,” confirming that CPL has enabled Polaris API integrations in at least some partner contexts:

<https://chicago.polarislibrary.com/patronstatus/>

### What is not available through Chicago open data

The City of Chicago's public data offerings include aggregate and monthly CPL statistics, such as circulation and visits. No live title-, copy-, or branch-level availability dataset was found.

Do not design the MVP around the City open-data portal for catalog availability.

## Integration Strategy

Implement a provider abstraction so the UI and domain model are independent of the source.

```text
Client UI
   |
MVP application API
   |
CatalogProvider interface
   |-- MockCatalogProvider
   |-- PublicCatalogProvider (prototype only, permission-dependent)
   `-- PolarisCatalogProvider (preferred production path)
```

### Option A: Mock/sample provider

Use first to develop and validate the product without waiting for institutional access.

Requirements:

- Seed realistic titles, editions, branches, copy states, and timestamps.
- Simulate availability changes.
- Preserve the same data contract intended for the production provider.

This should be the default if official credentials are not present.

### Option B: Authorized Polaris API

This is the recommended production route.

Ask CPL for:

- Read-only bibliographic search
- Holdings/copies for a bibliographic record
- Branch or organization metadata
- Current circulation/availability status
- Stable record and item identifiers
- Rate limits and caching requirements
- A sandbox or test tenant
- Authentication method and key rotation requirements
- Permission to display or cache cover art and catalog metadata
- A webhook, incremental-change feed, or `updated_since` mechanism, if supported

If no change feed exists, use polling with cache revalidation and conservative request limits.

Do not request patron or staff endpoints for this MVP.

Polaris documentation:

<https://documentation.iii.com/polaris/PAPI/7.8/PAPIService/PAPIServiceOverview.htm>

### Option C: BiblioCommons-approved integration

Ask CPL whether BiblioCommons offers an approved catalog/search or availability feed for CPL partners. Treat it as an institutional/vendor partnership rather than assuming a public API exists.

### Option D: Public-page adapter

Use only for a disposable or internal proof of concept after checking applicable terms, robots rules, and receiving permission when required.

Constraints:

- Page markup and internal endpoints can change without notice.
- Anti-bot controls and rate limits may apply.
- Search-engine indexes are not sufficiently current for live availability.
- Public pages may combine data from multiple sources and may not expose stable identifiers.
- Scraped data must not be described as real-time unless its freshness is measured and defensible.

If implemented, isolate all parsing in `PublicCatalogProvider`, identify the app with an appropriate user agent where permitted, throttle requests, cache results, and fail gracefully to official CPL links.

## Freshness Model

“Updated when things are checked out” should be represented as **near-real-time availability**, not guaranteed real-time shelf presence.

Checkout, check-in, reshelving, transit, missing-item workflows, staff processing, and synchronization between Polaris and BiblioCommons can introduce delay. An item marked available may also be picked up by another patron before the user arrives.

Every availability response should include:

- `sourceUpdatedAt`, if supplied by the source
- `fetchedAt`, always generated by the application
- `freshnessSeconds`
- `isStale`
- A user-facing caveat such as “Availability can change before you arrive.”

Suggested initial cache policy:

- Search and bibliographic metadata: 6–24 hours
- Branch metadata: 24 hours
- Title-level availability: 2–5 minutes
- Branch/copy-level availability: 1–3 minutes when actively viewed
- Serve stale availability briefly during upstream failure, but label it clearly

Adjust these values to CPL/vendor requirements and observed capacity.

## Canonical Data Model

The exact external fields will depend on the approved integration. Normalize source-specific responses into the following conceptual model.

```ts
type PhysicalFormat =
  | "book"
  | "paperback"
  | "large_print"
  | "audiobook_cd"
  | "dvd"
  | "bluray"
  | "music_cd"
  | "lp"
  | "equipment"
  | "other_physical";

type AvailabilityStatus =
  | "available"
  | "checked_out"
  | "on_hold_shelf"
  | "in_transit"
  | "in_library_use_only"
  | "unavailable"
  | "unknown";

interface CatalogTitle {
  id: string;
  title: string;
  subtitle?: string;
  contributors: string[];
  description?: string;
  coverUrl?: string;
  editions: CatalogEdition[];
}

interface CatalogEdition {
  id: string;
  titleId: string;
  isbn?: string;
  publicationYear?: number;
  publisher?: string;
  format: PhysicalFormat;
  callNumber?: string;
  officialCatalogUrl: string;
  summary: AvailabilitySummary;
  holdings?: BranchHolding[];
}

interface AvailabilitySummary {
  status: AvailabilityStatus;
  totalCopies?: number;
  availableCopies?: number;
  holdsCount?: number;
  fetchedAt: string;
  sourceUpdatedAt?: string;
  isStale: boolean;
}

interface BranchHolding {
  branch: LibraryBranch;
  status: AvailabilityStatus;
  availableCopies?: number;
  totalCopies?: number;
  copies?: ItemCopy[];
}

interface ItemCopy {
  id?: string;
  status: AvailabilityStatus;
  callNumber?: string;
  dueDate?: string; // Include only if CPL explicitly permits public display.
}

interface LibraryBranch {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  officialUrl?: string;
}
```

Never collapse an unknown upstream status into “available.” Preserve the original source status for logging and map it conservatively.

## Suggested Application API

Keep this small for the MVP:

```text
GET /api/search?q=&format=&available=true&branch=&page=
GET /api/titles/:titleId
GET /api/editions/:editionId/availability
GET /api/branches
GET /api/health/catalog
```

Example search response:

```json
{
  "results": [],
  "page": 1,
  "hasMore": false,
  "fetchedAt": "2026-07-14T18:00:00Z",
  "source": "mock",
  "notice": "Availability can change before you arrive."
}
```

Provider interface:

```ts
interface CatalogProvider {
  search(input: SearchInput): Promise<SearchResult>;
  getTitle(titleId: string): Promise<CatalogTitle | null>;
  getAvailability(editionId: string): Promise<AvailabilitySummary>;
  getBranches(): Promise<LibraryBranch[]>;
  healthCheck(): Promise<ProviderHealth>;
}
```

## Search and Ranking

For the MVP:

1. Prefer exact ISBN matches.
2. Then rank title-prefix matches.
3. Then rank title/author keyword matches.
4. Prefer editions with at least one available physical copy when `available=true`.
5. When location is available and the user permits it, sort available branches by distance.
6. Never hide unavailable editions entirely unless the user selects “available now.”

Search should operate on works/titles but show availability at the edition and format level. A paperback and audiobook CD of the same work can have different statuses.

## UI States and Language

Use clear status labels:

- **Available now** — one or more copies reported available
- **All copies in use** — owned but no copies currently available
- **In-library use only** — physical item cannot be checked out
- **In transit** — moving between locations or being processed
- **Status unavailable** — source did not return a trustworthy state
- **Last checked _n_ minutes ago** — freshness disclosure

Each result should include an “Open in CPL catalog” action. Do not imply that the app itself reserves an item.

## Privacy and Security

This MVP does not need patron data.

- Do not collect library-card numbers or PINs.
- Do not proxy CPL sign-in pages.
- Do not log sensitive query parameters if future integrations add authentication.
- Store API credentials only on the server, never in browser or mobile clients.
- Use separate production and development credentials.
- Add request quotas, timeouts, retry limits, and circuit breaking around the upstream provider.
- Retain only the minimum source metadata needed for performance and debugging.

If patron features are later added, conduct a separate security and privacy design review before implementation.

## Reliability Requirements

- A catalog outage must not crash the UI.
- Clearly distinguish “unavailable” from “could not retrieve status.”
- Use bounded retries with exponential backoff and jitter.
- Respect upstream `Retry-After` and caching headers.
- Provide a direct link to the official CPL record when application data is stale or unavailable.
- Log provider latency, error rate, cache hit rate, and age of served availability.
- Do not automatically hammer the upstream provider after an outage.

## MVP Delivery Phases

### Phase 0: Institutional validation

- Contact CPL Library Technology or the website team.
- Request read-only API/partner access.
- Confirm allowed fields, caching, rate limits, attribution, branding, and acceptable use.
- Confirm whether CPL prefers Polaris PAPI or a BiblioCommons integration.

### Phase 1: Product prototype

- Implement the canonical model and provider interface.
- Add a mock provider with realistic branch and status data.
- Build search, title details, branch availability, filters, freshness labels, and official-catalog links.
- Test usability without depending on a live integration.

### Phase 2: Read-only live pilot

- Implement the authorized provider adapter.
- Add caching, throttling, provider health monitoring, and status mapping.
- Validate status freshness against the official catalog.
- Run a limited pilot and measure click-throughs to CPL.

### Phase 3: Production hardening

- Complete accessibility and privacy review.
- Load-test within approved limits.
- Add analytics that avoid patron identity.
- Document incident behavior and source outages.
- Expand physical formats and branch-distance features.

## Acceptance Criteria

The MVP is ready for a live pilot when:

- A user can find a physical title by title, author, or ISBN.
- Results distinguish editions and physical formats.
- Available branches are visible and can be sorted or filtered.
- Every availability state includes a refresh timestamp.
- Unknown or failed status is never presented as available.
- Every title links to the official CPL catalog.
- No patron credentials or account data are collected.
- The application remains usable when the live provider is slow or unavailable.
- The live data source and use are authorized by CPL or the relevant vendor.

## Contact Path

Start with CPL's Library Technology leadership or website contact:

- CPL administrative staff: <https://www.chipublib.org/administrative-staff/>
- General and website contacts: <https://www.chipublib.org/contact-us/>
- Website email listed by CPL: `webmaster@chipublib.org`

As of July 14, 2026, CPL lists Nicole Steeves as Director of Library Technology. Verify the current contact before outreach.

## Questions for CPL

1. Does CPL offer approved read-only API access for catalog search, holdings, and current physical-item availability?
2. Should a third-party application integrate through Polaris PAPI, BiblioCommons, or another CPL-managed service?
3. Is there a sandbox, sample dataset, or partner onboarding process?
4. Which identifiers are stable across catalog updates?
5. Are copy-level statuses and due dates permitted for public display?
6. What are the rate limits, cache requirements, attribution requirements, and acceptable-use restrictions?
7. Is there an incremental update feed, webhook, or timestamp filter for circulation changes?
8. May the app display cover art returned by the catalog?
9. What status vocabulary should the app present to patrons?
10. Does CPL require a security, accessibility, privacy, or branding review before launch?

## Research Sources

- CPL BiblioCommons search: <https://chipublib.bibliocommons.com/v2/search?origin=core-catalog-explore&query=Beloved&searchType=title>
- Example CPL catalog record: <https://chipublib.bibliocommons.com/v2/record/S166C800421>
- Polaris PAPI overview and access requirements: <https://documentation.iii.com/polaris/PAPI/7.8/PAPIService/PAPIServiceOverview.htm>
- Polaris API key management: <https://documentation.iii.com/polaris/PolarisSAWeb/current/PolarisSAWeb/PAPIKey/PAPIKey_Overview.htm>
- CPL authorized partner verification service: <https://chicago.polarislibrary.com/patronstatus/>
- CPL facts and figures/open-data pointer: <https://www.chipublib.org/facts-and-figures/>
- CPL administrative staff: <https://www.chipublib.org/administrative-staff/>
- CPL contact information: <https://www.chipublib.org/contact-us/>

## Key Decision

Build the MVP around a replaceable catalog-provider interface and mock data first. Pursue authorized CPL access in parallel. Do not make an undocumented BiblioCommons endpoint or HTML scraper the permanent foundation of the product.
