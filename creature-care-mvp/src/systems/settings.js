// Pure settings & evidence helpers: research-content validation, provider-status
// classification, and account-explanation helpers. No DOM, storage, clock,
// crypto, or network access.

import {
  AccountStatuses,
  LibraryStatuses,
  isPlayerAccess
} from '../contracts.js';
import content from '../content.json' with { type: 'json' };

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasString = (value, key) => isObject(value) && typeof value[key] === 'string' && value[key].length > 0;

// A sentence containing one of these words is a hedge/caveat/negation, not an
// overclaim — e.g. "They don't prove the creature design is best" or "no
// universal minute requirement". Overclaim regexes are only applied to
// sentences that do NOT contain one of these words.
const NEGATION_RE = /\b(don't|do not|doesn't|does not|didn't|did not|isn't|is not|aren't|are not|wasn't|was not|weren't|were not|cannot|can't|never|not|no|limitations?|caution(?:s|ed)?)\b/i;

const OVERCLAIM_RES = [
  /\bprov(?:e|es|en|ing)\b[^.!?]*\b(creature|design|optimal|best|ideal|20[- ]?day)\b/i,
  /\b(?:validate|validates|validated|confirm|confirms|confirmed|show|shows|shown)\b[^.!?]*\b(creature|design|optimal|best|ideal|20[- ]?day|threshold)\b/i,
  /\b(optimal|best|ideal|proven|validated)\b[^.!?]*\b(20[- ]?day|threshold|goal|design|creature)\b/i,
  /research (?:proves|validates|shows .* is best)/i
];

function isValidSourceUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidResearchEntry(entry) {
  return isObject(entry)
    && hasString(entry, 'id')
    && hasString(entry, 'title')
    && hasString(entry, 'summary')
    && hasString(entry, 'sourceLabel')
    && isValidSourceUrl(entry.sourceUrl)
    && hasString(entry, 'lastReviewedAt');
}

function overclaimTextsFrom(research) {
  if (!isObject(research)) return [];
  const texts = [];
  if (typeof research.disclaimer === 'string') texts.push(research.disclaimer);
  if (Array.isArray(research.entries)) {
    for (const entry of research.entries) {
      if (isObject(entry) && typeof entry.summary === 'string') texts.push(entry.summary);
    }
  }
  return texts;
}

export function hasResearchOverclaim(research) {
  try {
    for (const text of overclaimTextsFrom(research)) {
      // Split into sentences, then into CLAUSES (on commas/semicolons/colons/dashes).
      // The negation-skip is clause-local so a hedge in one clause ("Despite caution,")
      // can't shield an overclaim in another ("research proves 20 days is optimal").
      const sentences = text.split(/[.!?]/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
      for (const sentence of sentences) {
        // Split on clause separators only (comma/semicolon/colon/em- or en-dash) — NOT the
        // plain hyphen, which joins words like "20-day" that the overclaim regexes depend on.
        const clauses = sentence.split(/[,;:—–]+|\s-\s/).map((clause) => clause.trim()).filter((clause) => clause.length > 0);
        for (const clause of clauses) {
          if (NEGATION_RE.test(clause)) continue;
          if (OVERCLAIM_RES.some((re) => re.test(clause))) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function validateResearchContent(research = content.research) {
  try {
    if (!isObject(research)) return false;
    if (!Number.isFinite(research.version)) return false;
    if (!hasString(research, 'disclaimer')) return false;
    if (!Array.isArray(research.entries) || research.entries.length !== 7) return false;
    if (!research.entries.every(isValidResearchEntry)) return false;
    const ids = research.entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) return false;
    if (hasResearchOverclaim(research)) return false;
    return true;
  } catch {
    return false;
  }
}

export function researchSection(enabled, research = content.research) {
  if (enabled !== true || !validateResearchContent(research)) {
    return { enabled: false, disclaimer: null, entries: [] };
  }
  return { enabled: true, disclaimer: research.disclaimer, entries: structuredClone(research.entries) };
}

export function classifyProviderHealth(health) {
  try {
    if (!isObject(health)) return { available: false, sample: false };
    if (typeof health.ok === 'boolean' && typeof health.storageKind === 'string') {
      return { available: health.ok === true, sample: health.storageKind === 'synchronized_fixture' };
    }
    if (typeof health.source === 'string') {
      const available = health.source !== 'unavailable' && health.data?.status !== 'unavailable';
      return { available, sample: health.source === 'fixture' };
    }
    return { available: false, sample: false };
  } catch {
    return { available: false, sample: false };
  }
}

export function accountExplanation(playerAccess) {
  try {
    if (!isPlayerAccess(playerAccess)) {
      return { accountStatus: AccountStatuses.Guest, libraryStatus: LibraryStatuses.Disconnected, guestOnlyThisBrowser: true };
    }
    return {
      accountStatus: playerAccess.accountStatus,
      libraryStatus: playerAccess.libraryStatus,
      guestOnlyThisBrowser: playerAccess.accountStatus === AccountStatuses.Guest
    };
  } catch {
    return { accountStatus: AccountStatuses.Guest, libraryStatus: LibraryStatuses.Disconnected, guestOnlyThisBrowser: true };
  }
}
