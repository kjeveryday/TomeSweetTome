# Creature rendering overhaul — plan (CSS art → Monster Builder sprites)

Scope: render only. `src/systems/generation.js`, `src/state.js`, `src/events.js`,
`src/contracts.js` are NOT touched by this plan. Every sprite choice below is a pure
function of fields the generator already produces (or of `stage`/`mood`, which are
themselves already-deterministic derived state). All 461 tests stay green because none
of them exercise `ui.js` DOM/CSS output — verified below.

---

## 1. CURRENT MODEL

`generateCreature()` in `src/systems/generation.js` takes a canonical identity key,
runs `SHA-256(identityVersion:identityKey)`, and reads three uint32s out of the 32-byte
digest: `speciesSeed` (bytes 0-3), `individualSeed` (bytes 4-7), `raritySeed` (bytes 8-11).
Everything below is derived from those three integers only — same book, same bytes,
same creature, forever.

Creature object shape (`creature.kind === 'book'`):

| Field | Domain | Derivation | Visual today? |
|---|---|---|---|
| `family` | 12 values (`content.generation.families`) | `speciesSeed % 12` | body shape name (round/tall/wide/pear/bean/squat/drop/pebble — 8 unique adjectives over 12 ids), appendage name (antennae/ears/nubs/leaf/horns/fin/crown), CSS width/height/border-radius |
| `palette` | 16 values (`content.generation.palettes`) | `paletteIndex = individualSeed & 0x1f` (0-31), `% 16` | `hue` (0-359) + `accentHue` (0-359) → `hsl(var(--hue))` body gradient + accent |
| `pattern` | 6 values (spots/diamonds/rings/petals/stars/patches) | `(speciesSeed >>> 8) % 6` | shape of the 4 `.mark` birthmark blobs |
| `pattern.placements` | 4 ints, 0-15 each | 16-bit `patternBits = (individualSeed >>> 5) & 0xffff`, sliced 4 bits at a time | grid position (col/row, 0-3 each) + rotation of each mark |
| `voice` | 8 values | `(individualSeed >>> 21) & 0x07` | **none** — flavor text only |
| `idle` | 4 values (bounce/sway/doze/wiggle) | `(individualSeed >>> 24) & 0x03` | CSS idle animation selection |
| `quirk` | 16 values | `(individualSeed >>> 26) & 0x0f` | **none** — flavor text only |
| `rarity` | 4 tiers (common/uncommon/rare/luminous), roll 0-999 | `raritySeed % 1000` bucketed by `maxExclusive` | luminous → `luminous-glow` brightness/saturate pulse |
| `publisher` | 5 known + 1 default | ISBN prefix match | emoji birthmark badge (🕯️⭐🌙🍃🪶📖) |
| `languageGroup` | 7 values | ISBN group digit | **none** — label only |
| `name` | generated | `bytes[12]`/`bytes[13]` index into prefix/suffix lists | text only |
| `seed`/`seedVersion`/`hashAlgorithm`/`isbn` | — | — | debug/identity only |

**Not a gene:** `mood` (`moodOf(state)` in `state.js`) is derived live from `fullness`/
`spirit` stats each render — beaming/content/peckish/sleepy. It currently reshapes the
`.eye`/`.mouth` CSS geometry in real time, independent of the book. **`stage`** (1
Hatchling / 2 Sprout / 3 Bloom, from `content.species.stages`, gated by `cp` thresholds
in `growth.js`) currently drives `--scale` (0.74 → 0.94 → 1.14), a `hueShift` added to
the palette hue, and reveals a sprout (stage ≥2) then wings (stage 3).

---

## 2. CURRENT RENDERING

All draw sites live in `src/ui.js`; all geometry/color in `style.css`.

| Site | Function | Element | Rendered size |
|---|---|---|---|
| Hero (Care page) | `applyCreatureLook()` (ui.js:1453) | `.creature .body` + `.mark`×4 + `.birthmark` + `.eye`×2 + `.cheek`×2 + `.mouth` + `.feature`×2 (appendage) + `.sprout`/`.wing` | `body-width/height` from `family` (e.g. 168×150px) × `--scale` (0.74/0.94/1.14) → ~125–191px |
| Book-preview orb (Discover page) | `showCreaturePreview()` → `paintMiniOrb()` (ui.js:1233) | `.book-orb` (built by `buildMiniOrb()`) + `.mini-mark`×4 + `.mini-face` (static `•ᴗ•` glyph) | 88×78 default, 70×92 (tall/drop), 94×68 (wide/squat); ×0.82 on mobile |
| Habitat mini-creatures | `renderHabitat()` (ui.js:1741) → `buildMiniOrb()`/`paintMiniOrb(orb, record.baseTraits)` | same `.book-orb` markup, one per revealed+shown creature, positioned along a floor line | same as above (no extra scale rule found) |
| Collection chips ("Your creatures") | `renderCollection()` (ui.js:1794) → `buildMiniOrb()`/`paintMiniOrb(orb, traits)` | same `.book-orb` markup | forced to 52×46 via `.collection-chip .book-orb` |

There is **no separate "collection avatar"** — collection chips, habitat monsters, and
the book-search preview all share the one `.book-orb` mini-creature (body gradient +
4 marks + static face glyph, no limbs, no appendage). Only the hero `.creature` shows
limbs/appendage/mood-reactive face.

CSS mechanics: `.creature .body` and `.book-orb` are `hsl(var(--hue))`-tinted gradient
blobs shaped by `border-radius`; `.mark`/`.mini-mark` are small absolutely-positioned
divs shaped by `data-pattern` (`border-radius`/`clip-path`/`rotate` per pattern id) and
placed via `positionMarks()` (ui.js:1219), which reads the 4 `pattern.placements`
values and a fixed `markingLayout` (base x/y + step) from `content.json` — pure CSS
custom-property math, no images. `data-appendage` swaps which `.feature` shape renders
(ear/horn/nub/antennae/leaf/fin/crown lookalikes built from clip-path/border-radius).
`data-rarity="luminous"` adds a glow keyframe. Growth stage changes: **size** (`--scale`
interpolates the whole body+face box), **hue** (`hueShift` per stage nudges the palette
hue), and **added features** (sprout appears stage ≥2, wings appear stage 3) — the body
*shape* and *appendage* never change across stages, only scale/color/extras.

---

## 3. PROPOSED TRAIT → PARTS MAPPING

Target kit: `redesign/catalog.json` → `monsterBuilder` (body 36 = 6 colors × shapes
A–F; arm/leg 30 each = 6×A–E; detail 42 = 6 colors × 7 subtypes; eye 17 mood/style
variants, not color-matched; mouth 14; nose 4 colors only: brown/green/red/yellow).
Files verified present at `"/Users/kylejohnson/Desktop/Tome Sweet Tome/Free Assets for Tome Sweet Tome/kenney_monster-builder-pack/PNG/Default/"`
(178 files; spot-checked `body_redA.png`, `arm_darkC.png`, `detail_yellow_antenna_small.png`,
`eye_cute_light.png`, `mouth_closed_happy.png`, `nose_brown.png` — all exist).

**Body color** — `palette.id` (16 values) → Kenney color (6 values), warm-biased per brief:

| palette.id | hue | → color | palette.id | hue | → color |
|---|---|---|---|---|---|
| peach | 18 | red | apricot | 30 | yellow |
| berry | 326 | red | amber | 38 | yellow |
| coral | 8 | red | plum | 296 | dark |
| rose | 346 | red | indigo | 238 | dark |
| lemon | 52 | yellow | lavender | 268 | white |
| mint | 150 | green | aqua | 174 | white |
| moss | 104 | green | lagoon | 196 | blue |
| fern | 132 | green | sky | 210 | blue |

Result: red 4, yellow 3, green 3, dark 2, white 2, blue 2 → warm (red+yellow+dark) =
9/16 (56%), cool (blue+green) = 5/16 (31%), neutral(white) = 2/16. First-pass table;
purely a lookup, trivially retunable.

**Body shape** — `family` id (12, fixed order) → Kenney shape letter A–F:
`shapeLetter = families.indexOf(family) % 6`. Deterministic, spreads the 12 families
evenly twice across the 6 shapes. *Not yet visually verified against the actual A–F
silhouettes* (see Open Questions §5) — a hand-tuned id→letter table (matching "round"
families to the roundest Kenney shape, etc.) is the likely refinement once someone
eyeballs all 6 body shapes side by side.

**Detail (ears/horns/antennae)** — reuse the *existing* `family.appendage` gene (already
thematically "what sticks out of the head") instead of introducing a new mapping:

| appendage | → detail subtype |
|---|---|
| antennae | antenna_large |
| ears | ear_round |
| nubs | ear |
| leaf | antenna_small (closest available analog — no leaf part in the pack) |
| horns | horn_small |
| fin | horn_small |
| crown | horn_large |

Detail color = same color as body (detail is part of the shared 6-color palette).

**Eyes** — restrict the candidate pool to *cozy-kid-game-appropriate* variants only
(exclude angry/dead/psycho): `eye_cute_light`, `eye_cute_dark`, `eye_closed_happy`,
`eye_closed_feminine`, `eye_human`, `eye_human_blue`, `eye_human_green`, `eye_human_red`,
`eye_blue`, `eye_red`, `eye_yellow` (11 candidates). Select via `voice.id` (8 values,
currently visually unused) → index into this pool, giving that flavor-only gene a
visual payoff. **Mood overlay** (live, not a gene): `sleepy`/tucked-in forces
`eye_closed_happy` regardless of the generated pick, mirroring today's CSS
`display:none` on the sleepy eye.

**Mouth** — bucket the 14 mouths by `idle.id` (4 values, currently animation-only):
e.g. bounce→`mouth_closed_happy`, sway→`mouthC`, doze→`mouth_closed_sad`,
wiggle→`mouthF` (first-pass; any consistent bucketing works). **Mood overlay**: beaming
→ swap to `mouth_closed_happy`; peckish → a small "o"-shaped lettered mouth — same
live-swap pattern as eyes.

**Nose** — body color → nose color (nose only has brown/green/red/yellow):
red→red, yellow→yellow, dark→brown, green→green, **blue→brown (fallback)**,
**white→brown (fallback)** — flagged limitation, see §5.

**Rarity** — unchanged mechanism: `luminous` keeps the existing `luminous-glow`
CSS filter animation applied to the whole sprite stack (filters composite fine over
`<img>` layers, no change needed there).

**Publisher birthmark** — unchanged: the emoji glyph (🕯️⭐🌙🍃🪶📖) stays as a small
absolutely-positioned text overlay on top of the sprite stack, exactly as today.

**Growth stage → part reveal** (new "more parts as it grows" behavior, replacing
pure scale/hue interpolation):

| Stage | Parts shown | Notes |
|---|---|---|
| 1 · Hatchling | body + eyes + mouth + nose only | no limbs, no detail — smallest, simplest silhouette |
| 2 · Sprout | + legs + arms | scale step up, matches today's `.sprout` reveal beat |
| 3 · Bloom | + detail (ears/horns/antennae/crown) | full assembly; luminous glow if applicable, matches today's `.wing` reveal beat |

**Pattern gene (`pattern`/`pattern.placements`)** — no direct Kenney equivalent (body
sprites are flat single-color, no spot/diamond texture asset in the pack). Two options,
both preserving determinism; **this is an explicit open question**, see §5:
(a) drop the visual entirely (data still exists, unused for rendering), or
(b) keep exactly today's `.mark`/`.mini-mark` CSS shapes+`positionMarks()` layout
unchanged and simply layer them on top of the new sprite body instead of the old CSS
blob — zero new code beyond re-pointing the z-index/parent.

**Mini-orb sizes (habitat/collection/preview, ~46–92px)**: propose body+eyes+mouth
only (no limbs/detail), matching today's mini-orb which never showed limbs either —
keeps tiny renders legible. See §5 for the alternative (full tiny sprite).

---

## 4. INTEGRATION PLAN

**New pure module** — `src/systems/sprite-map.js`: exports something like
`spriteLookFor(creature, stage, mood)` → a plain data object (`{ body: {color, shape},
legs, arms, detail: {subtype, color}, eye, nose: {color}, mouth, birthmarkIcon,
luminous: bool, partsVisible: {legs, arms, detail} }`). Pure lookup-table logic only —
zero `Math.random`/`Date.now`/network/crypto — so it is trivially unit-testable with a
fixture table exactly like `test/generation.test.mjs` already does for the generator
output, and it never mutates or re-derives the creature's identity.

**Rendering** — extend `ui.js` (or split a small `sprite-render.js` DOM builder) with
a function that paints absolutely-positioned `<img>` layers into `.creature .body` /
`.book-orb`, modeled directly on `redesign/mocks/redesign.css` §6 (`.stackling`,
`.sl-body`, `.sl-arm`, `.sl-leg`, `.sl-detail`, `.sl-eye`, `.sl-nose`, `.sl-mouth`,
mirrored copies via `transform: scaleX(-1)`, and `.stackling--tiny`/`.stackling--chip`
scale variants already built for exactly the small-size use case). Everything **outside**
the body — `.creature` container, `--scale`, data-attributes, stage/mood classes,
`flash()`-driven animation classes (`anim-feed`, `poof`, `pop-in`, `wake`, etc.),
`applyCreatureLook()`'s call sites, `paintMiniOrb()`/`buildMiniOrb()`'s call sites in
`renderHabitat()`/`renderCollection()`/`showCreaturePreview()` — stays as-is; only what
gets painted *inside* changes.

**Assets** — copy (not reference in place) the needed PNGs from
`"/Users/kylejohnson/Desktop/Tome Sweet Tome/Free Assets for Tome Sweet Tome/kenney_monster-builder-pack/PNG/Default/"`
(+ `/Double/` for @2x) into a served path under `creature-care-mvp/` (e.g.
`assets/creatures/`), since the source folder lives outside the app's asset root today.
Raster PNGs are **acceptable** here — confirmed creatures are intentionally *not*
themed (unlike icons, which use `currentColor` for the 3-theme system per
`design-manifest.json`), so a fixed-color sprite has no theming conflict. Parts are
individually-cropped (not canvas-aligned — `design-manifest.json`'s own note: body_redA
is 165×165, arm_redA 82×176, ear 54×54, eye 64×69, mouth 80×24, nose 47×51), so each
part needs an absolute-positioned layer with a hand-tuned per-shape offset — the 3 mock
recipes (Ember/Marigold/Cinder in `redesign/mocks/redesign.css` lines 335-374) are a
directly reusable reference for the offset-tuning pattern, but offsets must be
re-derived per body **shape letter** (A–F) since a different shape changes where
limbs/head attach — this is the largest hand-tuning cost in the whole plan (6 shapes ×
{legs, arms, detail, eye, nose, mouth} anchor points).

**CSS changes** — mostly additive: new `.sl-*` layer rules per shape letter (modeled on
`.stackling--*`). Replace: `.creature .body`'s `hsl(var(--hue))` gradient/background
(→ image layer), `.creature[data-appendage=...] .feature` rules (→ detail layer, keyed
by shape+subtype instead of appendage-name), `.book-orb`'s gradient background and
`[data-body="tall|wide|..."]` sizing (→ per-shape-letter frame size). Keep as-is:
`--scale` stage interpolation (still resizes the whole stack), mood-driven eye/mouth
*swap* (now an `<img src>` swap instead of a CSS height/width tween), `luminous-glow`
keyframe, birthmark emoji overlay, `positionMarks()` (if pattern-marks are kept per
§3's option b).

**Determinism** — preserved by construction: (1) `generation.js` is untouched, so the
SHA-256 → `speciesSeed`/`individualSeed`/`raritySeed` → `family`/`palette`/`pattern`/
`rarity`/`voice`/`idle`/`quirk`/`publisher` pipeline is byte-for-byte identical; (2)
`spriteLookFor()` is a pure table lookup over those already-deterministic fields; (3)
the only two "live" inputs are `stage` (already a pure function of monotonic `cp`) and
`mood` (already a pure function of `stats`, via `moodOf()`) — both are 100% deterministic
given the same event history, exactly as today. Same book → same bytes → same sprite,
always.

**Test impact** — checked directly: `test/generation.test.mjs` and
`test/collection.test.mjs` pin exact `family.id`/`palette.id`/`pattern.id`/hue values per
ISBN fixture — **unaffected**, since `generation.js` isn't touched. `src/contracts.js`'s
`isCreatureRecord()` only requires `baseTraits` to be an object (contracts.js:173-178) —
no shape constraint to violate. Searched the whole `test/` directory (20 files, 463
`test(...)` calls) for any DOM/CSS assertion on `ui.js` output (`.creature`, `.mark`,
`--hue`, `data-body`, etc.) — **found none**; there is no `test/ui*.test.mjs`. Net: this
change has **zero existing test surface to break**, and adding a `test/sprite-map.test.mjs`
fixture table (mirroring `generation.test.mjs`'s pattern) is the natural way to pin the
new mapping's own determinism going forward.

**Risks** — (1) hand-tuned per-shape offsets are real design/dev effort (6 shapes ×
6 anchor points each), and misalignment reads as "sloppy" fast at hero size; (2) mini
sizes (46–92px) may render soft/blurry with 5+ stacked PNG layers — favors the
"body+eyes+mouth only" mini-orb proposal in §3; (3) asset copy step + attribution
(Kenney packs are typically CC0, but confirm license file) needs to land before any
code references the new path; (4) the eye/mouth pool curation (excluding angry/dead/
psycho) is a subjective content-safety call worth an explicit owner sign-off, not just
an implementation detail.

---

## 5. OPEN QUESTIONS for the owner

1. **Pattern/birthmark marks**: drop the `.mark` visual entirely now that pattern has
   no raster equivalent, or keep the existing CSS mark shapes layered on top of the new
   sprite body (cheap, reuses `positionMarks()` verbatim)?
2. **One-eyed "cute cyclops" look**: the 3 existing mocks (Ember/Marigold) use a single
   centered `eye_cute_*` sprite rather than mirrored pairs, because those files turned
   out to be pre-combined two-pupil graphics (see `redesign/README.md` TODO #2). Keep
   that look project-wide, or standardize on true mirrored-pair eye variants only?
3. **Body shape mapping**: is `familyIndex % 6` an acceptable first pass, or does the
   owner want to eyeball the 6 actual A–F silhouettes and hand-assign each of the 12
   families to its closest-looking shape?
4. **How literally should book traits map to appearance?** The 3 mock recipes lean on
   narrative ("warm/uplifting tone → red", "mystery/gothic → horns") that has no
   equivalent signal in the generator (which only has ISBN-hash bytes, no genre/tone
   data) — confirm the mapping should stay purely hash-derived (per this plan) rather
   than trying to pull in `book-metadata.js` genre/subject data later.
5. **Mini-orbs**: stay as simplified body+face-only tiny sprites (matches today, cheaper,
   likely sharper at small sizes), or become full tiny multi-part sprite creatures
   (more "alive," matches the mock's `.stackling--tiny`/`--chip` scale variants which
   already assume full-part tiny renders)?
6. **Nose color fallback**: blue/white body → brown nose (only real option given the
   pack's 4-color nose set) is a visible palette mismatch on 2 of 6 body colors — accept
   it, or drop the nose part entirely for those two colors?
7. **Voice/idle repurposing**: acceptable to give the previously-flavor-only `voice`
   (eye style) and `idle` (mouth style) genes a new visual role, on top of their existing
   text/animation roles — or should eye/mouth instead derive from a different existing
   field (e.g. `rarity`, or a new bit-slice of `individualSeed` not currently used for
   anything)?
