// Feature flags are frozen shared contracts. The safe foundation keeps every
// optional module disabled until its Phase 1 package passes integration tests.

export const FEATURE_FLAG_NAMES = Object.freeze([
  'timer',
  'accounts',
  'careItems',
  'recommendationVisitors',
  'libraryCatalog',
  'libraryPatronActions',
  'communityEvents',
  'researchSettings'
]);

export const DEFAULT_FEATURE_FLAGS = Object.freeze(
  Object.fromEntries(FEATURE_FLAG_NAMES.map((name) => [name, false]))
);

export function resolveFeatureFlags(overrides = {}) {
  const resolved = { ...DEFAULT_FEATURE_FLAGS };
  for (const name of FEATURE_FLAG_NAMES) {
    if (Object.hasOwn(overrides, name)) resolved[name] = overrides[name] === true;
  }
  return resolved;
}

export function isFeatureFlagSet(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === FEATURE_FLAG_NAMES.length
    && FEATURE_FLAG_NAMES.every((name) => typeof value[name] === 'boolean');
}
