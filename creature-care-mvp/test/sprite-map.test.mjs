import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateCreature } from '../src/systems/generation.js';
import {
  spriteLookFor,
  layoutFor,
  PALETTE_COLOR,
  FAMILY_SHAPE,
  ARM_LEG_LETTER,
  APPENDAGE_DETAIL,
  EYE_POOL,
  MOUTH_BY_IDLE,
  NOSE_COLOR,
  STAGE_PARTS_VISIBLE,
  SHAPE_LAYOUT
} from '../src/systems/sprite-map.js';

const assetsDir = fileURLToPath(new URL('../assets/creatures/', import.meta.url));
const assetExists = (file) => existsSync(`${assetsDir}${file}`);

test('known books produce a frozen sprite look (mirrors generation.test.mjs fixtures)', async () => {
  const fixtures = [
    ['9780064400558', {
      body: { color: 'red', shape: 'D', file: 'body_redD.png' },
      arms: { color: 'red', shape: 'D', file: 'arm_redD.png' },
      legs: { color: 'red', shape: 'D', file: 'leg_redD.png' },
      detail: { subtype: 'ear', color: 'red', file: 'detail_red_ear.png' },
      eye: { name: 'cute_light', layout: 'single', file: 'eye_cute_light.png' },
      mouth: { name: 'F', file: 'mouthF.png' },
      nose: { color: 'red', file: 'nose_red.png' },
      partsVisible: { legs: true, arms: true, detail: false },
      luminous: false
    }],
    ['9780399226908', {
      body: { color: 'red', shape: 'F', file: 'body_redF.png' },
      arms: { color: 'red', shape: 'E', file: 'arm_redE.png' },
      legs: { color: 'red', shape: 'E', file: 'leg_redE.png' },
      detail: { subtype: 'horn_small', color: 'red', file: 'detail_red_horn_small.png' },
      eye: { name: 'human_green', layout: 'pair', file: 'eye_human_green.png' },
      mouth: { name: 'closed_sad', file: 'mouth_closed_sad.png' },
      nose: { color: 'red', file: 'nose_red.png' },
      partsVisible: { legs: true, arms: true, detail: false },
      luminous: false
    }],
    ['9780000001252', {
      body: { color: 'red', shape: 'F', file: 'body_redF.png' },
      arms: { color: 'red', shape: 'E', file: 'arm_redE.png' },
      legs: { color: 'red', shape: 'E', file: 'leg_redE.png' },
      detail: { subtype: 'horn_small', color: 'red', file: 'detail_red_horn_small.png' },
      eye: { name: 'human_blue', layout: 'pair', file: 'eye_human_blue.png' },
      mouth: { name: 'closed_happy', file: 'mouth_closed_happy.png' },
      nose: { color: 'red', file: 'nose_red.png' },
      partsVisible: { legs: true, arms: true, detail: false },
      luminous: true
    }],
    ['9780000000101', { // riffin/lagoon -> shape A, blue body -> nose dropped
      body: { color: 'blue', shape: 'A', file: 'body_blueA.png' },
      arms: { color: 'blue', shape: 'A', file: 'arm_blueA.png' },
      legs: { color: 'blue', shape: 'A', file: 'leg_blueA.png' },
      detail: { subtype: 'horn_small', color: 'blue', file: 'detail_blue_horn_small.png' },
      eye: { name: 'cute_light', layout: 'single', file: 'eye_cute_light.png' },
      mouth: { name: 'C', file: 'mouthC.png' },
      nose: null,
      partsVisible: { legs: true, arms: true, detail: false },
      luminous: false
    }],
    ['9780000000026', { // glimmer/aqua -> shape C, white body -> nose dropped
      body: { color: 'white', shape: 'C', file: 'body_whiteC.png' },
      arms: { color: 'white', shape: 'C', file: 'arm_whiteC.png' },
      legs: { color: 'white', shape: 'C', file: 'leg_whiteC.png' },
      detail: { subtype: 'horn_large', color: 'white', file: 'detail_white_horn_large.png' },
      eye: { name: 'yellow', layout: 'pair', file: 'eye_yellow.png' },
      mouth: { name: 'closed_sad', file: 'mouth_closed_sad.png' },
      nose: null,
      partsVisible: { legs: true, arms: true, detail: false },
      luminous: false
    }]
  ];

  for (const [isbn, expected] of fixtures) {
    const { creature } = await generateCreature(isbn);
    assert.deepEqual(spriteLookFor(creature, 2, 'content'), expected, `sprite look mismatch for ${isbn}`);
  }
});

test('stage gates which parts are visible; body/eye/mouth/nose never change by stage', async () => {
  const { creature } = await generateCreature('9780064400558');
  const stage1 = spriteLookFor(creature, 1, 'content');
  const stage2 = spriteLookFor(creature, 2, 'content');
  const stage3 = spriteLookFor(creature, 3, 'content');

  assert.deepEqual(stage1.partsVisible, { legs: false, arms: false, detail: false });
  assert.deepEqual(stage2.partsVisible, { legs: true, arms: true, detail: false });
  assert.deepEqual(stage3.partsVisible, { legs: true, arms: true, detail: true });

  for (const other of [stage2, stage3]) {
    assert.deepEqual(other.body, stage1.body);
    assert.deepEqual(other.eye, stage1.eye);
    assert.deepEqual(other.mouth, stage1.mouth);
    assert.deepEqual(other.nose, stage1.nose);
    assert.deepEqual(other.arms, stage1.arms);
    assert.deepEqual(other.legs, stage1.legs);
    assert.deepEqual(other.detail, stage1.detail);
  }

  // unknown/out-of-range stage falls back to stage 1's gating
  assert.deepEqual(spriteLookFor(creature, 99, 'content').partsVisible, stage1.partsVisible);
});

test('mood overlays override the gene-picked eye and mouth live, without touching any other field', async () => {
  const { creature } = await generateCreature('9780064400558'); // base eye: cute_light/single, base mouth: F
  const base = spriteLookFor(creature, 2, 'content');
  assert.deepEqual(base.eye, { name: 'cute_light', layout: 'single', file: 'eye_cute_light.png' });
  assert.deepEqual(base.mouth, { name: 'F', file: 'mouthF.png' });

  const beaming = spriteLookFor(creature, 2, 'beaming');
  assert.deepEqual(beaming.mouth, { name: 'closed_happy', file: 'mouth_closed_happy.png' });
  assert.deepEqual(beaming.eye, base.eye); // beaming does not touch the eye

  const peckish = spriteLookFor(creature, 2, 'peckish');
  assert.deepEqual(peckish.mouth, { name: 'D', file: 'mouthD.png' });

  const sleepy = spriteLookFor(creature, 2, 'sleepy');
  assert.deepEqual(sleepy.eye, { name: 'closed_happy', layout: 'pair', file: 'eye_closed_happy.png' });
  assert.deepEqual(sleepy.mouth, base.mouth); // sleepy does not touch the mouth

  // 'wild' (a caught-but-unread creature) forces angry eyes + fangs; reading
  // clears the 'wild' mood so it softens back to the gene/stat face.
  const wild = spriteLookFor(creature, 2, 'wild');
  assert.deepEqual(wild.eye, { name: 'angry_red', layout: 'pair', file: 'eye_angry_red.png' });
  assert.deepEqual(wild.mouth, { name: 'closed_fangs', file: 'mouth_closed_fangs.png' });

  // everything else stays identical across mood swaps
  for (const withMood of [beaming, peckish, sleepy, wild]) {
    assert.deepEqual(withMood.body, base.body);
    assert.deepEqual(withMood.arms, base.arms);
    assert.deepEqual(withMood.legs, base.legs);
    assert.deepEqual(withMood.detail, base.detail);
    assert.deepEqual(withMood.nose, base.nose);
    assert.deepEqual(withMood.luminous, base.luminous);
  }

  // a neutral/unmapped mood (or none at all) leaves the gene picks alone
  assert.deepEqual(spriteLookFor(creature, 2, 'content'), base);
  assert.deepEqual(spriteLookFor(creature, 2, undefined), base);
});

test('spriteLookFor is a pure function: same inputs always produce deepEqual output', async () => {
  const { creature } = await generateCreature('9781338099133');
  const a = spriteLookFor(structuredClone(creature), 3, 'beaming');
  const b = spriteLookFor(structuredClone(creature), 3, 'beaming');
  assert.deepEqual(a, b);
});

test('FAMILY_SHAPE and PALETTE_COLOR cover every generation.js value with a valid target', () => {
  const families = [
    'motelet', 'quillkin', 'puffkin', 'dewling', 'bookle', 'riffin',
    'glimmer', 'niblet', 'wispin', 'tumble', 'loomkin', 'inklit'
  ];
  assert.deepEqual(Object.keys(FAMILY_SHAPE).sort(), families.sort());
  for (const shape of Object.values(FAMILY_SHAPE)) {
    assert.match(shape, /^[A-F]$/);
    assert.ok(SHAPE_LAYOUT[shape], `SHAPE_LAYOUT is missing an entry for shape ${shape}`);
  }

  const palettes = [
    'mint', 'lagoon', 'lavender', 'peach', 'berry', 'lemon', 'coral', 'sky',
    'moss', 'plum', 'apricot', 'aqua', 'rose', 'indigo', 'fern', 'amber'
  ];
  assert.deepEqual(Object.keys(PALETTE_COLOR).sort(), palettes.sort());
  const kenneyColors = new Set(['red', 'yellow', 'green', 'dark', 'white', 'blue']);
  for (const color of Object.values(PALETTE_COLOR)) assert.ok(kenneyColors.has(color));
});

test('ARM_LEG_LETTER maps every body shape to a real arm/leg letter (A-E, F falls back to E)', () => {
  assert.deepEqual(ARM_LEG_LETTER, { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'E' });
});

test('EYE_POOL has exactly 8 entries (one per voice.id) and a mix of single/pair layouts', () => {
  assert.equal(EYE_POOL.length, 8);
  const layouts = new Set(EYE_POOL.map((e) => e.layout));
  assert.deepEqual(layouts, new Set(['single', 'pair']));
  assert.equal(EYE_POOL.filter((e) => e.layout === 'single').length, 2);
});

test('NOSE_COLOR only drops the nose for blue and white bodies', () => {
  assert.deepEqual(NOSE_COLOR, { red: 'red', yellow: 'yellow', green: 'green', dark: 'brown', blue: null, white: null });
});

test('STAGE_PARTS_VISIBLE only ever adds parts as stage increases (monotonic reveal)', () => {
  assert.deepEqual(STAGE_PARTS_VISIBLE[1], { legs: false, arms: false, detail: false });
  assert.deepEqual(STAGE_PARTS_VISIBLE[2], { legs: true, arms: true, detail: false });
  assert.deepEqual(STAGE_PARTS_VISIBLE[3], { legs: true, arms: true, detail: true });
});

test('every filename spriteLookFor/layoutFor can produce exists in assets/creatures/', async () => {
  const isbns = ['9780064400558', '9780399226908', '9781338099133', '9780439023528', '9780000001252', '9780000000279', '9780000000064', '9780000000101', '9780000000026', '9780000000019', '9780000000156', '9780000000088'];
  const moods = ['content', 'beaming', 'peckish', 'sleepy'];
  const missing = [];
  for (const isbn of isbns) {
    const { creature } = await generateCreature(isbn);
    for (const stage of [1, 2, 3]) {
      for (const mood of moods) {
        const look = spriteLookFor(creature, stage, mood);
        const files = [look.body.file, look.arms.file, look.legs.file, look.detail.file, look.eye.file, look.mouth.file, look.nose?.file].filter(Boolean);
        for (const file of files) if (!assetExists(file)) missing.push(file);

        const { parts } = layoutFor(look);
        assert.ok(parts.length >= 8, 'layoutFor should always place at least body+legs+arms+eye(s)+mouth');
        for (const part of parts) if (!assetExists(part.file)) missing.push(part.file);
      }
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('layoutFor mirrors legL/armL/detailL into legR/armR/detailR around the frame center', async () => {
  const { creature } = await generateCreature('9780064400558');
  const look = spriteLookFor(creature, 3, 'content'); // stage 3: legs+arms+detail all present
  const { frame, parts } = layoutFor(look);
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));

  for (const [lId, rId] of [['legL', 'legR'], ['armL', 'armR'], ['detailL', 'detailR']]) {
    const l = byId[lId];
    const r = byId[rId];
    assert.equal(l.w, r.w);
    assert.equal(l.h, r.h);
    assert.equal(l.top, r.top);
    assert.equal(r.mirror, true);
    assert.equal(l.mirror, false);
    // true bilateral symmetry: right's margin from the frame's right edge
    // equals left's margin from the frame's left edge.
    assert.equal(l.left + r.left + r.w, frame.w);
  }
});

test('pair eyes never overlap and single eyes sit centered on the frame', async () => {
  for (const isbn of ['9780064400558', '9780399226908', '9781338099133']) {
    const { creature } = await generateCreature(isbn);
    const look = spriteLookFor(creature, 3, 'content');
    const { frame, parts } = layoutFor(look);
    if (look.eye.layout === 'single') {
      const eye = parts.find((p) => p.id === 'eye');
      assert.ok(eye, 'single-layout eye should produce one "eye" part');
      assert.equal(Math.round(eye.left + eye.w / 2), Math.round(frame.w / 2));
    } else {
      const l = parts.find((p) => p.id === 'eyeL');
      const r = parts.find((p) => p.id === 'eyeR');
      assert.ok(l && r, 'pair-layout eye should produce eyeL and eyeR parts');
      assert.ok(l.left + l.w <= r.left, 'mirrored eyes should not overlap');
    }
  }
});
