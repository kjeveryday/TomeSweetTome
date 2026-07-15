import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountExplanation,
  classifyProviderHealth,
  hasResearchOverclaim,
  researchSection,
  validateResearchContent
} from '../src/systems/settings.js';
import content from '../src/content.json' with { type: 'json' };

function withEntry(research, index, patch) {
  return {
    ...research,
    entries: research.entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
  };
}

// --- validateResearchContent ---------------------------------------------------

test('validateResearchContent accepts the real approved research content', () => {
  assert.equal(validateResearchContent(content.research), true);
  assert.equal(validateResearchContent(), true);
});

test('validateResearchContent rejects a wrong entry count (6 or 8)', () => {
  const six = { ...content.research, entries: content.research.entries.slice(0, 6) };
  const eight = { ...content.research, entries: [...content.research.entries, content.research.entries[0]] };
  assert.equal(validateResearchContent(six), false);
  assert.equal(validateResearchContent(eight), false);
});

test('validateResearchContent rejects an entry missing a required field', () => {
  const missingTitle = withEntry(content.research, 0, { title: undefined });
  const missingSummary = withEntry(content.research, 2, { summary: '' });
  const missingSourceLabel = withEntry(content.research, 3, { sourceLabel: undefined });
  const missingLastReviewedAt = withEntry(content.research, 4, { lastReviewedAt: '' });
  assert.equal(validateResearchContent(missingTitle), false);
  assert.equal(validateResearchContent(missingSummary), false);
  assert.equal(validateResearchContent(missingSourceLabel), false);
  assert.equal(validateResearchContent(missingLastReviewedAt), false);
});

test('validateResearchContent rejects a non-http(s) sourceUrl', () => {
  const javascriptUrl = withEntry(content.research, 0, { sourceUrl: 'javascript:alert(1)' });
  const ftpUrl = withEntry(content.research, 0, { sourceUrl: 'ftp://example.com/paper' });
  const bareString = withEntry(content.research, 0, { sourceUrl: 'not a url' });
  assert.equal(validateResearchContent(javascriptUrl), false);
  assert.equal(validateResearchContent(ftpUrl), false);
  assert.equal(validateResearchContent(bareString), false);
});

test('validateResearchContent rejects duplicate entry ids', () => {
  const duplicated = withEntry(content.research, 1, { id: content.research.entries[0].id });
  assert.equal(validateResearchContent(duplicated), false);
});

test('validateResearchContent rejects a missing or empty disclaimer', () => {
  assert.equal(validateResearchContent({ ...content.research, disclaimer: '' }), false);
  assert.equal(validateResearchContent({ ...content.research, disclaimer: undefined }), false);
});

test('validateResearchContent rejects malformed shapes without throwing', () => {
  assert.equal(validateResearchContent(null), false);
  assert.equal(validateResearchContent('nope'), false);
  assert.equal(validateResearchContent({}), false);
  assert.equal(validateResearchContent({ ...content.research, version: 'one' }), false);
  assert.equal(validateResearchContent({ ...content.research, entries: 'nope' }), false);
});

// --- hasResearchOverclaim ---------------------------------------------------

test('hasResearchOverclaim is false for the real approved content (does not overclaim)', () => {
  assert.equal(hasResearchOverclaim(content.research), false);
});

test('hasResearchOverclaim is true for a crafted overclaiming entry summary', () => {
  const overclaiming = withEntry(content.research, 0, {
    summary: 'Research proves the creature design is optimal.'
  });
  assert.equal(hasResearchOverclaim(overclaiming), true);
  assert.equal(validateResearchContent(overclaiming), false);
});

test('hasResearchOverclaim is true for a crafted overclaiming disclaimer', () => {
  const overclaiming = { ...content.research, disclaimer: 'Studies validate that 20 days is the best goal.' };
  assert.equal(hasResearchOverclaim(overclaiming), true);
  assert.equal(validateResearchContent(overclaiming), false);
});

test('hasResearchOverclaim never throws on malformed input', () => {
  assert.equal(hasResearchOverclaim(null), false);
  assert.equal(hasResearchOverclaim(undefined), false);
  assert.equal(hasResearchOverclaim('nope'), false);
  assert.equal(hasResearchOverclaim({}), false);
  assert.equal(hasResearchOverclaim({ disclaimer: 42, entries: 'nope' }), false);
});

// --- researchSection ---------------------------------------------------

test('researchSection(true, ...) returns the enabled display model as a clone of the real content', () => {
  const section = researchSection(true, content.research);
  assert.equal(section.enabled, true);
  assert.equal(section.disclaimer, content.research.disclaimer);
  assert.equal(section.entries.length, 7);
  assert.deepEqual(section.entries, content.research.entries);

  section.entries[0].title = 'mutated';
  assert.notEqual(content.research.entries[0].title, 'mutated');
});

test('researchSection defaults to the real content.research when not passed explicitly', () => {
  assert.deepEqual(researchSection(true), {
    enabled: true,
    disclaimer: content.research.disclaimer,
    entries: content.research.entries
  });
});

test('researchSection(false, ...) hides the section regardless of content validity', () => {
  assert.deepEqual(researchSection(false, content.research), { enabled: false, disclaimer: null, entries: [] });
  assert.deepEqual(researchSection(undefined, content.research), { enabled: false, disclaimer: null, entries: [] });
  assert.deepEqual(researchSection(null, content.research), { enabled: false, disclaimer: null, entries: [] });
});

test('researchSection(true, <invalid content>) hides the section without throwing', () => {
  const invalid = { ...content.research, entries: content.research.entries.slice(0, 6) };
  assert.deepEqual(researchSection(true, invalid), { enabled: false, disclaimer: null, entries: [] });
  assert.deepEqual(researchSection(true, null), { enabled: false, disclaimer: null, entries: [] });
});

// --- classifyProviderHealth ---------------------------------------------------

test('classifyProviderHealth classifies storage health shapes', () => {
  assert.deepEqual(classifyProviderHealth({ ok: true, storageKind: 'local' }), { available: true, sample: false });
  assert.deepEqual(
    classifyProviderHealth({ ok: true, storageKind: 'synchronized_fixture' }),
    { available: true, sample: true }
  );
  assert.deepEqual(classifyProviderHealth({ ok: false, storageKind: 'local' }), { available: false, sample: false });
});

test('classifyProviderHealth classifies content-provider response shapes', () => {
  assert.deepEqual(
    classifyProviderHealth({ source: 'fixture', data: { status: 'available' } }),
    { available: true, sample: true }
  );
  assert.deepEqual(
    classifyProviderHealth({ source: 'live', data: { status: 'available' } }),
    { available: true, sample: false }
  );
  assert.deepEqual(
    classifyProviderHealth({ source: 'unavailable', data: null }),
    { available: false, sample: false }
  );
  assert.deepEqual(
    classifyProviderHealth({ source: 'live', data: { status: 'unavailable' } }),
    { available: false, sample: false }
  );
});

test('classifyProviderHealth never mislabels fixture data as live', () => {
  const classified = classifyProviderHealth({ source: 'fixture', data: { status: 'available' } });
  assert.equal(classified.sample, true);
});

test('classifyProviderHealth returns available:false, sample:false for garbage/undefined without throwing', () => {
  assert.deepEqual(classifyProviderHealth(undefined), { available: false, sample: false });
  assert.deepEqual(classifyProviderHealth(null), { available: false, sample: false });
  assert.deepEqual(classifyProviderHealth('nope'), { available: false, sample: false });
  assert.deepEqual(classifyProviderHealth({}), { available: false, sample: false });
  assert.deepEqual(classifyProviderHealth(42), { available: false, sample: false });
});

// --- accountExplanation ---------------------------------------------------

test('accountExplanation marks a guest account as recoverable only on this browser', () => {
  assert.deepEqual(accountExplanation({ accountStatus: 'guest', libraryStatus: 'disconnected' }), {
    accountStatus: 'guest',
    libraryStatus: 'disconnected',
    guestOnlyThisBrowser: true
  });
});

test('accountExplanation marks a signed-in, connected account as not browser-locked', () => {
  assert.deepEqual(accountExplanation({ accountStatus: 'signed_in', libraryStatus: 'connected' }), {
    accountStatus: 'signed_in',
    libraryStatus: 'connected',
    guestOnlyThisBrowser: false
  });
});

test('accountExplanation defaults to a safe guest shape for invalid input, never throwing', () => {
  const safeGuest = { accountStatus: 'guest', libraryStatus: 'disconnected', guestOnlyThisBrowser: true };
  assert.deepEqual(accountExplanation(null), safeGuest);
  assert.deepEqual(accountExplanation(undefined), safeGuest);
  assert.deepEqual(accountExplanation({}), safeGuest);
  assert.deepEqual(accountExplanation('nope'), safeGuest);
  assert.deepEqual(accountExplanation({ accountStatus: 'guest', libraryStatus: 'connected' }), safeGuest);
  assert.deepEqual(accountExplanation({ accountStatus: 'unknown', libraryStatus: 'disconnected' }), safeGuest);
});
