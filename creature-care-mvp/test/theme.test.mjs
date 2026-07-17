import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyTheme,
  DEFAULT_THEME,
  isValidTheme,
  readTheme,
  THEME_STORAGE_KEY,
  THEMES,
  writeTheme
} from '../src/systems/theme.js';

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (Object.hasOwn(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    _store: store
  };
}

function throwingStorage() {
  return {
    getItem: () => { throw new Error('boom'); },
    setItem: () => { throw new Error('boom'); }
  };
}

// --- THEMES ---------------------------------------------------

test('THEMES has exactly 3 entries with the contract ids in order', () => {
  assert.equal(THEMES.length, 3);
  assert.deepEqual(THEMES.map((theme) => theme.id), ['nook', 'schoolhouse', 'spellbook']);
});

test('THEMES entries each carry a name and a 3-hex swatch', () => {
  for (const theme of THEMES) {
    assert.equal(typeof theme.name, 'string');
    assert.ok(theme.name.length > 0);
    assert.equal(theme.swatch.length, 3);
    for (const hex of theme.swatch) assert.match(hex, /^#[0-9a-f]{6}$/i);
  }
});

test('DEFAULT_THEME is nook and THEME_STORAGE_KEY matches the contract', () => {
  assert.equal(DEFAULT_THEME, 'nook');
  assert.equal(THEME_STORAGE_KEY, 'stacklings.theme');
});

// --- isValidTheme ---------------------------------------------------

test('isValidTheme accepts exactly the three contract ids', () => {
  assert.equal(isValidTheme('nook'), true);
  assert.equal(isValidTheme('schoolhouse'), true);
  assert.equal(isValidTheme('spellbook'), true);
});

test('isValidTheme rejects junk, empty, and non-string values', () => {
  assert.equal(isValidTheme('nonsense'), false);
  assert.equal(isValidTheme(''), false);
  assert.equal(isValidTheme(null), false);
  assert.equal(isValidTheme(undefined), false);
  assert.equal(isValidTheme(42), false);
  assert.equal(isValidTheme({}), false);
  assert.equal(isValidTheme(['nook']), false);
});

// --- readTheme ---------------------------------------------------

test('readTheme returns the stored id when it is valid', () => {
  const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'schoolhouse' });
  assert.equal(readTheme(storage), 'schoolhouse');
});

test('readTheme returns the default when storage has nothing stored', () => {
  const storage = fakeStorage();
  assert.equal(readTheme(storage), DEFAULT_THEME);
});

test('readTheme returns the default when the stored value is garbage', () => {
  const storage = fakeStorage({ [THEME_STORAGE_KEY]: 'not-a-real-theme' });
  assert.equal(readTheme(storage), DEFAULT_THEME);
});

test('readTheme never throws, even for null or throwing storage', () => {
  assert.equal(readTheme(null), DEFAULT_THEME);
  assert.equal(readTheme(undefined), DEFAULT_THEME);
  assert.equal(readTheme(throwingStorage()), DEFAULT_THEME);
});

// --- writeTheme ---------------------------------------------------

test('writeTheme persists a valid id and returns it', () => {
  const storage = fakeStorage();
  const applied = writeTheme(storage, 'spellbook');
  assert.equal(applied, 'spellbook');
  assert.equal(storage.getItem(THEME_STORAGE_KEY), 'spellbook');
});

test('writeTheme ignores an invalid id, does not persist it, and returns the default', () => {
  const storage = fakeStorage();
  const applied = writeTheme(storage, 'nonsense');
  assert.equal(applied, DEFAULT_THEME);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), DEFAULT_THEME);
});

test('writeTheme never throws for null or throwing storage', () => {
  assert.equal(writeTheme(null, 'nook'), 'nook');
  assert.equal(writeTheme(undefined, 'schoolhouse'), 'schoolhouse');
  assert.equal(writeTheme(throwingStorage(), 'spellbook'), 'spellbook');
  assert.equal(writeTheme(throwingStorage(), 'nonsense'), DEFAULT_THEME);
});

// --- applyTheme ---------------------------------------------------

test('applyTheme sets dataset.theme to a valid id and returns it', () => {
  const root = { dataset: {} };
  const applied = applyTheme(root, 'schoolhouse');
  assert.equal(applied, 'schoolhouse');
  assert.equal(root.dataset.theme, 'schoolhouse');
});

test('applyTheme falls back to the default for a junk id', () => {
  const root = { dataset: {} };
  const applied = applyTheme(root, 'nonsense');
  assert.equal(applied, DEFAULT_THEME);
  assert.equal(root.dataset.theme, DEFAULT_THEME);
});

test('applyTheme guards against a null or undefined root without throwing', () => {
  assert.equal(applyTheme(null, 'nook'), 'nook');
  assert.equal(applyTheme(undefined, 'spellbook'), 'spellbook');
});
