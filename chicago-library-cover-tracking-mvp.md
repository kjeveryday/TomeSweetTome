# Chicago Public Library MVP — Cover Tracking Implementation Brief

## Purpose

Implement reliable book and media cover display for the Chicago Public Library physical-availability MVP described in:

- [Chicago Public Library Physical Availability App — MVP Brief](./chicago-library-availability-mvp.md)

The cover system must find the artwork for the correct edition when possible, record where every image came from, respect provider usage requirements, and degrade gracefully when no trustworthy cover exists.

## Key Principle

Treat a cover as edition-level enrichment, not as a property of a general work or title.

Hardcover, paperback, large-print, translated, audiobook, movie, music, and revised editions may all have different artwork. A cover matched only by title and author can be misleading. Prefer a placeholder over a confidently displayed but incorrect cover.

## MVP Recommendation

Resolve covers in this order:

1. An approved cover URL supplied by CPL, Polaris, or BiblioCommons
2. Open Library using the edition's ISBN-13
3. Open Library using the edition's ISBN-10
4. Open Library using OCLC or LCCN identifiers
5. Google Books using an exact ISBN query
6. A local format-specific placeholder

Do not scrape retailer, publisher, CPL, or BiblioCommons pages for image files. Do not permanently copy externally hosted cover images unless the applicable license or agreement expressly permits it.

## Cover Sources

### 1. Authorized CPL or catalog-provider cover

This is the preferred source because it should correspond to the catalog record CPL presents to patrons.

If CPL provides API or partner access, ask whether responses include an approved `coverUrl`. Determine whether the image is supplied by:

- CPL
- BiblioCommons
- Syndetics or Bowker
- Another catalog-enrichment vendor

Before production use, confirm:

- Whether the application may embed the URL
- Whether the image may be cached or rehosted
- Required attribution or links
- URL lifetime and expiration behavior
- Permitted image transformations, resizing, or cropping
- Whether use is limited to CPL records
- Whether cover access terminates when the partnership ends

Do not assume that a visible image in the public CPL catalog is licensed for extraction or reuse by an unrelated application.

### 2. Open Library Covers API

Open Library provides a free cover API supporting:

- ISBN
- OCLC number
- LCCN
- Open Library edition ID (`OLID`)
- Open Library cover ID

URL format:

```text
https://covers.openlibrary.org/b/{key}/{value}-{size}.jpg?default=false
```

Example:

```text
https://covers.openlibrary.org/b/isbn/9780385533225-M.jpg?default=false
```

Sizes:

- `S`: small thumbnail
- `M`: medium display
- `L`: large display

Always append `?default=false`. A missing cover then returns `404` instead of Open Library's blank default image.

Open Library asks public applications to use image URLs pointing to `covers.openlibrary.org` and not to crawl the Covers API. It is suitable for low-volume, on-demand resolution. A courtesy link to the corresponding Open Library record is appreciated.

Documentation:

- <https://openlibrary.org/dev/docs/api/covers?m=view>
- <https://openlibrary.org/developers/api>

### 3. Google Books

Use Google Books only as an exact-identifier fallback.

Request:

```http
GET https://www.googleapis.com/books/v1/volumes?q=isbn:9780385533225
```

Possible response fields:

```json
{
  "items": [
    {
      "id": "google-volume-id",
      "volumeInfo": {
        "industryIdentifiers": [
          {
            "type": "ISBN_13",
            "identifier": "9780385533225"
          }
        ],
        "imageLinks": {
          "smallThumbnail": "https://...",
          "thumbnail": "https://...",
          "small": "https://...",
          "medium": "https://...",
          "large": "https://...",
          "extraLarge": "https://..."
        },
        "infoLink": "https://books.google.com/..."
      }
    }
  ]
}
```

Only accept a result if its returned ISBN matches one of the requested edition identifiers after normalization. Do not accept the first title/author search result as an edition match.

Google requires attribution and prominent links to Google Books when displaying information obtained from the Books API. Google also restricts permanent copies and caching beyond what its terms or response headers permit. Do not download Google cover images into permanent application storage unless a separate agreement expressly allows it.

Documentation:

- <https://developers.google.com/books/docs/v1/reference/volumes>
- <https://developers.google.com/books/branding>
- <https://developers.google.com/books/terms>
- <https://developers.google.com/terms/>

### 4. Syndetics/Bowker

Syndetics Unbound is a commercial catalog-enrichment product built for libraries. It covers books as well as video, DVD, and CD media, making it potentially useful when the MVP expands beyond books.

CPL or BiblioCommons may already license Syndetics. Ask CPL whether its existing agreement can cover this application before purchasing a separate subscription.

Product information:

- <https://about.proquest.com/en/products-services/Syndetic-Solutions/>

## Identifier Model

Store multiple identifiers for each edition.

```ts
interface EditionIdentifiers {
  isbn10?: string;
  isbn13?: string;
  oclc?: string;
  lccn?: string;
  openLibraryEditionId?: string;
  cplRecordId?: string;
  sourceRecordId?: string;
}
```

Normalize identifiers before comparison:

- Remove spaces and hyphens from ISBNs.
- Convert lowercase `x` check digits to uppercase `X`.
- Validate ISBN-10 and ISBN-13 checksums.
- Preserve the original identifier for debugging.
- Normalize OCLC prefixes such as `(OCoLC)` only if the upstream contract permits deterministic parsing.
- Do not convert an ISBN into a presumed edition match without validating the converted identifier.

When both ISBN-10 and ISBN-13 are available, retain both. They can refer to the same edition and improve cover resolution.

## Canonical Cover Record

Track every selected cover as structured data rather than storing a single unqualified URL.

```ts
type CoverProvider =
  | "cpl"
  | "bibliocommons"
  | "syndetics"
  | "open_library"
  | "google_books"
  | "placeholder";

type CoverMatchMethod =
  | "provider_record"
  | "isbn13"
  | "isbn10"
  | "oclc"
  | "lccn"
  | "open_library_edition"
  | "format_placeholder";

type CoverConfidence = "exact" | "provider_asserted" | "fallback";

interface CoverAsset {
  editionId: string;
  provider: CoverProvider;
  matchMethod: CoverMatchMethod;
  matchedIdentifier?: string;
  confidence: CoverConfidence;

  imageUrl: string;
  thumbnailUrl?: string;
  detailUrl?: string;
  providerRecordUrl?: string;

  width?: number;
  height?: number;
  mimeType?: string;

  attributionText?: string;
  attributionUrl?: string;
  requiresAttribution: boolean;

  storagePolicy: "remote_only" | "temporary_cache" | "rehost_allowed";
  cacheExpiresAt?: string;

  resolvedAt: string;
  lastValidatedAt: string;
  resolutionVersion: number;
}
```

Also retain failed attempts for a bounded period:

```ts
interface CoverResolutionAttempt {
  editionId: string;
  provider: CoverProvider;
  matchMethod: CoverMatchMethod;
  identifier?: string;
  outcome:
    | "selected"
    | "not_found"
    | "identifier_mismatch"
    | "rate_limited"
    | "provider_error"
    | "invalid_image";
  attemptedAt: string;
  retryAfter?: string;
  httpStatus?: number;
}
```

Do not persist API keys, full response bodies containing unnecessary data, or signed image URLs in diagnostic logs.

## Resolver Interface

```ts
interface CoverResolver {
  resolve(input: CoverResolutionInput): Promise<CoverAsset>;
  validate(asset: CoverAsset): Promise<CoverValidationResult>;
}

interface CoverResolutionInput {
  editionId: string;
  title: string;
  contributors: string[];
  format: PhysicalFormat;
  identifiers: EditionIdentifiers;
  catalogCoverUrl?: string;
  catalogRecordUrl?: string;
}

interface CoverValidationResult {
  valid: boolean;
  checkedAt: string;
  status?: number;
  contentType?: string;
  reason?: string;
}
```

## Resolution Algorithm

```text
resolveCover(edition):
  1. Return a still-valid cached CoverAsset, if present.
  2. If an authorized catalog cover URL exists:
       validate URL and content type
       record provider and policy
       select it
  3. For each valid exact identifier in priority order:
       a. Open Library ISBN-13
       b. Open Library ISBN-10
       c. Open Library OCLC
       d. Open Library LCCN
       e. Open Library edition ID
  4. Query Google Books by exact ISBN:
       confirm returned ISBN equals requested ISBN
       record attribution and remote-only policy
       select the best available image size
  5. Return the local placeholder for the edition's physical format.
  6. Save the selected asset and bounded failure history.
```

Provider calls should be sequential by priority, but independent cover resolutions should use a bounded worker pool. Do not issue every provider request simultaneously for every result.

## Image Validation

Before selecting a remote image:

- Accept only `https` URLs.
- Allowlist known provider hosts.
- Follow a small, bounded number of redirects.
- Reject redirects to private, loopback, link-local, or unexpected hosts.
- Require an image content type such as JPEG, PNG, or WebP.
- Enforce response-size limits.
- Reject zero-byte and obviously invalid images.
- Do not fetch arbitrary image URLs supplied by users.
- Use timeouts and bounded retries.

These controls prevent the cover resolver from becoming a server-side request-forgery or unbounded-download mechanism.

If validation requires downloading bytes, avoid doing so on every page view. Validate during resolution and revalidate according to the provider's cache policy.

## Caching and Storage

### Metadata cache

Cache the normalized `CoverAsset` record separately from image bytes.

Suggested starting values:

- Successful external resolution: 30 days
- Missing Open Library cover: 7 days
- Missing Google Books result: 7 days
- Rate-limited provider: honor `Retry-After`
- Temporary provider failure: retry after 15–60 minutes with backoff
- Placeholder selection: re-resolve after 7 days

Provider instructions and response headers override these defaults.

### Image storage

Default to remote image URLs.

- `remote_only`: render from the provider host; do not copy the image.
- `temporary_cache`: cache only within the permitted duration and revalidate.
- `rehost_allowed`: store in the application's object storage only when the license or partner agreement explicitly permits it.

Never infer rehosting permission from public accessibility.

### Cache invalidation

Re-run resolution when:

- Edition identifiers change
- CPL supplies a new approved cover URL
- The chosen URL repeatedly returns `404` or an invalid image
- Provider permissions or terms change
- An administrator requests a refresh
- `resolutionVersion` changes after a resolver upgrade

## Application API

The catalog API can include the selected cover directly:

```json
{
  "id": "edition-123",
  "title": "Beloved",
  "format": "paperback",
  "cover": {
    "imageUrl": "https://covers.openlibrary.org/b/isbn/9781400033416-M.jpg?default=false",
    "thumbnailUrl": "https://covers.openlibrary.org/b/isbn/9781400033416-S.jpg?default=false",
    "provider": "open_library",
    "confidence": "exact",
    "requiresAttribution": false,
    "providerRecordUrl": "https://openlibrary.org/isbn/9781400033416"
  }
}
```

Optional administrative endpoint:

```text
POST /api/admin/editions/:editionId/cover/refresh
```

Protect administrative refresh operations with authorization and rate limiting. Do not expose a public endpoint that permits unlimited provider lookups.

## UI Requirements

- Preserve the cover's natural aspect ratio.
- Use a stable layout box to prevent page movement while images load.
- Use `object-fit: contain`; avoid cropping meaningful cover artwork.
- Lazy-load images below the fold.
- Supply a useful alt value, such as `Cover of Beloved`, or an empty alt value when adjacent visible text already conveys the same information.
- Show a consistent format-specific placeholder if no cover is found.
- Render provider attribution and provider links when required.
- Do not show a broken-image icon during provider outages.
- Do not label a fallback as the exact edition unless it was identifier-matched.

Suggested placeholders:

- Book/paperback
- Large print
- Audiobook CD
- DVD/Blu-ray
- Music CD/LP
- Equipment/Library of Things
- Other physical material

Create placeholders as local application assets with no external dependency.

## Observability

Track:

- Cover resolution success rate
- Resolution success by provider
- Exact-match rate
- Placeholder rate
- Provider latency and error rate
- Rate-limit responses
- Broken-image reports
- Percentage of assets due for revalidation

Never use image-provider requests as a hidden user-tracking mechanism. Where possible, proxy only when legally permitted and privacy-justified; otherwise disclose external image providers in the privacy documentation.

## Testing

### Unit tests

- ISBN-10 and ISBN-13 normalization and checksum validation
- Provider priority order
- Exact Google Books ISBN verification
- Open Library URL construction
- `?default=false` inclusion
- Status handling for `404`, `429`, and `5xx`
- Placeholder selection by format
- Cache expiration and re-resolution
- Attribution fields
- Disallowed URL and redirect rejection

### Integration tests

- Known ISBN with an Open Library cover
- Known ISBN without an Open Library cover
- ISBN resolved by Google Books only
- Catalog-provided cover overriding public fallbacks
- Remote image disappearing after it was selected
- Provider timeout and stale cached asset
- All providers unavailable

Do not make the full automated test suite depend on live third-party APIs. Record compliant fixtures or use provider mocks. Keep a small opt-in smoke test for live provider behavior.

### Visual tests

- Portrait, square, and unusually tall covers
- Missing image
- Slow image load
- Mobile result list
- High-contrast mode
- Screen-reader labeling
- Placeholder appearance for every supported physical format

## Acceptance Criteria

Cover tracking is ready for the MVP when:

- Every edition returns either a validated cover or a local placeholder.
- Exact identifiers are preferred over title/author matching.
- The selected provider, match method, identifier, confidence, and validation time are recorded.
- Google-derived content includes the required attribution and link behavior.
- Images are not permanently copied unless their usage policy permits it.
- Missing or failed provider responses are cached to prevent repeated requests.
- Provider failure cannot break catalog search or availability display.
- The application never fetches arbitrary user-controlled URLs.
- Administrators can refresh an incorrect or stale cover without altering bibliographic data.

## Deferred Features

- Human correction workflow for mismatched covers
- Administrator-selected overrides
- User reports for incorrect covers
- Perceptual-hash detection of blank or duplicate images
- Multi-image edition galleries
- Bulk Syndetics integration
- Cover ingestion into a licensed internal CDN
- AI-generated decorative artwork

Do not use AI-generated art as if it were an edition's authentic cover. Generated visuals, if ever introduced, must be clearly presented as placeholders or decorative artwork.

## Implementation Checklist

- [ ] Add edition identifier normalization and validation.
- [ ] Add `CoverAsset` and `CoverResolutionAttempt` persistence.
- [ ] Implement provider interfaces.
- [ ] Implement authorized catalog provider when access is available.
- [ ] Implement Open Library resolver.
- [ ] Implement exact-ISBN Google Books fallback.
- [ ] Add local format placeholders.
- [ ] Add URL allowlisting and image validation.
- [ ] Add positive and negative caching.
- [ ] Add attribution rendering.
- [ ] Add metrics and error reporting.
- [ ] Add unit, integration, and visual tests.
- [ ] Confirm CPL/vendor image permissions before production launch.

## Final Decision

For the initial MVP, use an approved CPL/catalog cover whenever available, Open Library as the primary public fallback, Google Books as an exact-ISBN secondary fallback, and local format placeholders for everything else. Preserve provenance and permission metadata for every selected image so a future provider or licensing change does not require rebuilding the catalog model.
