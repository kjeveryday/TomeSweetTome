// Pure trait -> Kenney "Monster Builder" sprite mapping. RENDERING ONLY.
//
// This module never touches generation.js/state.js/events.js/contracts.js and
// never introduces randomness, time, or network access — every export here is
// a plain lookup table, and spriteLookFor()/layoutFor() are pure functions of
// their arguments. Same creature + stage + mood in -> same sprite parts out,
// always (mirrors the determinism guarantee generation.js already gives the
// creature's genes).
//
// Asset source: Kenney "Monster Builder" pack, 178 PNGs copied verbatim into
// assets/creatures/ (see redesign/catalog.json's monsterBuilder section for
// the full taxonomy this table is built from).

// ---------------------------------------------------------------------------
// 1. Trait -> part-choice tables
// ---------------------------------------------------------------------------

// palette.id (16 values) -> Kenney body color (6 values), warm-biased.
export const PALETTE_COLOR = {
  peach: 'red', berry: 'red', coral: 'red', rose: 'red',
  lemon: 'yellow', apricot: 'yellow', amber: 'yellow',
  mint: 'green', moss: 'green', fern: 'green',
  plum: 'dark', indigo: 'dark',
  lavender: 'white', aqua: 'white',
  lagoon: 'blue', sky: 'blue'
};

// family.id (12 values) -> Kenney body shape letter (A-F). Hand-tuned by
// visually inspecting all 6 body_*<letter>.png silhouettes (see report):
// A = rounded-square blob (squat/pebble), B = perfect circle (round),
// C = egg/teardrop (pear/drop), D = dome / wide flared base (wide),
// E = tall narrow capsule (tall), F = tall capsule with small side nubs (bean).
export const FAMILY_SHAPE = {
  motelet: 'B', // round
  quillkin: 'E', // tall
  puffkin: 'D', // wide
  dewling: 'C', // pear
  bookle: 'F', // bean
  riffin: 'A', // squat
  glimmer: 'C', // drop
  niblet: 'A', // pebble
  wispin: 'E', // tall
  tumble: 'D', // wide
  loomkin: 'B', // round
  inklit: 'F' // bean
};

// arm/leg parts only ship shapes A-E (no F) - shape F bodies fall back to E,
// the nearest neighbor by overall size (see report for the tradeoff).
export const ARM_LEG_LETTER = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'E' };

// family.appendage (7 values) -> detail subtype (of the 7 the pack ships).
export const APPENDAGE_DETAIL = {
  antennae: 'antenna_large',
  ears: 'ear_round',
  nubs: 'ear',
  leaf: 'antenna_small', // closest analog - no leaf part in the pack
  horns: 'horn_small',
  fin: 'horn_small',
  crown: 'horn_large'
};

// voice.id (8 values, index order matches content.json's `voices` array) ->
// cozy eye pool entry. `layout` tags whether the file is a single pre-combined
// two-pupil graphic (rendered once, centered) or a true single eye meant to be
// mirrored into a left/right pair. Angry/dead/psycho variants are excluded.
export const EYE_POOL = [
  { name: 'cute_light', layout: 'single' }, // 0 chirp
  { name: 'human', layout: 'pair' }, // 1 hum
  { name: 'cute_dark', layout: 'single' }, // 2 peep
  { name: 'human_blue', layout: 'pair' }, // 3 creak
  { name: 'human_green', layout: 'pair' }, // 4 trill
  { name: 'closed_happy', layout: 'pair' }, // 5 purr (also the sleepy override)
  { name: 'red', layout: 'pair' }, // 6 whistle
  { name: 'yellow', layout: 'pair' } // 7 chime
];

// idle.id (4 values, index order matches content.json's `idles` array) ->
// base mouth pick. Mood overlays (below) take priority when active.
export const MOUTH_BY_IDLE = {
  bounce: 'closed_happy',
  sway: 'C',
  doze: 'closed_sad',
  wiggle: 'F'
};

// Live mood overlays (mood is derived from stats each render, not a gene).
export const EYE_MOOD_OVERRIDE = { sleepy: 'closed_happy' };
export const MOUTH_MOOD_OVERRIDE = { beaming: 'closed_happy', peckish: 'D' };

// Kenney body color -> nose color. The nose set only ships brown/green/red/
// yellow, so blue/white bodies drop the nose entirely rather than wear a
// mismatched brown one (owner override of the plan's brown fallback).
export const NOSE_COLOR = { red: 'red', yellow: 'yellow', green: 'green', dark: 'brown', blue: null, white: null };

// Growth stage -> which extra parts are shown. Stage 1 = body+eyes+mouth+nose
// only; stage 2 adds legs+arms; stage 3 adds the head detail.
export const STAGE_PARTS_VISIBLE = {
  1: { legs: false, arms: false, detail: false },
  2: { legs: true, arms: true, detail: false },
  3: { legs: true, arms: true, detail: true }
};

function mouthFile(name) {
  return /^[A-J]$/.test(name) ? `mouth${name}.png` : `mouth_${name}.png`;
}

// ---------------------------------------------------------------------------
// 2. spriteLookFor(creature, stage, mood) - the main entry point
// ---------------------------------------------------------------------------

export function spriteLookFor(creature, stage, mood) {
  const shape = FAMILY_SHAPE[creature.family.id] ?? 'A';
  const bodyColor = PALETTE_COLOR[creature.palette.id] ?? 'red';
  const armLegLetter = ARM_LEG_LETTER[shape] ?? shape;
  const detailSubtype = APPENDAGE_DETAIL[creature.family.appendage] ?? 'ear_round';
  // voice.id -> its 0-7 slot in EYE_POOL, via a fixed id->index table (below)
  // rather than depending on content.json's array order.
  const voiceSlot = VOICE_INDEX[creature.voice.id] ?? 0;
  const idleName = creature.idle.id;

  const eyeBase = EYE_POOL[voiceSlot] ?? EYE_POOL[0];
  const eyeName = mood != null && EYE_MOOD_OVERRIDE[mood] ? EYE_MOOD_OVERRIDE[mood] : eyeBase.name;
  const eyeLayout = eyeName === EYE_MOOD_OVERRIDE.sleepy ? 'pair' : eyeBase.layout;

  const mouthBaseName = MOUTH_BY_IDLE[idleName] ?? MOUTH_BY_IDLE.bounce;
  const mouthName = mood != null && MOUTH_MOOD_OVERRIDE[mood] ? MOUTH_MOOD_OVERRIDE[mood] : mouthBaseName;

  const noseColor = NOSE_COLOR[bodyColor] ?? null;

  const partsVisible = STAGE_PARTS_VISIBLE[stage] ?? STAGE_PARTS_VISIBLE[1];

  return {
    body: { color: bodyColor, shape, file: `body_${bodyColor}${shape}.png` },
    arms: { color: bodyColor, shape: armLegLetter, file: `arm_${bodyColor}${armLegLetter}.png` },
    legs: { color: bodyColor, shape: armLegLetter, file: `leg_${bodyColor}${armLegLetter}.png` },
    detail: { subtype: detailSubtype, color: bodyColor, file: `detail_${bodyColor}_${detailSubtype}.png` },
    eye: { name: eyeName, layout: eyeLayout, file: `eye_${eyeName}.png` },
    mouth: { name: mouthName, file: mouthFile(mouthName) },
    nose: noseColor ? { color: noseColor, file: `nose_${noseColor}.png` } : null,
    partsVisible,
    luminous: creature.rarity?.id === 'luminous'
  };
}

// A gene-less "plain starter" (hatched straight from the egg, no book yet) has
// no palette/family to map, so without this it falls back to the old CSS blob.
// Feed spriteLookFor a fixed, warm default creature so the very first monster is
// a proper sprite too. Pure + deterministic: same stage/mood -> same look.
export const DEFAULT_CREATURE = {
  palette: { id: 'coral' },                     // warm coral -> red body
  family: { id: 'motelet', appendage: 'ears' }, // round body (B) + friendly ears
  voice: { id: 'purr' },                        // a cozy eye style
  idle: { id: 'bounce' },                       // a happy mouth
  rarity: { id: 'common' }
};

export function defaultSpriteLook(stage, mood) {
  return spriteLookFor(DEFAULT_CREATURE, stage, mood);
}

// creature.voice.id -> its 0-7 slot in EYE_POOL. Fixed independently of
// content.json's array order so this module never needs to import content.json.
const VOICE_INDEX = {
  chirp: 0, hum: 1, peep: 2, creak: 3, trill: 4, purr: 5, whistle: 6, chime: 7
};

// ---------------------------------------------------------------------------
// 3. Per-shape hero layout (unscaled px, frame-relative). Hand-derived from
//    the 3 mock recipes (redesign/mocks/redesign.css lines 334-374: Ember=A,
//    Marigold=B, Cinder=C, used verbatim) plus two universal patterns found by
//    cross-checking those three: arm left edge is always bodyLeft-22px, and a
//    leg's bottom edge always sits 22px above the frame bottom. Shapes D/E/F
//    (no hand-tuned mock recipe exists) reuse those two patterns plus a
//    proportional left/top template averaged from the round (A/B) and tall
//    (C) recipes, applied to each shape's actual body_*<letter>.png pixel
//    size. See the report for exactly which of these are best-effort guesses.
// ---------------------------------------------------------------------------

export const SHAPE_LAYOUT = {
  A: {
    frame: { w: 245, h: 247 },
    body: { left: 40, top: 48, w: 165, h: 165 },
    legL: { left: 58, top: 58, w: 72, h: 167 },
    armL: { left: 18, top: 101, w: 82, h: 176 },
    detailL: { cx: 83, cy: 58 },
    eyeCy: 98,
    noseCy: 136,
    mouthCy: 167
  },
  B: {
    frame: { w: 272, h: 274 },
    body: { left: 40, top: 48, w: 192, h: 192 },
    legL: { left: 76, top: 103, w: 55, h: 149 },
    armL: { left: 18, top: 109, w: 51, h: 161 },
    detailL: { cx: 90, cy: 60 },
    eyeCy: 106,
    noseCy: 150,
    mouthCy: 186
  },
  C: {
    frame: { w: 221, h: 276 },
    body: { left: 40, top: 48, w: 141, h: 194 },
    legL: { left: 47, top: 130, w: 79, h: 124 },
    armL: { left: 18, top: 110, w: 98, h: 181 },
    detailL: { cx: 77, cy: 60 },
    eyeCy: 110,
    noseCy: 151,
    mouthCy: 188
  },
  D: {
    frame: { w: 254, h: 264 },
    body: { left: 40, top: 48, w: 174, h: 182 },
    legL: { left: 66, top: 120, w: 71, h: 122 },
    armL: { left: 18, top: 106, w: 92, h: 197 },
    detailL: { cx: 85, cy: 59 },
    eyeCy: 103,
    noseCy: 144,
    mouthCy: 180
  },
  E: {
    frame: { w: 212, h: 332 },
    body: { left: 40, top: 48, w: 132, h: 250 },
    legL: { left: 47, top: 201, w: 102, h: 109 },
    armL: { left: 18, top: 128, w: 71, h: 149 },
    detailL: { cx: 75, cy: 63 },
    eyeCy: 128,
    noseCy: 181,
    mouthCy: 229
  },
  F: {
    frame: { w: 250, h: 318 },
    body: { left: 40, top: 48, w: 170, h: 236 },
    legL: { left: 48, top: 187, w: 102, h: 109 },
    armL: { left: 18, top: 124, w: 71, h: 149 },
    detailL: { cx: 84, cy: 63 },
    eyeCy: 123,
    noseCy: 173,
    mouthCy: 219
  }
};

// Native pixel size of every eye/nose/mouth/detail-subtype file the tables
// above can select, keyed by the bare name used in EYE_POOL/mouth names/
// APPENDAGE_DETAIL. Parts are placed at their real size (never stretched) by
// centering this box on the shape's anchor point.
export const ASSET_DIMENSIONS = {
  detail: {
    antenna_large: { w: 38, h: 58 },
    antenna_small: { w: 26, h: 42 },
    ear: { w: 38, h: 44 },
    ear_round: { w: 54, h: 54 },
    horn_large: { w: 40, h: 42 },
    horn_small: { w: 31, h: 27 }
  },
  eye: {
    cute_light: { w: 64, h: 69 },
    cute_dark: { w: 64, h: 69 },
    human: { w: 64, h: 69 },
    human_blue: { w: 64, h: 69 },
    human_green: { w: 64, h: 69 },
    closed_happy: { w: 42, h: 18 },
    red: { w: 64, h: 58 },
    yellow: { w: 64, h: 69 }
  },
  nose: {
    brown: { w: 54, h: 48 },
    green: { w: 53, h: 59 },
    red: { w: 47, h: 51 },
    yellow: { w: 46, h: 38 }
  },
  mouth: {
    closed_happy: { w: 80, h: 24 },
    C: { w: 78, h: 38 },
    closed_sad: { w: 52, h: 20 },
    F: { w: 74, h: 42 },
    D: { w: 66, h: 27 }
  }
};

// Mini (book-orb) uniform shrink factor per shape, applied on top of the same
// SHAPE_LAYOUT numbers above (see report - approximate, tuned against the
// default ~88x78 / ~70x92 book-orb box sizes).
export const MINI_SCALE = { A: 0.33, B: 0.29, C: 0.3, D: 0.31, E: 0.3, F: 0.27 };

const EYE_GAP = 4; // px between mirrored pair-eye inner edges, from Cinder's recipe

// ---------------------------------------------------------------------------
// 4. layoutFor(spriteLook) - resolves SHAPE_LAYOUT + ASSET_DIMENSIONS into a
//    flat list of frame-relative boxes for every part this creature *could*
//    show (legs/arms/detail included regardless of partsVisible/nose-null -
//    callers filter by context: the hero filters by partsVisible, the mini
//    orb only ever takes body/eye/nose/mouth).
// ---------------------------------------------------------------------------

export function layoutFor(spriteLook) {
  const layout = SHAPE_LAYOUT[spriteLook.body.shape] ?? SHAPE_LAYOUT.A;
  const { frame } = layout;
  const parts = [];

  parts.push({ id: 'body', file: spriteLook.body.file, z: 10, mirror: false, ...layout.body });

  const legR = { left: frame.w - layout.legL.left - layout.legL.w, top: layout.legL.top, w: layout.legL.w, h: layout.legL.h };
  parts.push({ id: 'legL', file: spriteLook.legs.file, z: 5, mirror: false, ...layout.legL });
  parts.push({ id: 'legR', file: spriteLook.legs.file, z: 5, mirror: true, ...legR });

  const armR = { left: frame.w - layout.armL.left - layout.armL.w, top: layout.armL.top, w: layout.armL.w, h: layout.armL.h };
  parts.push({ id: 'armL', file: spriteLook.arms.file, z: 8, mirror: false, ...layout.armL });
  parts.push({ id: 'armR', file: spriteLook.arms.file, z: 8, mirror: true, ...armR });

  const detailDims = ASSET_DIMENSIONS.detail[spriteLook.detail.subtype] ?? { w: 40, h: 40 };
  const detailL = boxAt(layout.detailL.cx, layout.detailL.cy, detailDims);
  const detailR = boxAt(frame.w - layout.detailL.cx, layout.detailL.cy, detailDims);
  parts.push({ id: 'detailL', file: spriteLook.detail.file, z: 12, mirror: false, ...detailL });
  parts.push({ id: 'detailR', file: spriteLook.detail.file, z: 12, mirror: true, ...detailR });

  const eyeDims = ASSET_DIMENSIONS.eye[spriteLook.eye.name] ?? { w: 64, h: 69 };
  const eyeCx = frame.w / 2;
  if (spriteLook.eye.layout === 'single') {
    parts.push({ id: 'eye', file: spriteLook.eye.file, z: 20, mirror: false, ...boxAt(eyeCx, layout.eyeCy, eyeDims) });
  } else {
    const eyeL = { left: eyeCx - EYE_GAP / 2 - eyeDims.w, top: layout.eyeCy - eyeDims.h / 2, w: eyeDims.w, h: eyeDims.h };
    const eyeR = { left: eyeCx + EYE_GAP / 2, top: layout.eyeCy - eyeDims.h / 2, w: eyeDims.w, h: eyeDims.h };
    parts.push({ id: 'eyeL', file: spriteLook.eye.file, z: 20, mirror: false, ...eyeL });
    parts.push({ id: 'eyeR', file: spriteLook.eye.file, z: 20, mirror: true, ...eyeR });
  }

  if (spriteLook.nose) {
    const noseDims = ASSET_DIMENSIONS.nose[spriteLook.nose.color] ?? { w: 47, h: 51 };
    parts.push({ id: 'nose', file: spriteLook.nose.file, z: 22, mirror: false, ...boxAt(frame.w / 2, layout.noseCy, noseDims) });
  }

  const mouthDims = ASSET_DIMENSIONS.mouth[spriteLook.mouth.name] ?? { w: 70, h: 30 };
  parts.push({ id: 'mouth', file: spriteLook.mouth.file, z: 24, mirror: false, ...boxAt(frame.w / 2, layout.mouthCy, mouthDims) });

  return { frame, parts };
}

function boxAt(cx, cy, dims) {
  return { left: cx - dims.w / 2, top: cy - dims.h / 2, w: dims.w, h: dims.h };
}
