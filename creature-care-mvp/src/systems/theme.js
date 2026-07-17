// Runtime theme selection. Device-local UI preference only — never routed through
// the event-sourced game state/reducer or the storage adapters. This module is the
// single source of truth for theme metadata; the CSS reacts to data-theme on <html>.

export const THEMES = Object.freeze([
  Object.freeze({ id: 'nook', name: 'Candlewick Nook', swatch: Object.freeze(['#191210', '#f0b13d', '#f6ead6']) }),
  Object.freeze({ id: 'schoolhouse', name: 'Chalk & Moss Schoolhouse', swatch: Object.freeze(['#142019', '#ecc25f', '#a7e8b8']) }),
  Object.freeze({ id: 'spellbook', name: 'Moonlit Spellbook', swatch: Object.freeze(['#12141d', '#9ff2c8', '#c9b3f5']) })
]);

export const DEFAULT_THEME = 'nook';

export const THEME_STORAGE_KEY = 'stacklings.theme';

const THEME_IDS = THEMES.map((theme) => theme.id);

export function isValidTheme(id) {
  return typeof id === 'string' && THEME_IDS.includes(id);
}

export function readTheme(storage) {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(storage, id) {
  const applied = isValidTheme(id) ? id : DEFAULT_THEME;
  try {
    storage?.setItem(THEME_STORAGE_KEY, applied);
  } catch {
    /* best effort — persistence is a nicety, not a requirement */
  }
  return applied;
}

export function applyTheme(rootEl, id) {
  const applied = isValidTheme(id) ? id : DEFAULT_THEME;
  if (rootEl && rootEl.dataset) rootEl.dataset.theme = applied;
  return applied;
}
