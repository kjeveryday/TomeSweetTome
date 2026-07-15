// Package 7 integration: exercises the public storage export/delete surface and the
// settings module helpers the way src/app.js's settings handlers do. app.js itself
// isn't importable under node:test (it touches document/window at load), so the
// export-validity, scoped-delete/recovery, provider-status, and research-gating
// behaviours are proven here against the real LocalStorageAdapter + settings module.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LocalStorageAdapter } from '../src/systems/storage.js';
import { isCurrentEnvelope, CURRENT_SAVE_KEY, LEGACY_SAVE_KEY } from '../src/systems/migration.js';
import { FixtureRecommendationProvider } from '../src/systems/recommendations.js';
import {
  accountExplanation,
  classifyProviderHealth,
  hasResearchOverclaim,
  researchSection,
  validateResearchContent
} from '../src/systems/settings.js';
import { createFakeStorage, content } from './helpers.mjs';

test('export returns a valid, parseable current save envelope', () => {
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  adapter.load(1000); // seed a fresh envelope
  const exported = adapter.export(1000);
  assert.equal(typeof exported, 'string');
  const parsed = JSON.parse(exported);
  assert.equal(isCurrentEnvelope(parsed), true, 'exported data is a valid current envelope');
  assert.equal(parsed.schemaVersion, 2);
});

test('scoped delete removes ONLY this app\'s saves and leaves unrelated browser data untouched, then recovers fresh', () => {
  const storage = createFakeStorage();
  // Unrelated browser data that a delete must never touch.
  storage.setItem('some.other.site/token', 'keep-me');
  storage.setItem('theme-preference', 'dark');

  const adapter = new LocalStorageAdapter(storage);
  adapter.load(1000);
  adapter.save(adapter.load(1000), 1000); // ensure the current save key exists
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ state: {}, lastSeen: 1 })); // a stale legacy save
  assert.notEqual(storage.getItem(CURRENT_SAVE_KEY), null);

  const result = adapter.delete();
  assert.deepEqual(result, { ok: true });
  // App saves gone...
  assert.equal(storage.getItem(CURRENT_SAVE_KEY), null, 'current save removed');
  assert.equal(storage.getItem(LEGACY_SAVE_KEY), null, 'legacy save removed');
  // ...unrelated data preserved.
  assert.equal(storage.getItem('some.other.site/token'), 'keep-me');
  assert.equal(storage.getItem('theme-preference'), 'dark');

  // Recovery: a reload boots a fresh guest envelope with no books/creatures/reading.
  const reopened = new LocalStorageAdapter(storage).load(2000);
  assert.equal(isCurrentEnvelope(reopened), true);
  assert.deepEqual(Object.keys(reopened.state.books.works), []);
  assert.deepEqual(Object.keys(reopened.state.collection.creatures), []);
  assert.equal(reopened.state.reading.challenge.registeredAt, null);
});

test('provider status classifies the real storage adapter as available local (not sample)', () => {
  const storage = createFakeStorage();
  const adapter = new LocalStorageAdapter(storage);
  const status = classifyProviderHealth(adapter.healthCheck());
  assert.deepEqual(status, { available: true, sample: false }, 'local storage is a real (non-sample) store');
});

test('provider status marks the fixture recommendation provider as sample data (never presented as live)', () => {
  const provider = new FixtureRecommendationProvider();
  const status = classifyProviderHealth(provider.healthCheck(0));
  assert.equal(status.available, true);
  assert.equal(status.sample, true, 'fixture provider must be flagged sample so the UI never shows it as live');
});

test('research section is hidden when the flag is off and shows the approved 7 entries when on', () => {
  assert.deepEqual(researchSection(false, content.research), { enabled: false, disclaimer: null, entries: [] });

  const on = researchSection(true, content.research);
  assert.equal(on.enabled, true);
  assert.equal(on.entries.length, 7);
  assert.ok(on.disclaimer && on.disclaimer.length > 0);
  for (const entry of on.entries) {
    for (const field of ['id', 'title', 'summary', 'sourceLabel', 'sourceUrl', 'lastReviewedAt']) {
      assert.ok(entry[field] && String(entry[field]).length > 0, `entry ${entry.id} has ${field}`);
    }
    assert.match(entry.sourceUrl, /^https?:\/\//, 'source link is an http(s) URL');
  }
});

test('the approved research content is structurally valid and does not overclaim', () => {
  assert.equal(validateResearchContent(content.research), true, 'approved content passes validation (incl. no-overclaim guard)');
});

test('the overclaim guard is clause-local — a hedge word cannot shield an overclaim in another clause', () => {
  // A future content edit that mixes a caveat clause with an overclaim clause must still
  // be caught (the guard is validateResearchContent's only overclaim gate).
  assert.equal(hasResearchOverclaim({
    disclaimer: 'ok.',
    entries: [{ summary: 'Despite caution from some critics, research proves the 20-day goal is optimal.' }]
  }), true, 'hedge in clause 1 must not shield the overclaim in clause 2');
  assert.equal(hasResearchOverclaim({
    disclaimer: 'This is not a minor point: research proves the design is best for every reader.',
    entries: []
  }), true, 'overclaim after a colon is caught');
  // Genuine hedges are still not flagged (no false positive), incl. the approved content.
  assert.equal(hasResearchOverclaim({ disclaimer: "They don't prove the creature design is best.", entries: [] }), false);
  assert.equal(hasResearchOverclaim(content.research), false, 'approved content is not a false positive');
  // And a content set carrying such an overclaim fails validation outright.
  const bad = structuredClone(content.research);
  bad.entries[0].summary = 'Despite the limitations, studies confirm the 20-day threshold is optimal.';
  assert.equal(validateResearchContent(bad), false, 'overclaiming content is rejected by validateResearchContent');
});

test('account explanation flags a guest save as recoverable only on this browser', () => {
  const guest = accountExplanation({ accountStatus: 'guest', libraryStatus: 'disconnected' });
  assert.equal(guest.guestOnlyThisBrowser, true);
  const signedIn = accountExplanation({ accountStatus: 'signed_in', libraryStatus: 'connected' });
  assert.equal(signedIn.guestOnlyThisBrowser, false);
});
