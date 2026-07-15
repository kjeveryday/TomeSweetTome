// Pure treat care-item system. No DOM, storage, clock, or network access.

import content from '../content.json' with { type: 'json' };

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

function findTreatById(treatId, treats) {
  const treat = treats.find((t) => t.id === treatId);
  return treat ? structuredClone(treat) : null;
}

export function selectTreat(categories, content_careItems = content.careItems) {
  if (!Array.isArray(categories)) categories = [];
  if (!isObject(content_careItems)) return null;

  const categoryMap = content_careItems.categoryMap || {};
  const treats = content_careItems.treats || [];

  // Lowercase all input categories for case-insensitive matching
  const lowerCats = categories.map((cat) => (typeof cat === 'string' ? cat.toLowerCase() : ''));

  // Check each keyword in the categoryMap (in Object.keys order for determinism)
  for (const keyword of Object.keys(categoryMap)) {
    const lowerKeyword = keyword.toLowerCase();
    if (lowerCats.some((cat) => cat.includes(lowerKeyword))) {
      const treatId = categoryMap[keyword];
      const treat = findTreatById(treatId, treats);
      if (treat) return treat;
    }
  }

  // Fall back to default treat
  const defaultId = content_careItems.defaultTreatId;
  return findTreatById(defaultId, treats);
}

export function applyGrant(careItems, grant = {}) {
  if (!isObject(careItems)) return { ok: false, reason: 'invalidCareItems' };
  if (!isNonEmptyString(grant.grantId)) return { ok: false, reason: 'invalidGrantId' };
  if (!isNonEmptyString(grant.itemId)) return { ok: false, reason: 'invalidItemId' };
  if (!isNonEmptyString(grant.localDayKey)) return { ok: false, reason: 'invalidLocalDayKey' };
  if (!isNonEmptyString(grant.sourceReadingRecordId)) {
    return { ok: false, reason: 'invalidSourceReadingRecordId' };
  }

  // Check idempotency: if this grantId already exists, return unchanged
  const inventory = careItems.inventory || [];
  if (inventory.some((item) => item.grantId === grant.grantId)) {
    return { ok: true, changed: false, careItems: structuredClone(careItems) };
  }

  // Create new inventory item
  const newItem = {
    id: `item:${grant.grantId}`,
    itemId: grant.itemId,
    grantId: grant.grantId,
    sourceReadingRecordId: grant.sourceReadingRecordId,
    localDayKey: grant.localDayKey,
    remaining: 1
  };

  // Clone and append
  const newInventory = [...structuredClone(careItems.inventory || []), newItem];

  // Add localDayKey to grantDayKeys if not already present (dedup)
  let grantDayKeys = structuredClone(careItems.grantDayKeys || []);
  if (!grantDayKeys.includes(grant.localDayKey)) {
    grantDayKeys = [...grantDayKeys, grant.localDayKey];
  }

  return {
    ok: true,
    changed: true,
    careItems: {
      inventory: newInventory,
      grantDayKeys
    }
  };
}

export function applyUse(careItems, inventoryItemId) {
  if (typeof inventoryItemId !== 'string' || inventoryItemId.length === 0) {
    return { ok: false, reason: 'invalidInventoryItemId' };
  }
  if (!isObject(careItems)) return { ok: false, reason: 'invalidCareItems' };

  const inventory = careItems.inventory || [];
  const itemIndex = inventory.findIndex((item) => item.id === inventoryItemId && item.remaining > 0);

  if (itemIndex === -1) {
    return { ok: false, reason: 'noTreatAvailable' };
  }

  const item = inventory[itemIndex];
  const newInventory = structuredClone(inventory);
  newInventory[itemIndex] = { ...newInventory[itemIndex], remaining: newInventory[itemIndex].remaining - 1 };

  return {
    ok: true,
    changed: true,
    itemId: item.itemId,
    careItems: {
      inventory: newInventory,
      grantDayKeys: structuredClone(careItems.grantDayKeys || [])
    }
  };
}

export function availableTreats(careItems) {
  try {
    if (!isObject(careItems) || !Array.isArray(careItems.inventory)) return [];
    return careItems.inventory
      .filter((item) => item.remaining > 0)
      .map((item) => structuredClone(item));
  } catch {
    return [];
  }
}

export function isValidCareItemsState(careItems) {
  try {
    if (!isObject(careItems)) return false;
    if (!Array.isArray(careItems.inventory)) return false;
    if (!Array.isArray(careItems.grantDayKeys)) return false;

    // Validate each inventory item
    for (const item of careItems.inventory) {
      if (!isObject(item)) return false;
      if (!isNonEmptyString(item.id)) return false;
      if (!isNonEmptyString(item.itemId)) return false;
      if (!isNonEmptyString(item.grantId)) return false;
      if (!isNonEmptyString(item.sourceReadingRecordId)) return false;
      if (typeof item.localDayKey !== 'string') return false;
      if (!Number.isInteger(item.remaining) || item.remaining < 0) return false;
    }

    // Validate grantDayKeys are unique
    if (new Set(careItems.grantDayKeys).size !== careItems.grantDayKeys.length) return false;
    if (!careItems.grantDayKeys.every((key) => typeof key === 'string')) return false;

    return true;
  } catch {
    return false;
  }
}
