# Stacklings redesign — review mocks

Static, self-contained mocks implementing `design-manifest.json` for owner review.
Nothing here touches the live app (`creature-care-mvp/src`, `style.css`,
`content.json`) — this whole folder is additive.

## What's here

```
redesign/
  design-manifest.json   (input — art direction spec)
  catalog.json            (input — asset catalog)
  assets/
    icons/        17 inline-ready SVGs, fill="currentColor", named by slot
    fonts/        5 Eczar static .ttf weights
    creatures/    19 monster-builder PNG parts (Ember/Marigold/Cinder)
    moods/        2 vector-emoji mood faces (happy, delighted)
    textures/     parchment paper-grain JPEG
  mocks/
    base.css       unmodified copy of ../../style.css (do not edit)
    redesign.css    everything new: fonts, icon system, creature assembly, parchment, mock chrome
    index.html      review landing page: theme switcher + tab bar + icon before/after board + creature lineup
    care.html       Care page mock
    habitat.html    Habitat page mock
```

## Opening the mocks

**Easiest:** just double-click `mocks/index.html` (or `care.html` / `habitat.html`) —
everything uses relative paths and works straight off disk via `file://`.

**Or serve it:** run a static server from **`redesign/`** (the folder one level
up from `mocks/`, not `mocks/` itself):

```
cd redesign
python3 -m http.server 8000
```

then visit `http://localhost:8000/mocks/index.html`. Serving from *inside*
`mocks/` will 404 every asset — the CSS/HTML reference `../assets/...`, which
needs `redesign/` as the server root to resolve.

## Theme switcher

A bar fixed to the top of every page (`buttons → document.documentElement.dataset.theme`)
lets you flip between `nook` / `schoolhouse` / `spellbook` live. The choice
persists across all three pages via `localStorage` (same key the real app
uses, `stacklings.theme`), so you can switch once on `index.html` and it
carries over when you click through to `care.html` / `habitat.html`. Every
icon, the Eczar type, and the parchment tint all recolor automatically — no
per-theme icon variants exist, by design (that's the point of `currentColor`).

## What each mock shows

- **`index.html`** — the at-a-glance sign-off page. The redesigned 6-icon tab
  bar (Care shown active), a full before/after board of all 18 icon
  swaps (old emoji → new inline SVG, one row per manifest slot, including the
  `debug.gear` reuse of `nav.settings`), and the 3-creature lineup
  (Ember / Marigold / Cinder) assembled from monster-builder parts.
- **`care.html`** — the Care page: the featured Stackling (Ember) assembled
  from parts, a mood-face badge (vector-emoji, care-state indicator, kept
  separate from the body per the manifest), heart-icon affection meter,
  star/empty-star daily-care pips and sprout-icon growth chip in the
  nameplate, moon-icon tuck-in button, a sleep(zzz) ambient badge, sparkle FX
  around the creature, and two new quick-action buttons (camera "Snap a
  memory", sparkle "Celebrate") plus a check-icon "care complete" badge —
  demonstrating every content/inline icon slot in one screen, per the
  manifest's rationale. Eczar on the page heading, nameplate, and grow-chip
  numeral. Parchment texture on the nameplate.
- **`habitat.html`** — the Habitat page: Eczar `{owner}'s Stacklings Habitat`
  title, the library-window scene (moon, bookshelf band, potted plant) with
  all 3 Stacklings standing on the floor, and the "Your creatures" collection
  list (parchment-tinted cards) with a mini avatar of each creature. This one
  faithfully reproduces the real app's **single no-scroll viewport** design
  for the habitat page (`.page-habitat{height:calc(100dvh - ...);overflow:hidden}`)
  — the page itself never scrolls; only the creature list scrolls internally
  if it overflows its card, exactly like production.

Tab bar + theme switcher appear on every page.

## Known polish TODOs (flag for the art director / owner)

1. **Creature part offsets are proportionally hand-tuned, not sprite-verified.**
   Each `.stackling--*` position in `redesign.css` (section 6) was computed as
   a percentage of the body sprite's own box (e.g. "ears sit 6% above the
   body's top edge, arms poke 22px past the body's side edge") after visually
   inspecting each PNG, not by reading exact transparent-padding pixel
   offsets. It reads as a cute, coherent creature in every theme, but a
   pixel-level pass against the actual Kenney sprite anchors would sharpen
   arm/leg/ear alignment further.
2. **Eye assets: deliberate deviation from the manifest's "mirror x2" instruction.**
   `eye_cute_light.png` (Ember) and `eye_cute_dark.png` (Marigold) turned out,
   on inspection, to already be a single pre-combined sclera-with-two-pupils
   graphic — not a one-eye sprite meant to be duplicated. Placing two mirrored
   copies per the manifest's literal instruction would quadruple the pupils
   and look wrong, so both creatures use **one centered copy** instead,
   which currently reads as a cute one-eyed "cyclops" monster. Cinder's
   `eye_closed_happy.png` *is* a genuine single-eye curve and correctly uses
   two positioned + mirrored copies per spec. Worth an art-direction call:
   keep the one-eyed look (it's charming and very Kenney-monster-builder), or
   swap Ember/Marigold to a different eye variant that has true left/right
   pairs.
3. **`.ttf` → `.woff2` before shipping.** Per the manifest's own font gotcha —
   only static `.ttf` files were provided; convert + Latin-subset
   (`fonttools`/`pyftsubset`) for production. The mocks load `.ttf` directly,
   which is fine for review but not for ship.
4. **Habitat's fixed theme-bar "tax" on the 100dvh budget.** The mock adds a
   60px fixed bar the real app doesn't have, so `.page-habitat`'s height is
   `calc(100dvh - 60px - 12px)` instead of the real app's `calc(100dvh - 12px)`.
   Verified working end-to-end on a realistic ~812px-tall mobile viewport
   (full single-screen fit, internal scroll on the creature list). On an
   unusually short browser window the creature list's internal scrollbar
   absorbs the difference gracefully, but hasn't been checked against every
   real device size.
5. **Care page's "Snap a memory" / "Celebrate" buttons are new, not real
   features.** They exist purely to give `inline.camera` and `content.sparkle`
   a plausible action-button home on the Care page (per the manifest
   screens-rationale calling out camera/sparkle among Care's icon set) — flag
   for product sign-off on whether these ship as real actions or get cut back
   to a pure icon-system demo.
6. **Icon licensing.** All 17 chosen icons are from game-icons.net (CC BY 3.0
   per-author, per `catalog.json`) — attribution is required before shipping,
   check each author's `license.txt` split (a small subset is CC0).

## Live app confirmation

Nothing under `creature-care-mvp/src`, `creature-care-mvp/style.css`,
`creature-care-mvp/content.json`, or `creature-care-mvp/index.html` was
modified — `git status` shows only new, untracked files under `redesign/`.
`mocks/base.css` is byte-identical to the live `style.css` (verified via `diff`).
