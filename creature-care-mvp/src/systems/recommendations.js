// Pure fixture recommendation provider and recommendations-slice helpers. No
// DOM, storage, clock, crypto, or network access; the only inputs are recent
// broad book categories (genres/subjects) plus an optional branchId — never
// reading ability, identity, names, or ISBNs.

import {
  ProviderSources,
  RecommendationProvider,
  isRecommendationResult,
  providerResponse
} from '../providers.js';
import content from '../content.json' with { type: 'json' };

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const isStringArray = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const isUniqueStringArray = (value) => isStringArray(value) && new Set(value).size === value.length;

function categoriesFromBook(book) {
  if (!isObject(book)) return [];
  const genres = Array.isArray(book.genres) ? book.genres : [];
  const subjects = Array.isArray(book.subjects) ? book.subjects : [];
  return [...genres, ...subjects];
}

export function recentBroadCategories(state, limit = content.recommendations.recentCategoryLimit) {
  if (!isObject(state) || !isObject(state.reading) || !isObject(state.reading.records)) return [];
  if (!isObject(state.collection) || !isObject(state.collection.creatures)) return [];

  const cap = Number.isInteger(limit) && limit > 0 ? limit : content.recommendations.recentCategoryLimit;

  const records = Object.values(state.reading.records)
    .filter((record) => isObject(record)
      && isNonEmptyString(record.workId)
      && isNonEmptyString(record.occurredAt)
      && Number.isFinite(Date.parse(record.occurredAt)));

  const sorted = [...records].sort((left, right) => {
    const byTime = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (byTime !== 0) return byTime;
    const leftId = typeof left.id === 'string' ? left.id : '';
    const rightId = typeof right.id === 'string' ? right.id : '';
    return leftId.localeCompare(rightId);
  });

  const creatures = Object.values(state.collection.creatures);
  const categories = [];
  for (const record of sorted) {
    const creature = creatures.find((candidate) => isObject(candidate)
      && candidate.workId === record.workId
      && candidate.revealed === true);
    if (!creature) continue;
    for (const raw of categoriesFromBook(creature.baseTraits?.book)) {
      if (typeof raw !== 'string') continue;
      const category = raw.trim().toLowerCase();
      if (category.length === 0) continue;
      if (!categories.includes(category)) categories.push(category);
    }
  }

  return categories.slice(0, cap);
}

export function buildRecommendationInput(state, { requestId, branchId } = {}) {
  if (!isNonEmptyString(requestId)) return { ok: false, reason: 'invalidRequestId' };
  return {
    ok: true,
    input: {
      requestId,
      categoryIds: recentBroadCategories(state),
      ...(typeof branchId === 'string' && branchId.length ? { branchId } : {})
    }
  };
}

function isValidRecommendInput(value) {
  return isObject(value) && isNonEmptyString(value.requestId) && isStringArray(value.categoryIds);
}

function isUsableEntry(entry) {
  return isObject(entry)
    && isNonEmptyString(entry.reason)
    && Array.isArray(entry.books)
    && entry.books.length > 0
    && entry.books.every((book) => isObject(book) && isNonEmptyString(book.workId) && isNonEmptyString(book.editionId));
}

function selectEntryId(categoryIds, categoryMap, generalId) {
  if (isObject(categoryMap)) {
    for (const category of categoryIds) {
      if (typeof category !== 'string') continue;
      const lowered = category.toLowerCase();
      for (const keyword of Object.keys(categoryMap)) {
        if (lowered.includes(keyword)) return categoryMap[keyword];
      }
    }
  }
  return generalId;
}

export class FixtureRecommendationProvider extends RecommendationProvider {
  constructor(recommendationsContent = content.recommendations, providerId = 'recommendations:fixture') {
    super();
    this.content = structuredClone(recommendationsContent);
    this.providerId = providerId;
  }

  recommend(input, now = 0) {
    if (!isValidRecommendInput(input)) throw new TypeError('Invalid recommendation input');

    const requestId = input.requestId;
    const cfg = this.content;
    const entryId = isObject(cfg) ? selectEntryId(input.categoryIds, cfg.categoryMap, cfg.generalId) : undefined;
    const entry = isObject(cfg) && isNonEmptyString(entryId) ? cfg.entries?.[entryId] : undefined;

    if (!isUsableEntry(entry)) {
      return providerResponse({
        source: ProviderSources.Unavailable,
        providerId: this.providerId,
        fetchedAt: now,
        data: { requestId, recommendations: [] }
      });
    }

    const recommendation = {
      id: entryId,
      reason: entry.reason,
      workIds: entry.books.map((book) => book.workId),
      editionIds: entry.books.map((book) => book.editionId)
    };

    return providerResponse({
      source: ProviderSources.Fixture,
      providerId: this.providerId,
      fetchedAt: now,
      data: { requestId, recommendations: [recommendation] }
    });
  }

  healthCheck(now = 0) {
    return providerResponse({
      source: ProviderSources.Fixture,
      providerId: this.providerId,
      fetchedAt: now,
      data: { status: 'available' }
    });
  }
}

export function deliveredFromResult(result) {
  if (!isRecommendationResult(result) || result.data.recommendations.length === 0) {
    return { ok: false, reason: 'noRecommendation' };
  }
  const [recommendation] = result.data.recommendations;
  return {
    ok: true,
    delivered: {
      requestId: result.data.requestId,
      recommendationId: recommendation.id,
      source: result.source,
      workIds: [...recommendation.workIds],
      editionIds: [...recommendation.editionIds]
    }
  };
}

export function applyRequest(recommendations, { requestId, categoryIds, branchId } = {}) {
  if (!isObject(recommendations) || !isNonEmptyString(requestId) || !isStringArray(categoryIds)) {
    return structuredClone(recommendations);
  }
  return {
    ...structuredClone(recommendations),
    requests: {
      ...(isObject(recommendations.requests) ? structuredClone(recommendations.requests) : {}),
      [requestId]: {
        categoryIds: [...categoryIds],
        ...(typeof branchId === 'string' && branchId.length ? { branchId } : {})
      }
    }
  };
}

export function applyDelivery(recommendations, { requestId, recommendationId, source, workIds, editionIds } = {}) {
  if (!isObject(recommendations)
    || !isNonEmptyString(requestId)
    || !isNonEmptyString(recommendationId)
    || !isNonEmptyString(source)
    || !isStringArray(workIds)
    || !isStringArray(editionIds)) {
    return structuredClone(recommendations);
  }
  return {
    ...structuredClone(recommendations),
    results: {
      ...(isObject(recommendations.results) ? structuredClone(recommendations.results) : {}),
      [requestId]: { recommendationId, source, workIds: [...workIds], editionIds: [...editionIds] }
    }
  };
}

export function applySave(recommendations, recommendationId) {
  if (!isObject(recommendations) || !isNonEmptyString(recommendationId)) return structuredClone(recommendations);
  const savedIds = Array.isArray(recommendations.savedIds) ? recommendations.savedIds : [];
  const dismissedIds = Array.isArray(recommendations.dismissedIds) ? recommendations.dismissedIds : [];
  return {
    ...structuredClone(recommendations),
    savedIds: [...new Set([...savedIds, recommendationId])],
    dismissedIds: dismissedIds.filter((id) => id !== recommendationId)
  };
}

export function applyDismiss(recommendations, recommendationId) {
  if (!isObject(recommendations) || !isNonEmptyString(recommendationId)) return structuredClone(recommendations);
  const savedIds = Array.isArray(recommendations.savedIds) ? recommendations.savedIds : [];
  const dismissedIds = Array.isArray(recommendations.dismissedIds) ? recommendations.dismissedIds : [];
  return {
    ...structuredClone(recommendations),
    dismissedIds: [...new Set([...dismissedIds, recommendationId])],
    savedIds: savedIds.filter((id) => id !== recommendationId)
  };
}

export function applyReset(_recommendations) {
  return { requests: {}, results: {}, savedIds: [], dismissedIds: [] };
}

export function validateRecommendationsState(value) {
  return isObject(value)
    && isObject(value.requests)
    && isObject(value.results)
    && isUniqueStringArray(value.savedIds)
    && isUniqueStringArray(value.dismissedIds);
}
