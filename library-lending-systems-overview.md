# Library Lending Systems: Architecture, Business Models, and Integration Paths

**Purpose:** Reference document for an agent evaluating how library lending (digital and physical) works in North America, and the realistic technical and business paths for a new app to integrate with or build on top of these systems.

**Scope note:** Facts are current as of mid-2026 to the author's knowledge. Vendor relationships, API programs, and licensing terms change; verify anything load-bearing before acting on it.

---

## 1. The Two Stacks

Library lending is two largely separate ecosystems:

1. **Digital lending (ebooks/audiobooks):** Vendor-mediated content licensing. The vendor sits between publishers and libraries and controls both the content pipeline and (usually) the reader-facing app. The library never owns the content.
2. **Physical lending:** Library-owned inventory managed by rented software. Vendors provide the management systems (ILS) and discovery layers, but have no stake in the content. First-sale doctrine means publishers have no say in lending terms.

This distinction drives everything about integration feasibility. On the physical side, there are open-ish protocols and no licensing chokepoint. On the digital side, the content contracts ARE the product, and they are private.

---

## 2. Digital Lending Ecosystem

### 2.1 OverDrive / Libby (dominant player)

**Structure:** OverDrive is a B2B company (owned by KKR since 2020, previously Rakuten). Libby (launched 2017) is its consumer app. The library is the customer; the reader is the customer's patron.

**Business model:**
- OverDrive negotiates licensing terms with publishers (including all Big Five trade publishers).
- Libraries purchase licenses through OverDrive's Marketplace portal. Common license types:
  - **One copy / one user (OC/OU):** perpetual or term-limited; one simultaneous checkout per license.
  - **Metered access:** license expires after a set number of checkouts (commonly 26) or a time period (commonly 12-24 months), whichever publisher terms dictate.
  - **Cost-per-circ (CPC):** pay-per-checkout on select titles.
- New bestseller ebook licenses often run $55-65 per copy for libraries (vs. ~$15 consumer price), audiobooks often $95+.
- Wait lists exist because simultaneous-use is capped by licenses owned, not by technology.

**Technical architecture:**
- OverDrive hosts content, handles DRM (its own DRM plus Kindle fulfillment via an Amazon partnership in the US), manages holds/checkout state, and authenticates patrons against the library's ILS (see §3) using SIP2, an ILS API, or a patron database sync.
- OverDrive historically offered public developer APIs (Discovery API for catalog metadata/availability, Circulation API for checkout/holds on behalf of authenticated patrons). Access requires an approved partner agreement; this is not open self-serve infrastructure. Third-party library apps have integrated OverDrive content this way (e.g., aggregator apps used by some libraries), but OverDrive controls approval and has tightened access over time as it consolidated on Libby. **Treat API availability as a business-development question, not a technical one.**

**Moat:** License lock-in. A library's purchased OverDrive licenses do not transfer to competitor platforms. Leaving means abandoning the collection. Plus 90%+ penetration of North American public libraries and exclusive-feeling publisher relationships.

### 2.2 Hoopla (Midwest Tape)

**Model:** Pure pay-per-use. No licenses purchased; the library pays a fee per checkout (roughly $0.99-$3.99 depending on format/title). Consequences:
- No wait lists ever (unlimited simultaneous use).
- Libraries cap patron borrows per month (commonly 4-10) to control spend.
- Catalog skews backlist, comics, indie publishers, plus video/music; thinner on frontlist Big Five bestsellers.

**Integration posture:** Closed. Hoopla is a single vertically integrated app + content deal structure. No meaningful third-party app surface.

### 2.3 cloudLibrary (Bibliotheca → OCLC, acquired 2024)

Same licensed-copy model as OverDrive, much smaller share, thinner catalog. Notable mainly because OCLC (nonprofit library cooperative, see §3.4) now owns it, which may pull it toward more open, library-governed integration over time. Watch this space rather than build on it today.

### 2.4 Boundless (Baker & Taylor, formerly Axis 360)

OverDrive-style licensed model, concentrated in school libraries and smaller public systems. Baker & Taylor's core business is physical book distribution to libraries; Boundless is its digital arm. Closed consumer app.

### 2.5 Palace Project (the open one — most important for integration)

**What it is:** A nonprofit, open-source library-controlled platform stewarded by Lyrasis, with roots in NYPL's Library Simplified / SimplyE project and DPLA involvement. Built explicitly as a response to private-equity ownership of library lending infrastructure.

**Why it matters for a new app:**
- The entire stack is open source: the Palace apps (iOS/Android), the Circulation Manager (server), and the content management tooling.
- It is built on **open standards** (see §4): OPDS for catalogs, ODL for license terms, Readium LCP as a non-proprietary DRM.
- It is an **aggregator of aggregators:** a library running Palace can surface content from multiple sources in one app — its OverDrive collection (via OverDrive's API, where permitted), Bibliotheca/cloudLibrary, Boundless, DPLA Exchange content, Palace Marketplace titles, and open-access material.
- Adoption is still small (dozens-to-hundreds of libraries, not thousands) but it is the only credible "neutral pipes" play in digital lending.

**Implication:** A new app that wants to exist in digital library lending without negotiating its own Big Five publisher contracts should study Palace's architecture first. Forking or interoperating with the Palace Circulation Manager is the lowest-friction technical entry point in the entire digital ecosystem.

---

## 3. Physical Lending Ecosystem

### 3.1 The ILS (Integrated Library System)

The ILS is the system of record: catalog (MARC bibliographic records), item/inventory state across branches, patron accounts, checkouts, holds, fines, notices. Libraries rent this software; almost none build in-house.

**Major vendors:**
- **SirsiDynix** (Symphony, Horizon) — large public library share
- **Innovative Interfaces** (Sierra, Polaris) — owned by Clarivate
- **Ex Libris** (Alma) — Clarivate; dominant in academic libraries
- **Open source:** **Koha** (most-deployed open ILS worldwide, often via support vendors like ByWater Solutions) and **Evergreen** (built for consortia; runs large multi-library networks like Georgia PINES)

**Key point:** The library owns its physical inventory and its data outright. ILS migration is painful (data migration, staff retraining) but the collection survives vendor changes — the opposite of the digital side.

### 3.2 Discovery layers and patron apps

The ILS's built-in public catalog (OPAC) is typically dated, so libraries layer consumer-grade experiences on top:

- **BiblioCommons** — the premium patron-facing layer used by many large urban systems (Chicago, NYPL, Seattle, etc.). Provides web catalog + mobile app (BiblioApps) with Goodreads-style UX. Talks to the underlying ILS via vendor APIs.
- **Aspen Discovery** — open-source discovery layer (ByWater-supported) gaining share; notable because it unifies physical ILS holdings AND digital collections (OverDrive, Hoopla, cloudLibrary) in one interface.
- **White-label app vendors** — SOLUS, Capira (now part of OCLC), and others build branded library apps on top of ILS APIs.

Pattern: **branded by the library, built by vendors.** Patrons rarely know.

### 3.3 The protocol layer (this is the integration gold)

Physical-side integration is possible because decades-old open protocols exist:

- **SIP2 (Standard Interchange Protocol v2, 3M, 1990s):** The workhorse. A simple TCP text protocol for patron authentication, checkout, checkin, item status, fines. Built for self-checkout kiosks, now used by everything that needs to talk to an ILS — including OverDrive itself for patron auth. Nearly every ILS speaks it. Limitations: plaintext by default (usually wrapped in TLS/VPN), session-oriented, no rich catalog search.
- **NCIP (NISO Circulation Interchange Protocol, Z39.83):** XML-based successor standard for circulation interchange, heavily used in interlibrary loan and consortial borrowing. More capable than SIP2, less universally implemented.
- **Z39.50 / SRU:** Venerable search-and-retrieve protocols for querying catalogs (MARC records). Z39.50 is ancient but everywhere; SRU is its HTTP-based successor.
- **Vendor REST APIs:** Sierra API, Polaris API (PAPI), Symphony Web Services, Alma APIs, Koha REST API. Modern, capable (patron auth, account data, holds placement, renewals), but per-vendor, and the library must enable/license API access.
- **ILS-agnostic middleware:** Companies and projects exist specifically to abstract over ILS differences (this is effectively what BiblioCommons, Aspen, and Capira each built internally).

### 3.4 OCLC and interlibrary loan (the actual shared pipes)

**OCLC** is a nonprofit cooperative owned by member libraries. It runs:
- **WorldCat:** the global union catalog (aggregated holdings of tens of thousands of libraries) — searchable at worldcat.org, with APIs available to members/partners.
- **ILL infrastructure (WorldShare ILL, Tipasa):** the request-routing network that moves physical books between library systems.

This is the physical world's version of what Palace wants to be digitally: neutral, member-governed infrastructure. OCLC's 2024 acquisition of cloudLibrary and its ownership of Capira suggest it is assembling a library-governed alternative across both stacks.

---

## 4. Open Standards a New App Should Know

- **OPDS (Open Publication Distribution System):** Atom/JSON-based catalog feed format — "RSS for ebook catalogs." The lingua franca of open digital library systems (Palace, Internet Archive/Open Library, Standard Ebooks, many others). OPDS 2.0 is JSON-LD based.
- **ODL (Open Distribution to Libraries):** Extends OPDS to express library lending license terms (concurrent users, expiry, loan rules) machine-readably. This is the open answer to OverDrive's proprietary license management.
- **Readium LCP (Licensed Content Protection):** Open, non-proprietary DRM from the Readium Foundation/EDRLab. Publishers increasingly accept it (widely in Europe; growing in North America via Palace and library vendors). Removes dependence on Adobe or proprietary vendor DRM.
- **MARC21 / BIBFRAME:** Bibliographic record formats. MARC is the entrenched standard; BIBFRAME is the linked-data successor (slow adoption).
- **EPUB 3:** The content format itself, maintained by W3C.

---

## 5. Integration Paths for a New App

Ranked roughly from lowest to highest friction.

### Path A: Physical-side patron app (most open)
Build a better catalog/holds/account app on top of ILS APIs + SIP2/NCIP.
- **How:** Library-by-library sales. Each deployment needs the library to grant API/SIP2 access. Abstract over Sierra/Polaris/Symphony/Koha/Evergreen APIs (or start with open-source ILSes where nothing gates you).
- **Precedent:** BiblioCommons, Aspen, Capira, SOLUS all prove this works commercially.
- **Constraint:** No cross-library consumer play. Physical inventory is inherently local; the experience fragments per library system. The buyer is the library (B2B), not the reader.
- **Wedge idea:** Unify physical + digital in one interface (Aspen's playbook) — libraries actively want this because Libby/Hoopla fragmentation frustrates patrons.

### Path B: Build on Palace / open standards (most strategic on digital side)
Fork or interoperate with the Palace Circulation Manager; speak OPDS + ODL + LCP.
- **How:** Contribute to or build atop the open-source stack; sell libraries a hosted/managed experience; source content from Palace Marketplace, DPLA Exchange, open-access collections, and (where contracts permit) the library's existing OverDrive/cloudLibrary collections via their APIs.
- **Constraint:** Content is the weakness — frontlist Big Five availability through open channels is limited. You inherit Palace's catalog gaps.
- **Why do it anyway:** It's the only path where the infrastructure is genuinely open, and library-world sentiment (post-KKR) favors it. Slow, mission-aligned, consortium-speed growth.

### Path C: OverDrive API partnership (fastest content, gated)
Integrate OverDrive Discovery + Circulation APIs so patrons of OverDrive-customer libraries can browse/borrow through your app.
- **How:** Negotiate a partner agreement with OverDrive. Then per-library activation (the library authorizes your app against its collection) plus patron auth against the ILS.
- **Risk:** OverDrive has every incentive to funnel usage into Libby and has restricted third-party access historically. Your entire product exists at their pleasure. Do not build a company on this alone.

### Path D: Hoopla-style pay-per-use content deals (business-heavy)
Sidestep the license-inventory problem by negotiating per-checkout publisher deals yourself, then sell libraries a metered service.
- **Reality check:** This is a content-licensing business, not an app business. Years of publisher BD, meaningful minimum guarantees, and you compete with Midwest Tape's existing relationships. Only viable with serious capital and publishing-industry insiders.

### Path E: Adjacent/aggregation plays (no lending integration required)
- **Cross-library discovery:** "Which of my libraries has this book, physical or digital, and what's the wait?" — composable from WorldCat APIs, Z39.50/SRU, OverDrive's public availability pages, and per-library catalogs. (Precedent: the indie app Libby-adjacent tools and card-stacking behavior show demand.)
- **Reading-graph layers:** Goodreads-style social/tracking with deep links into Libby/Hoopla/catalog holds. No contracts needed for linking.
- **Caution:** Scraping availability data lives in ToS gray zones; prefer official APIs (WorldCat, library-enabled ILS APIs) where possible.

### Patron authentication (applies to every path)
Every integration ultimately needs to answer "is this a valid patron of library X?" The mechanisms, in rough order of prevalence: SIP2 auth against the ILS; ILS vendor REST API auth endpoints; OverDrive/vendor-mediated auth; newer OAuth-ish flows some ILSes expose. There is no universal library identity layer — this absence is itself a persistent gap in the ecosystem (and a recurring failed-startup graveyard; approach with respect).

---

## 6. Structural Dynamics to Keep in Mind

1. **The library is the customer everywhere.** Patrons pay nothing; every model is B2B or B2B2C. Sales cycles are municipal-procurement slow; budgets are flat or shrinking.
2. **Publisher friction is intentional on the digital side.** High license prices, metered expiry, and windowing exist because publishers fear frictionless library ebooks cannibalize retail. Any new digital entrant inherits this tension; it cannot be engineered away.
3. **License lock-in is the digital moat; data migration pain is the physical moat.** Different mechanisms, same effect: incumbents are sticky.
4. **The open-infrastructure trend is real but slow.** OCLC (nonprofit) now owns cloudLibrary and Capira; Palace/Lyrasis/DPLA push open digital lending; Aspen and Koha grow on the physical side. Direction of travel favors library-governed, standards-based systems — at consortium speed (years, not quarters).
5. **Consortia are the leverage point.** Libraries buy in groups (state consortia, regional networks). Winning one consortium deal can mean hundreds of libraries. This is how Evergreen, Palace pilots, and OverDrive itself scaled.

---

## 7. Quick Reference Table

| System | Layer | Owner/Steward | Model | Openness to new apps |
|---|---|---|---|---|
| OverDrive/Libby | Digital content + app | KKR (PE) | Licensed copies, B2B | Gated partner API; closed by default |
| Hoopla | Digital content + app | Midwest Tape | Pay-per-checkout | Closed |
| cloudLibrary | Digital content + app | OCLC (nonprofit) | Licensed copies | Closed today; nonprofit owner may open |
| Boundless | Digital content + app | Baker & Taylor | Licensed copies | Closed |
| Palace Project | Digital platform | Lyrasis (nonprofit) | Aggregator, open source | **Fully open (OPDS/ODL/LCP)** |
| SirsiDynix / Innovative / Ex Libris | Physical ILS | Private/Clarivate | SaaS to libraries | Per-vendor APIs, library-gated |
| Koha / Evergreen | Physical ILS | Open source | Community + support vendors | **Fully open** |
| BiblioCommons / Aspen / Capira | Discovery/app layer | Private / open / OCLC | SaaS to libraries | Aspen is open source |
| WorldCat / ILL | Union catalog + routing | OCLC (nonprofit) | Member cooperative | Member/partner APIs |

---

## 8. Recommended First Moves for an Agent Pursuing This

1. Read the Palace Project / Library Simplified source and docs (Circulation Manager especially) — it is a working map of every integration in the ecosystem, in code.
2. Stand up Koha or Evergreen locally and exercise SIP2 + the REST API to understand the physical-side surface area.
3. Prototype an OPDS 2.0 + ODL feed consumer.
4. Map target libraries by ILS vendor and digital vendor (this data is largely public via library websites and Marshall Breeding's "Library Technology Guides," the industry's canonical vendor-tracking resource).
5. Talk to a state consortium before talking to individual libraries.
