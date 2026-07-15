# Book Values → Creature Generation

**A design overview of the generative value space of a scanned library book**

*Stacklings working document — exploratory design input, not a decision doc. Hash outputs in the worked examples are illustrative; the real algorithm is not fixed yet.*

---

## 1. What a scan actually yields

A barcode scan in a library aisle produces one guaranteed thing and two best-effort things, and the design should treat them as three distinct tiers rather than one blob of "book data."

**Tier 1 — the raw number (guaranteed, offline).** The camera reads an EAN-13 barcode and hands us 13 digits. For nearly every trade book printed since 2007 this is the ISBN-13; for older stock it is usually the ISBN-10's EAN "Bookland" repackaging, which is the same number in a different coat. This tier works in a basement stack with no signal, never changes, and is identical on every copy of the same edition anywhere on Earth. It is the only tier that can carry the hard rule *same book → same creature everywhere* on its own.

**Tier 2 — the bibliographic record (best-effort, needs a lookup or a bundled database).** If we can resolve the ISBN against a catalog — live API, cached library feed, or an on-device database shipped with the app — we get the MARC-derived record: title, author, publisher, publication year, page count, physical format (board book, picture book, chapter book, graphic novel), series name and position, edition statement, genre and subject vocabulary (LCGFT genre terms in the 655 field, CYAC children's subject headings in 650 with indicator 1, publisher-side BISAC codes like `JUV028000 Mysteries & Detective Stories`), a classification number (Dewey or LCC — children's fiction famously lives in PZ7/PZ7.1, realistic animal stories in PZ10.3), and a short summary annotation, a CYAC hallmark since 1965 [source: library metadata report §6.1–6.5]. Award data (Newbery, Caldecott) is the flakiest field here — it is often absent from the MARC record itself and arrives via vendor enrichment, so it should only ever gate a bonus, never a core trait. For the home pilot, "a catalog" means three concrete sources: the Library of Congress SRU endpoint (real MARC, the authoritative form of everything above, including the LCGFT 655s and CYAC headings), the Open Library API (free JSON, no auth, and the only source that clusters editions under work identifiers), and the Google Books API as a fallback for categories and dates when the first two miss. Section 7 gives the full cascade.

**Tier 3 — borrow context (best-effort, and only sometimes appropriate).** If the scan happens through a library-integrated flow we may also know the branch, the checkout date, and the due date. This tier is ephemeral by nature and should never feed creature *identity* — the same book must not produce a different creature at a different branch. It is good raw material for moods, visit stamps, and "return your friend's book on time" care hooks. In the home pilot, Tier 3's concrete source is the CPL catalog record page itself, read by eye — see the pilot note below for why that is the only way in.

**A note on the pilot context.** The pilot runs at home, on books borrowed from the Bucktown branch of Chicago Public Library plus books we own, so it is worth being exact about what CPL can and cannot feed the pipeline. CPL's public catalog at chipublib.bibliocommons.com is BiblioCommons (their BiblioCore product, live since 2013) layered over TLC's CARL·X ILS, a contract awarded back in 2005. Neither layer exposes a public API: CARL·X's APIs are partner-gated, and there is no publicly documented Z39.50 or SRU endpoint for CPL. The catalog is human-browsable only. A record page shows plenty — format editions, age recommendations, availability by branch, hold counts, community tags — but with no sanctioned programmatic path, all of it is reference and enrichment-by-eye for the pilot, nothing more. The machine-readable Tier 2 comes from LC, Open Library, and Google Books, per the cascade in section 7.

The tiering resolves a tension the capture-alternative work already surfaced: Spine Spark needs only Tier 1, Story Eggs leans on Tier 2, and the Lantern Ritual hybrid uses Tier 1 for identity and Tier 2 for flavor. Everything below assumes that hybrid shape is roughly right, and tries to say precisely which value goes in which layer.

---

## 2. Anatomy of the ISBN-13 as a value source

The ISBN-13 is not an opaque serial number. It is a structured address with five fields, and two of those fields are semantically legible in ways a design can exploit directly.

| Field | Example (Charlotte's Web) | What it encodes | Cardinality | Usable raw, or hash-only? |
|---|---|---|---|---|
| GS1 prefix | `978` | "This is a book" (978, plus 979 as overflow) | 2 values in practice | Nearly zero entropy; ignore or use as a version flag |
| Registration group | `0` | Language/country of the publishing agency: 0 and 1 English, 2 French, 3 German, 4 Japan, 5 Russian-sphere, 7 China, 979-8 USA, etc. | ~200 groups, 1–5 digits | **Raw** — this is real semantic signal |
| Registrant (publisher) prefix | `06` | The publisher. Variable length: big houses get short prefixes with big publication ranges (0-06 HarperCollins, 0-590 Scholastic, 0-399 Putnam/Philomel); a micro-press gets a 6–7 digit prefix and a few dozen slots | Hundreds of thousands of registrants | Raw *identity* (with a prefix table), otherwise hash |
| Publication element | `440055` | This publisher's serial number for this edition | Fills the remaining digits | Hash-only; the value itself is arbitrary |
| Check digit | `8` | Weighted mod-10 checksum of the other 12 | Fully derived | Zero entropy; use only for scan validation |

The variable-length registrant prefix is the most interesting field. Because ISBN allocation is hierarchical, **publisher identity is legible in the number itself, offline, with no lookup** — a small static table of a few hundred major children's prefixes (0-06, 0-14, 0-399, 0-590, 0-7636 Candlewick, and so on) turns the raw digits into "this creature was born from a Scholastic book" without any network. That is a genuinely rare property in scannable real-world data, and Skannerz already proved the pattern works: Radica's own manufacturer prefix 7459380 was special-cased in the algorithm as a healing code [source: physical capture report §2.1]. Publisher-prefix "birthmarks" are our version of that trick.

### The honest entropy budget

Thirteen digits sounds like 43 bits, but it is not. The GS1 prefix contributes about one bit, the check digit contributes zero, and what remains is nine to ten meaningful digits: roughly **31 bits of theoretical space, about two billion possible ISBNs**. Of those, the number actually assigned and circulating is far smaller — aggregators like Bowker and WorldCat see on the order of tens of millions of distinct ISBNs, call it 2^25 to 2^26 of *realized* identity, and a single library branch's children's section might hold 2^13 to 2^15 of them. Two consequences follow. First, 31 bits is plenty to seed a 32-bit identity value with negligible same-shelf collision risk if we hash rather than truncate. Second, we should not pretend the input space is uniform: ISBNs cluster heavily by publisher block, which is exactly why the species-selection step must be a proper hash and not Skannerz-style raw modular arithmetic — otherwise every book in a HarperCollins block would land in the same species neighborhood.

The bigger structural problem is **works versus editions**. An ISBN identifies an *edition*: the 1998 Scholastic hardcover of *Harry Potter and the Sorcerer's Stone* (978-0-590-35340-3), the paperback, the UK Bloomsbury *Philosopher's Stone*, and the 20th-anniversary reissue are four-plus different numbers for one story. Monster Rancher hit the identical issue from the other direction — two pressings of the "same" album could carry microscopically different TOC data and yield different monsters, which the community discovered when trading disc data [source: monster-generation report §2.2]. The library world's standard mitigation is work-level clustering: OCLC work identifiers, or a normalized title+author key, group editions under one work ID. That requires Tier 2 data, so the design choice is stark: pure Tier 1 gives per-edition creatures (a collectible feature, or a kid-confusing bug), while work clustering gives per-story creatures but surrenders full offline purity. Section 9 holds the open question; the two-layer model in section 4 is built so either answer can be swapped in.

---

## 3. Precedent systems and the lesson each teaches

**Monster Rancher (CD-TOC lookup).** The PS1 games read a disc's table of contents — track count, point-time minutes and seconds, lead-out — and ran a cascade: check a hard-coded special-monster table first, otherwise derive main breed, sub-breed, and stat offsets from the general TOC values, with graceful degradation to zeros if the read failed [source: monster-generation report §2.2]. What Stacklings should copy is the *cascade with a curated override table*: a small hand-authored list of beloved books that yield hand-designed creatures (the Kasumi-from-Dead-or-Alive move [source: monster-generation report §2.2]) sitting in front of the general algorithm. Also copy the graceful degradation — a torn barcode should produce *something*, never an error screen. What to avoid: seeding from data the player cannot see or reason about at all; the TOC was invisible, and the ISBN's partial legibility is an upgrade.

**Skannerz (positional barcode-digit mapping).** The device read only the UPC's product-code section: first digit 0–5 meant monster, 6–9 meant item; digits 3–5 indexed which of 126 monsters via range tables; tribe-colored hardware gated which monsters you could keep [source: physical capture report §2.1; monster-generation report §5.2]. Copy the *legibility*: because the mapping was positional and deterministic, kids could learn it, print barcode books, and trade knowledge as playground currency [source: physical capture report §2.3]. Avoid the raw positional mapping itself for species selection — as noted above, ISBN digits are not uniformly distributed, and Skannerz-style ranges would make publisher blocks into species monocultures. Position-mapping belongs in the *legible* layer (publisher birthmarks, language variants), not the identity layer.

**Barcode Battler.** Epoch's 1991 handheld converted any swiped barcode into a character, enemy, or power-up whose derived statistics fed the combat algorithm — the pantry as loot table, six years before Monster Rancher [source: monster-generation report §5.1]. The community's decoded digit-position stat tables (the HP/ST/DF folklore) are the ancestral form of everything in this document. The lesson is mostly cautionary: stats straight from raw digits produced wild, unauthored power variance, and "the strongest warrior is a specific brand of instant noodles" is funny once. Stacklings' stats should come from bounded rolls, not raw digit magnitude.

**Pokémon PID and Spinda.** Gen III assigned each Pokémon a 32-bit personality value at the moment of generation, and that single number determined nature (mod 25), gender, ability (low bit), shininess (via XOR against trainer IDs), even Wurmple's evolution branch — one draw, many correlated traits, tiny save footprint [source: monster-generation report §3.1]. Spinda is the crown jewel: its four spots are drawn procedurally from the PID's four bytes, low nibble x, high nibble y, giving roughly four billion visual variants from zero additional stored data [source: monster-generation report §3.2]. This is the direct template for our Layer 1: a 32-bit individual seed with a published bit layout, which also plugs cleanly into the Lantern Ritual's existing 32-bit SID. The one thing to avoid is Pokémon's frame-timing exploitability — our seed comes from a static number on a book, so there is nothing to manipulate, which is the right property for six-year-olds.

**Digimon World / Chao Garden (the care contrast).** Digimon World routed evolution through hidden accumulated state — stat thresholds, weight, a care-mistakes counter with counterintuitive edge cases only exposed by decompilation — and the Chao Garden similarly grew identity out of who raised the creature and what it was fed [source: monster-generation report §8, §10]. The lesson is about *which story the player tells*: a birth-seed creature is a sealed lottery ticket, a care-driven creature is the consequence of a relationship [source: monster-generation report §11]. Stacklings should split the difference deliberately — identity and looks fixed at scan (the book decides), warmth and moods shaped by care (the reader decides) — and keep the care variables *visible*, because opaque punitive counters read as unfair to kids.

**Cassette Beasts (part-mixing).** Bytten Studio built every monster twice, bespoke and as modular Lego-style parts, so any two of 120 forms fuse into 14,000-plus coherent animated combinations; the cost moved from code into content, and the art had to accept constraints like compatible round head shapes [source: monster-generation report §4]. If Stacklings ever wants book-blend creatures ("scan two books, hatch a duet"), this is the budget warning: the algorithm is a weekend, the modular art bible is the project.

**The cross-cutting finding.** Both reports land on the same observation: opaque-but-deterministic mappings reliably spawned communal reverse-engineering as a second game — LegendCup's disc laboratory, unofficial Skannerz barcode compendiums, Smogon's RNG guides — and that decoding community became a retention engine in its own right [source: physical capture report §5.3; monster-generation report §11]. For a library game this is almost too on-the-nose to pass up: the decoding layer *is* a literacy layer. Kids comparing spine labels to figure out why all the dinosaur books hatch Cog-types are doing catalog research and don't know it.

---

## 4. The two-layer generative model

The recommendation: split generation into an identity layer that needs only Tier 1, and a semantics layer that consumes Tier 2 when available.

**Layer 1 — Identity (pure hash, offline, canonical).** Hash the 13 digits (illustratively: SHA-256 of the digit string, truncated) into three values: a **species-family seed** that selects the base creature within an element, a **32-bit individual seed** governing cosmetics, and a **rarity roll**. Because it is a cryptographic hash, it is uncrackable-but-fair: no one can grind ISBNs to mint rares by pattern, but the same book yields the same creature on every device forever, with no server. This layer alone is a complete game — it is Spine Spark.

**Layer 2 — Semantics (metadata, additive, never contradictory).** When Tier 2 resolves, metadata *bends* the creature without re-rolling it:

- **Element** from genre vocabulary: LCGFT/CYAC/BISAC terms map to the eight elements — fantasy terms → **Wisp**, animal stories (hello, PZ10.3) → **Fuzz**, nonfiction/STEM Dewey 500s–600s → **Cog**, humor → **Giggle**, mysteries → **Shade**, poetry and verse → **Chime**, bedtime and picture books → **Hush**, adventure/myth/folklore → **Ember**.
- **Size and growth pace** from page count: a 26-page board book hatches small and grows fast; a 400-page doorstop hatches as a slow-burn heavyweight.
- **Era styling** from publication year: decade-flavored accessories and textures (a 1950s creature gets mid-century linework; a 2020s one gets flat pastels).
- **Behavior quirks** from subject headings: `Friendship — Fiction` seeds an affectionate idle; `Cookery` seeds snack animations.
- **Rarity shine** from awards: a Newbery or Caldecott flag upgrades the Layer 1 rarity roll one tier — best-effort data gating only a bonus, per section 1.
- **Evolution lines** from series: series membership and position select an evolution family and stage (book 1 of 7 hatches the first form).
- **Regional/language variants** from the ISBN registration group — the one Layer 2 trait that is actually available offline, since it is read straight from the digits: group 3 books hatch the Germanic variant coat, group 4 the Japanese variant, a built-in reward for multilingual shelves.
- **Body/format cues** from format: board books → round and chunky, graphic novels → paneled markings, chapter books → lanky.

The layering rule that keeps determinism intact: Layer 2 may *select among* Layer-1-seeded options but never introduces new randomness. Offline, a creature hatches as its element-neutral "unread" form and *awakens* into its full semantic dress when the record resolves — which turns a sync limitation into a story beat.

### Bit budget for the 32-bit individual seed

| Bits | Field | Values | Drives |
|---|---|---|---|
| 5 | Palette index | 32 | Body color scheme (element supplies the base ramp; these pick within it) |
| 16 | Pattern placement | 65,536 | Spinda-style: four markings × 4 bits each (2-bit x, 2-bit y on a coarse grid per body zone) |
| 3 | Voice/cry variant | 8 | Pitch and chirp family |
| 2 | Idle animation set | 4 | Bounce, sway, doze, wiggle |
| 4 | Quirk slot | 16 | Which of the species' quirk pool is expressed (subject headings can override 2 of the 16) |
| 2 | Reserved | 4 | Future: seasonal flags, shine sub-tier |
| **32** | | | |

Permutation math on the 30 visible bits: **2^30 ≈ 1.07 billion visually distinct individuals per species**. With a working-assumption roster of 96 species families (12 per element — a content target, not a promise), that is ~12.9 billion distinct individuals per element and **96 × 2^30 ≈ 103 billion total distinct creatures**, from 4 bytes per creature of stored identity. Spinda's four billion variants came from exactly this trick [source: monster-generation report §3.2]; we are spending our 32 bits across more trait types and buying combinatorial breadth from the species multiplier instead.

---

## 5. Mapping table: book value → creature axis

| Input value | Derivation | Cardinality | Drives | Example |
|---|---|---|---|---|
| Full ISBN-13 string | Hash | ~2^31 realized | Species family, individual seed, rarity roll | 978-0-06-440055-8 → seed 0x9D41C27B *(illustrative)* |
| Registration group digit(s) | Raw | ~200 groups | Regional/language variant coat | Group 4 → Japanese variant markings |
| Registrant (publisher) prefix | Raw + small static table | ~10^5; a few hundred tabled | Birthmark motif; curated-override lookup key | 0-590 Scholastic → tiny star birthmark |
| Publication element | Hash (folded into full-string hash) | Fills remaining digits | Nothing on its own — entropy feed | — |
| Check digit | Derived | 1 | Scan validation only; candidate Easter egg (check digit 7 = lucky freckle) | — |
| LCGFT/CYAC/BISAC genre terms | Metadata | ~10 relevant buckets | **Element** (8 + fallback) | `Detective and mystery fiction` → Shade |
| Page count | Metadata | Bucketed to ~6 tiers | Size class, growth pace | 32 pp → Tiny, fast growth |
| Publication year | Metadata | Bucketed by decade | Era styling layer | 1969 → retro print-dot texture |
| Subject headings (650) | Metadata | Thousands; tabled to ~50 quirk tags | Behavior quirk overrides | `Horses — Fiction` → gallop idle |
| Awards | Metadata (vendor enrichment) | Binary/tiered | Rarity shine upgrade | Caldecott → gilt shimmer |
| Series name + position | Metadata | Open set | Evolution family and stage | Book 3 of 5 → mid-form |
| Format (board/picture/chapter/graphic) | Metadata | ~6 | Body plan silhouette | Graphic novel → paneled markings |
| Dewey/LCC class | Metadata | 10 main classes / 21 letters | Cog sub-type; nonfiction flavor | DDC 590s → beast-scholar Cog |
| Branch, due date | Borrow context | Ephemeral | Moods, visit stamps — never identity | Due soon → creature taps its wrist |

Stats deliberately do not appear as a hash output row: base stats belong to the species family (authored), with the individual seed contributing only a small bounded variance, the Monster Rancher offset-range pattern rather than the Barcode Battler raw-digit pattern [source: monster-generation report §2.2, §5.1].

---

## 6. The full value inventory — everything the sources can tell us

Section 5 maps the values that already earn their keep; this section deliberately does the opposite job. It is the complete menu of what the pilot's sources can actually return for a scanned children's book, whether or not any given field deserves a trait. The game should use a fraction of these rows, and the workshop picks which fraction — the table exists so we choose from the full set instead of from whatever fields the first prototype happened to parse.

| Value | Where it comes from (source + field) | Coverage/reliability | Example (real children's book) | Candidate creature hook |
|---|---|---|---|---|
| **LC MARC via SRU — the authoritative record** | | | | |
| Record format/type | Leader/06–07 | Universal | *Charlotte's Web*: language material, monograph | — (confirms "this is a book" before we hash anything) |
| Publication date | 008/07–10 | Universal on LC records | 1952 | Era styling (§4); feeds the age tiers under Derived — elder creatures vs hatchlings |
| Language | 008/35–37 | Universal | `eng` | Cross-check on the ISBN-group variant coat |
| Target audience code | 008/22 | Good on juvenile records | `j` (juvenile) | Creature maturity register |
| Literary form | 008/33 | Good | `1` fiction, `0` nonfiction | Fiction/nonfiction gate ahead of element mapping — Cog leans nonfiction |
| Biography flag | 008/34 | Good | `b` (individual biography) on a *Who Was…?* title | Portrait-locket marking on biography creatures |
| LCCN | 010 $a | Universal at LC | 52009760 (*Charlotte's Web*) | — (stable pin key for the local cache, not a trait) |
| ISBN(s) | 020 $a, repeatable | Good post-1970 | 9780064400558 | Already all of Layer 1; the 020 confirms the scan hit the right record |
| Language(s), multilingual | 041 | Present when multilingual | A bilingual English–Spanish picture book carries both codes | Multilingual coat trim |
| LCC call number | 050 | Universal at LC | PZ10.3 range for realistic animal stories | Shelf-neighborhood "clan" markings |
| Dewey number | 082 | Very good | 595.44 for a real spider book; `[Fic]` for the novel about one | Cog sub-type flavor (§5) |
| Author | 100 $a $d | Universal | White, E. B., 1899–1985 | Birth/death dates ride along free — name day and author-alive flag under Derived |
| Title/subtitle | 245 $a $b | Universal | — | Display name; lookup key into the curated override table |
| Edition statement | 250 | When present | "1st ed."; anniversary editions announce themselves here | Anniversary-variant flag if the edition stance allows it |
| Place/publisher/year | 264 | Universal | New York : Harper, 1952 | Cross-check on the publisher-prefix birthmark |
| Physical description | 300 $a $b $c | Universal | 184 p. : ill. ; 21 cm | Pagination → size (§5); dimensions ($c) → creature physical scale; "col. ill." → colorful vs inky rendering |
| Series statement | 490/830 | Good when applicable | Harry Potter ; bk. 1 | Evolution family and stage (§5) |
| Summary/annotation | 520 | Strong on children's records — CYAC hallmark since 1965 | "Wilbur the pig is desolate…" | Keyword-derived quirks, cautiously — it is free text |
| Target-audience/reading-level note | 521 | Patchy | "Ages 4–8." | Second vote on the maturity register, after 008/22 |
| Awards note | 586 | Flaky; often vendor-side | "Newbery Honor Book, 1953" | Rarity shine — bonus-only, per section 1 |
| Subject headings | 600/650/651, incl. CYAC (650 ind. 1); places, times, people | Very good on children's records | `Spiders — Fiction` (CYAC) | Behavior quirks; secondary element votes; 651 places → habitat backdrops |
| Genre/form terms | 655 (LCGFT) | Good on recent records, thinner pre-2011 | "Horror fiction" / CYAC "Scary stories" on a Goosebumps title | Primary element selector — horror terms → Shade plus the spooky idle set |
| Added entries | 700 | Good | Garth Williams as illustrator | Illustrator birthmark; a translator entry → translated-variant trim |
| **Open Library — free, no auth, works-vs-editions aware** | | | | |
| Work ID | works API | Very good for known books | `/works/OL45804W` (*Fantastic Mr Fox*) | The edition-clustering key — the per-work answer to open question 1 |
| Edition ID | editions API | One record per known ISBN | — | — (bookkeeping; pairs the scan with its work) |
| first_publish_year | work record | Very good | 1952 for *Charlotte's Web*, even when the scanned ISBN is a modern reprint | Work-level age — the fix that lets elder creatures hatch from new reprints |
| subjects / subject_places / subject_times / subject_people | work record | Uneven (imported + community) | subject_places: "London (England)" on a Paddington work | Habitat backdrops; era props; famous-figure cameo cards |
| Cover image IDs | covers API | Good for popular titles | `-S/-M/-L.jpg` sizes | Palette sampling — determinism caution: covers vary by edition and get replaced upstream |
| physical_format | edition record | Patchy | "Board book" | Body plan vote (§5) |
| languages | edition record | Good | eng | Variant coat cross-check |
| description | work/edition record | Patchy | — | Same cautious keyword role as MARC 520 |
| Author birth/death dates | author record | Good for established authors | Roald Dahl, 1916–1990 | Author-alive flag and name day, under Derived |
| Author bio, alternate names | author record | Patchy | — | Pen-name lore card, at most |
| series | edition record | Patchy, community-entered | — | Weak third vote on evolution lines |
| number_of_pages | edition record | Good | 184 | Size class cross-check |
| **Google Books — fallback categories and dates** | | | | |
| categories | volumeInfo.categories | Good but coarse (BISAC-flavored) | "Juvenile Fiction / Animals" | Element fallback vote when 655 and CYAC are absent |
| publishedDate | volumeInfo | Good, edition-level | A reprint reports its own year, not 1952 | Edition year for the work-vs-edition split under Derived |
| pageCount | volumeInfo | Good | 184 | Size class fallback |
| printType | volumeInfo | Universal | BOOK | — (scan sanity check) |
| maturityRating | volumeInfo | Universal | NOT_MATURE | Safety gate, never a trait |
| averageRating + ratingsCount | volumeInfo | Sparse; drifts over time | — | "Beloved" mood at most — never identity, it changes under our feet |
| language | volumeInfo | Good | en | Variant coat cross-check |
| description | volumeInfo | Good for in-print titles | — | Cautious keyword quirks |
| imageLinks | volumeInfo | Good | thumbnail URL | Same determinism caution as Open Library covers — edition-varying |
| dimensions | volumeInfo, some editions | Patchy | height 20.3 cm | Physical-scale fallback behind MARC 300 $c |
| subtitle | volumeInfo | When present | — | Display |
| authors | volumeInfo | Universal | E. B. White | Cross-check on MARC 100 |
| **CPL BiblioCommons — view-only, no API; enrichment by eye during the pilot** | | | | |
| Branch availability | Record page, by eye | Live and accurate | A copy showing on the Bucktown shelf | Visit stamps and shelf-mate moods — Tier 3 only, never identity |
| Copies in/out | Record page, by eye | Live | — | "Out being read right now" mood |
| Hold count | Record page, by eye | Live | A new Dog Man volume with a long hold queue | "Beloved" trait vote — the honest popularity signal |
| Age recommendation | Record page, by eye | Common on juvenile titles | "Ages 8–12" style banding | Third vote on the maturity register |
| Format editions | Record page, by eye | Good | Book / eBook / audiobook rows on one record | Manual work-vs-edition disambiguation while testing |
| Community tags/lists | Record page, by eye | Uneven, community-made | — | Inspiration for the quirk-tag table, not pipeline input |
| **Author enrichment — VIAF/Wikidata, optional** | | | | |
| Birth/death year | Wikidata P569/P570; VIAF dates | Very good for established authors | Beverly Cleary, 1916–2021 | Backs the author-alive flag and name day |
| Nationality/country | Wikidata P27 | Good | Beatrix Potter — United Kingdom | Origin flavor on the lore card |
| Occupation | Wikidata P106 | Good | Eric Carle: illustrator and author | Author-illustrators → a creature that doodles |
| Number of other works | Wikidata/VIAF work counts | Rough | Dav Pilkey's shelf-filling output | "Prolific line" — siblings-everywhere trait |
| Author gender | Wikidata P21, where recorded | Patchy | — | — (listed for completeness; no obvious hook and easy to get wrong) |
| **Derived — computed from the above, no extra source** | | | | |
| Book age in years | Pub year vs today | As good as the year input | *The Very Hungry Caterpillar* is 57 this year | Age tiers: "old" ≥30 yr, "classic" ≥60 yr, "newborn" ≤2 yr — grey whiskers and a slow idle for elders, hatchling "baby" forms for newborns |
| Author-alive flag | Death date absent in author record | Good | Mo Willems: alive; E. B. White: 1899–1985 | "Still writing" sparkle for living authors — handle the copy gently |
| Author birthday | Birth date | Good for established authors | Dr. Seuss, March 2 | The creature shares the author's birthday as its name day |
| Series position | 490/830 $v, or OL series | Good when applicable | Book 1 of 7 | Evolution stage (§5) |
| Popularity percentile | ratingsCount, hold counts, list appearances | Rough, moving target | — | "Beloved" threshold — mood layer only |
| Work-vs-edition age split | first_publish_year vs 008 / 264 / publishedDate | Good where OL knows the work | *Charlotte's Web*: 1952 work behind a modern reprint ISBN | Age the creature by the story, style it by the edition — see open question 8 |

---

## 7. Sourcing cascade for the home pilot

The pilot resolves a scanned ISBN in four steps, stopping at the first source that answers each *field* rather than the first that answers at all — a record is allowed to be assembled from more than one stop.

1. **Local pinned cache.** If we have seen this ISBN before, the cached record is the record. No network, no drift.
2. **Library of Congress SRU.** Authoritative MARC: the 008 fixed field, LCGFT 655s, CYAC headings, the full 300 physical description.
3. **Open Library.** Free, no auth, and the only stop that clusters editions into works — the work ID and first_publish_year come from here.
4. **Google Books.** Fallback categories and dates when the first two miss.

**Pin on first fetch.** Whatever a step returns is written into the local cache, and the cache wins forever after. The creature is generated from the pinned record, so an upstream edit — someone tidying an Open Library subject list, a publisher swapping a cover — can never re-dress a creature mid-test. Determinism during the pilot depends on this rule as much as on the hash.

The honest gaps: LC does not have everything, and mass-market titles (the licensed-character shelf especially) go missing from its catalog more often than you would guess. Open Library's community data runs from meticulous to absent on the same shelf, so its subjects and series fields are votes, never verdicts. Google Books categories are coarse — "Juvenile Fiction" tells us less than a single CYAC heading. And the whole CPL column is view-only by construction. The working guidance follows from section 6: any field marked view-only or low-coverage is a menu item, not a dependency, and nothing in the creature pipeline may *require* one.

---

## 8. Three worked examples

*All hash outputs below are illustrative placeholders — the digits and field splits are real, the hex is not final.*

### 8.1 Charlotte's Web — 978-0-06-440055-8 (HarperTrophy paperback)

Field split: GS1 `978` · group `0` (English) · registrant `06` (HarperCollins) · publication `440055` · check `8`. Layer 1 hash *(illustrative)*: species seed `0x9D41C27B` → Fuzz family slot 7 of 12, "Loomkin" line; individual seed `0x3A6F1E92` → palette 18 (dusty rose-grey), pattern bits placing four lace-like web markings high on the back, voice 3 (soft creak), quirk slot 11; rarity roll: Uncommon. Layer 2: CYAC headings on the order of `Spiders — Fiction`, `Pigs — Fiction`, `Friendship — Fiction`, classed with realistic animal stories (the PZ10.3 neighborhood [source: library metadata report §2.2]) → element confirmed **Fuzz**; 184 pages → Medium size, steady growth; 1952 work / 1970s-era trade dress → soft mid-century linework; `Friendship` heading overrides the quirk: the Loomkin spins tiny word-banners when the reader returns. Newbery Honor flag → shine upgrade to Rare-glint. Result: a medium, rose-grey barnyard weaver with web-lace shoulders that writes you one-word compliments. The 0-06 birthmark is a small leaf, shared by every HarperCollins-born Stackling.

### 8.2 The Very Hungry Caterpillar — 978-0-399-22690-8 (Philomel board book)

Field split: `978` · group `0` · registrant `399` (Putnam/Philomel) · publication `22690` · check `8`. Layer 1 *(illustrative)*: species seed `0x51B8E04D` → Hush family "Nibbin" line; individual seed `0xC2071A55` → palette 5 (leaf-green with red hood), pattern bits scattering four fruit-dot markings along the flank, idle set 2 (doze), quirk slot 3; rarity: Common — and that is correct, because this book is on every shelf in the country, and a cozy game wants the most-scanned books to hatch dependable friends. Layer 2: format board book → round, chunky body plan; 26 pages → Tiny with **fast** growth, which the species leans into as an authored metamorphosis beat; 1969 → retro print-dot texture; subject matter overrides quirk to constant snacking, with bite-mark nibbles appearing on the creature's menu card. A Common that everyone owns but whose 65,536 pattern placements mean no two look quite alike — the Spinda argument in one creature.

### 8.3 Harry Potter and the Sorcerer's Stone — 978-0-590-35340-3 (Scholastic hardcover)

Field split: `978` · group `0` · registrant `590` (Scholastic) · publication `35340` · check `3`. Layer 1 *(illustrative)*: species seed `0xE7A30F19` → Wisp family "Emberowl" line (a Wisp with Ember-leaning styling — element from metadata, family flavor from the seed); individual seed `0x88D45B2C` → palette 27 (deep green and silver, as it happens), lightning-sliver pattern high on the brow, voice 6, quirk slot 14; rarity roll: Rare. Layer 2: fantasy genre terms → **Wisp** confirmed; 309 pages → Large, slow-burn growth; series position 1 of 7 → hatches as the *first form* of a seven-stage evolution line, with later books in the series awakening later stages — series-as-evolution is this example's whole point. And its edition problem is the section 9 headline: the UK Bloomsbury *Philosopher's Stone* carries a different ISBN and would hash to a different Layer 1 identity. Per-edition, that is a transatlantic variant kids trade sightings of; per-work, it is a bug to cluster away. Both are defensible; only one can be canon.

---

## 9. Open design questions

1. **Edition stance.** Per-edition creatures (pure Tier 1, offline-clean, "the anniversary edition hatches a variant!") versus per-work creatures (needs clustering data, matches kid intuition that *Charlotte's Web* is one book). A middle path: per-work species, per-edition cosmetic variant.
2. **Per-copy vs per-work barcodes.** Library copies carry a *second* barcode — the item barcode, unique per physical copy. Scanning it would violate same-book-same-creature, but it could power a non-identity layer ("this exact copy has been hatched by 14 kids at this branch"). Decide whether the scanner reads it at all.
3. **Collision policy.** With a 32-bit hash over ~2^26 realized ISBNs, cross-library collisions are vanishingly rare but nonzero. Silent sharing (two books, same creature, treated as a fun coincidence) is probably fine; confirm we never surface it as an error.
4. **Discoverability dial.** How much of the mapping do we *want* playground-decodable? Proposal: registration-group variants, publisher birthmarks, and page-count sizing fully legible; species and pattern hash sealed. That reproduces the Skannerz knowledge economy without letting anyone mint rares [source: physical capture report §5.3].
5. **Non-ISBN items.** Pre-1970 books, magazines, and some library-bound editions have no ISBN. Fallback candidates: the item barcode (breaks universality), title+author entry Monster Rancher Advance password-style [source: monster-generation report §2.4], or a librarian-blessed "Elder Tome" ritual for old books. Needs its own pass.
6. **Curated override table.** Size, governance, and update cadence for the hand-authored special-book list (the Kasumi table). Who decides which books get bespoke creatures, and how does it ship offline?
7. **Inventory pruning.** Section 6 lists some sixty obtainable values, and the trait vocabulary should absorb only a fraction of them. Which rows are worth normalizing into the element/quirk/variant tables, and which stay permanently unused? Bias toward fields with strong coverage and kid-legible meaning; a trait a six-year-old cannot trace back to the book is decoration, not design.
8. **Work-level vs edition-level age.** first_publish_year surfaces a split that question 1 does not cover: even if *identity* stays per-edition, should *age* be per-work? A 2023 reprint of a 1952 story could hatch an edition-variant creature that is nonetheless an elder — grey whiskers on a new coat. Decide whether the age tiers read the work year, the edition year, or deliberately both.
