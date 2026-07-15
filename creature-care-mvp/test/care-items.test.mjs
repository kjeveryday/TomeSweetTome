import test from 'node:test';
import assert from 'node:assert/strict';

import {
  selectTreat,
  applyGrant,
  applyUse,
  availableTreats,
  isValidCareItemsState
} from '../src/systems/care-items.js';

const emptyState = () => ({
  inventory: [],
  grantDayKeys: []
});

const testContent = {
  treats: [
    { id: 'acorn', icon: '🌰', label: 'Crunchy acorn' },
    { id: 'starcandy', icon: '🍬', label: 'Star candy' },
    { id: 'cookie', icon: '🍪', label: 'Warm cookie' }
  ],
  defaultTreatId: 'cookie',
  categoryMap: {
    animal: 'acorn',
    nature: 'acorn',
    fantasy: 'starcandy',
    magic: 'starcandy',
    adventure: 'starcandy'
  }
};

test('selectTreat: animal category returns acorn treat', () => {
  const treat = selectTreat(['animal'], testContent);
  assert.equal(treat.id, 'acorn');
  assert.equal(treat.icon, '🌰');
  assert.equal(treat.label, 'Crunchy acorn');
});

test('selectTreat: nature category returns acorn treat', () => {
  const treat = selectTreat(['nature'], testContent);
  assert.equal(treat.id, 'acorn');
});

test('selectTreat: fantasy category returns starcandy treat', () => {
  const treat = selectTreat(['fantasy'], testContent);
  assert.equal(treat.id, 'starcandy');
  assert.equal(treat.icon, '🍬');
});

test('selectTreat: magic category returns starcandy treat', () => {
  const treat = selectTreat(['magic'], testContent);
  assert.equal(treat.id, 'starcandy');
});

test('selectTreat: adventure category returns starcandy treat', () => {
  const treat = selectTreat(['adventure'], testContent);
  assert.equal(treat.id, 'starcandy');
});

test('selectTreat: unmatched category returns default treat', () => {
  const treat = selectTreat(['scifi', 'mystery'], testContent);
  assert.equal(treat.id, 'cookie');
  assert.equal(treat.icon, '🍪');
});

test('selectTreat: empty categories array returns default treat', () => {
  const treat = selectTreat([], testContent);
  assert.equal(treat.id, 'cookie');
});

test('selectTreat: non-array input returns default treat', () => {
  const treat1 = selectTreat(null, testContent);
  assert.equal(treat1.id, 'cookie');

  const treat2 = selectTreat('animal', testContent);
  assert.equal(treat2.id, 'cookie');

  const treat3 = selectTreat({ foo: 'bar' }, testContent);
  assert.equal(treat3.id, 'cookie');
});

test('selectTreat: substring matching works', () => {
  const treat = selectTreat(['animal fiction', 'friendship'], testContent);
  assert.equal(treat.id, 'acorn');
});

test('selectTreat: substring matching is case-insensitive', () => {
  const treat = selectTreat(['ANIMAL FICTION'], testContent);
  assert.equal(treat.id, 'acorn');

  const treat2 = selectTreat(['Fantasy Novel'], testContent);
  assert.equal(treat2.id, 'starcandy');
});

test('selectTreat: keyword order determines result (stable)', () => {
  // First keyword matched should win, regardless of input order
  const result1 = selectTreat(['fantasy', 'animal'], testContent);
  const result2 = selectTreat(['animal', 'fantasy'], testContent);
  // Both should match 'animal' first (Object.keys order in categoryMap)
  assert.equal(result1.id, 'acorn');
  assert.equal(result2.id, 'acorn');
});

test('selectTreat: returns null if default treat missing', () => {
  const badContent = {
    treats: [{ id: 'acorn', icon: '🌰', label: 'Acorn' }],
    defaultTreatId: 'missing',
    categoryMap: { animal: 'acorn' }
  };
  const treat = selectTreat(['scifi'], badContent);
  assert.equal(treat, null);
});

test('selectTreat: never throws', () => {
  assert.doesNotThrow(() => selectTreat(undefined, undefined));
  assert.doesNotThrow(() => selectTreat(null, null));
  assert.doesNotThrow(() => selectTreat({}, {}));
});

test('selectTreat: returns a clone, not a reference', () => {
  const treat = selectTreat(['animal'], testContent);
  treat.label = 'Modified';
  const treat2 = selectTreat(['animal'], testContent);
  assert.equal(treat2.label, 'Crunchy acorn');
});

test('applyGrant: appends new item with correct shape', () => {
  const state = emptyState();
  const result = applyGrant(state, {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  });

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.careItems.inventory.length, 1);

  const item = result.careItems.inventory[0];
  assert.equal(item.id, 'item:grant:1');
  assert.equal(item.itemId, 'acorn');
  assert.equal(item.grantId, 'grant:1');
  assert.equal(item.sourceReadingRecordId, 'reading:1');
  assert.equal(item.localDayKey, '2026-7-15');
  assert.equal(item.remaining, 1);
});

test('applyGrant: does not mutate input careItems', () => {
  const state = emptyState();
  const stateCopy = JSON.parse(JSON.stringify(state));

  applyGrant(state, {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  });

  assert.deepEqual(state, stateCopy);
});

test('applyGrant: does not mutate input grant', () => {
  const state = emptyState();
  const grant = {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  };
  const grantCopy = JSON.parse(JSON.stringify(grant));

  applyGrant(state, grant);

  assert.deepEqual(grant, grantCopy);
});

test('applyGrant: produced state passes isValidCareItemsState', () => {
  const state = emptyState();
  const result = applyGrant(state, {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  });

  assert.equal(result.ok, true);
  assert.equal(isValidCareItemsState(result.careItems), true);
});

test('applyGrant: idempotency - same grantId twice yields one item', () => {
  const state = emptyState();
  const grant = {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  };

  const result1 = applyGrant(state, grant);
  assert.equal(result1.ok, true);
  assert.equal(result1.changed, true);

  const result2 = applyGrant(result1.careItems, grant);
  assert.equal(result2.ok, true);
  assert.equal(result2.changed, false);
  assert.equal(result2.careItems.inventory.length, 1);
});

test('applyGrant: does not duplicate grantDayKeys', () => {
  const state = emptyState();
  const grant = {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  };

  const result1 = applyGrant(state, grant);
  assert.equal(result1.careItems.grantDayKeys.length, 1);

  const result2 = applyGrant(result1.careItems, {
    grantId: 'grant:2',
    itemId: 'starcandy',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:2'
  });
  // Still only one unique day key
  assert.equal(result2.careItems.grantDayKeys.length, 1);

  const result3 = applyGrant(result2.careItems, {
    grantId: 'grant:3',
    itemId: 'cookie',
    localDayKey: '2026-7-16',
    sourceReadingRecordId: 'reading:3'
  });
  // Now two unique day keys
  assert.equal(result3.careItems.grantDayKeys.length, 2);
});

test('applyGrant: rejects missing or empty grantId', () => {
  const state = emptyState();
  const base = {
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  };

  const result1 = applyGrant(state, { ...base, grantId: '' });
  assert.equal(result1.ok, false);
  assert.equal(result1.reason, 'invalidGrantId');

  const result2 = applyGrant(state, { ...base, grantId: undefined });
  assert.equal(result2.ok, false);
});

test('applyGrant: rejects missing or empty itemId', () => {
  const state = emptyState();
  const base = {
    grantId: 'grant:1',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  };

  const result = applyGrant(state, { ...base, itemId: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalidItemId');
});

test('applyGrant: rejects missing or empty localDayKey', () => {
  const state = emptyState();
  const base = {
    grantId: 'grant:1',
    itemId: 'acorn',
    sourceReadingRecordId: 'reading:1'
  };

  const result = applyGrant(state, { ...base, localDayKey: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalidLocalDayKey');
});

test('applyGrant: rejects missing or empty sourceReadingRecordId', () => {
  const state = emptyState();
  const base = {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15'
  };

  const result = applyGrant(state, { ...base, sourceReadingRecordId: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalidSourceReadingRecordId');
});

test('applyUse: decrements remaining from 1 to 0', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 1
      }
    ],
    grantDayKeys: ['2026-7-15']
  };

  const result = applyUse(state, 'item:grant:1');

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.itemId, 'acorn');
  assert.equal(result.careItems.inventory[0].remaining, 0);
});

test('applyUse: returns noTreatAvailable when remaining is 0', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 0
      }
    ],
    grantDayKeys: ['2026-7-15']
  };

  const result = applyUse(state, 'item:grant:1');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'noTreatAvailable');
});

test('applyUse: returns noTreatAvailable when item id not found', () => {
  const state = emptyState();
  const result = applyUse(state, 'item:missing');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'noTreatAvailable');
});

test('applyUse: does not mutate input careItems', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 1
      }
    ],
    grantDayKeys: ['2026-7-15']
  };
  const stateCopy = JSON.parse(JSON.stringify(state));

  applyUse(state, 'item:grant:1');

  assert.deepEqual(state, stateCopy);
});

test('applyUse: rejects invalid inventoryItemId', () => {
  const state = emptyState();
  const result1 = applyUse(state, '');
  assert.equal(result1.ok, false);

  const result2 = applyUse(state, null);
  assert.equal(result2.ok, false);

  const result3 = applyUse(state, 123);
  assert.equal(result3.ok, false);
});

test('availableTreats: returns items with remaining > 0', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 1
      },
      {
        id: 'item:grant:2',
        itemId: 'starcandy',
        grantId: 'grant:2',
        sourceReadingRecordId: 'reading:2',
        localDayKey: '2026-7-15',
        remaining: 0
      },
      {
        id: 'item:grant:3',
        itemId: 'cookie',
        grantId: 'grant:3',
        sourceReadingRecordId: 'reading:3',
        localDayKey: '2026-7-16',
        remaining: 1
      }
    ],
    grantDayKeys: ['2026-7-15', '2026-7-16']
  };

  const treats = availableTreats(state);

  assert.equal(treats.length, 2);
  assert.equal(treats[0].id, 'item:grant:1');
  assert.equal(treats[0].remaining, 1);
  assert.equal(treats[1].id, 'item:grant:3');
  assert.equal(treats[1].remaining, 1);
});

test('availableTreats: returns empty array for empty inventory', () => {
  const state = emptyState();
  const treats = availableTreats(state);

  assert.deepEqual(treats, []);
});

test('availableTreats: returns empty array for malformed input', () => {
  assert.deepEqual(availableTreats(null), []);
  assert.deepEqual(availableTreats(undefined), []);
  assert.deepEqual(availableTreats({}), []);
  assert.deepEqual(availableTreats({ inventory: null }), []);
});

test('availableTreats: never throws', () => {
  assert.doesNotThrow(() => availableTreats(null));
  assert.doesNotThrow(() => availableTreats(undefined));
  assert.doesNotThrow(() => availableTreats({ inventory: 'invalid' }));
});

test('availableTreats: returns clones, not references', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 1
      }
    ],
    grantDayKeys: ['2026-7-15']
  };

  const treats1 = availableTreats(state);
  treats1[0].remaining = 999;

  const treats2 = availableTreats(state);
  assert.equal(treats2[0].remaining, 1);
});

test('isValidCareItemsState: accepts valid state', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 1
      }
    ],
    grantDayKeys: ['2026-7-15']
  };

  assert.equal(isValidCareItemsState(state), true);
});

test('isValidCareItemsState: accepts empty valid state', () => {
  const state = emptyState();
  assert.equal(isValidCareItemsState(state), true);
});

test('isValidCareItemsState: rejects missing inventory', () => {
  const state = { grantDayKeys: [] };
  assert.equal(isValidCareItemsState(state), false);
});

test('isValidCareItemsState: rejects missing grantDayKeys', () => {
  const state = { inventory: [] };
  assert.equal(isValidCareItemsState(state), false);
});

test('isValidCareItemsState: rejects invalid inventory items', () => {
  const state = {
    inventory: [
      {
        id: '',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: 1
      }
    ],
    grantDayKeys: ['2026-7-15']
  };

  assert.equal(isValidCareItemsState(state), false);
});

test('isValidCareItemsState: rejects negative remaining', () => {
  const state = {
    inventory: [
      {
        id: 'item:grant:1',
        itemId: 'acorn',
        grantId: 'grant:1',
        sourceReadingRecordId: 'reading:1',
        localDayKey: '2026-7-15',
        remaining: -1
      }
    ],
    grantDayKeys: ['2026-7-15']
  };

  assert.equal(isValidCareItemsState(state), false);
});

test('isValidCareItemsState: rejects duplicate grantDayKeys', () => {
  const state = {
    inventory: [],
    grantDayKeys: ['2026-7-15', '2026-7-15']
  };

  assert.equal(isValidCareItemsState(state), false);
});

test('isValidCareItemsState: rejects non-string grantDayKeys', () => {
  const state = {
    inventory: [],
    grantDayKeys: [123, '2026-7-15']
  };

  assert.equal(isValidCareItemsState(state), false);
});

test('isValidCareItemsState: never throws', () => {
  assert.doesNotThrow(() => isValidCareItemsState(null));
  assert.doesNotThrow(() => isValidCareItemsState(undefined));
  assert.doesNotThrow(() => isValidCareItemsState({}));
  assert.doesNotThrow(() => isValidCareItemsState('invalid'));
});

test('round-trip: grant then use leaves valid state', () => {
  let state = emptyState();

  const grantResult = applyGrant(state, {
    grantId: 'grant:1',
    itemId: 'acorn',
    localDayKey: '2026-7-15',
    sourceReadingRecordId: 'reading:1'
  });

  assert.equal(grantResult.ok, true);
  state = grantResult.careItems;

  const useResult = applyUse(state, 'item:grant:1');

  assert.equal(useResult.ok, true);
  state = useResult.careItems;

  assert.equal(isValidCareItemsState(state), true);
  assert.equal(state.inventory[0].remaining, 0);
});

test('round-trip: multiple grants then uses', () => {
  let state = emptyState();

  // Grant 3 treats
  for (let i = 1; i <= 3; i++) {
    const result = applyGrant(state, {
      grantId: `grant:${i}`,
      itemId: ['acorn', 'starcandy', 'cookie'][i - 1],
      localDayKey: '2026-7-15',
      sourceReadingRecordId: `reading:${i}`
    });
    assert.equal(result.ok, true);
    state = result.careItems;
  }

  assert.equal(state.inventory.length, 3);
  assert.equal(availableTreats(state).length, 3);

  // Use first treat
  let useResult = applyUse(state, 'item:grant:1');
  assert.equal(useResult.ok, true);
  state = useResult.careItems;

  assert.equal(availableTreats(state).length, 2);

  // Use second treat
  useResult = applyUse(state, 'item:grant:2');
  assert.equal(useResult.ok, true);
  state = useResult.careItems;

  assert.equal(availableTreats(state).length, 1);

  // Use third treat
  useResult = applyUse(state, 'item:grant:3');
  assert.equal(useResult.ok, true);
  state = useResult.careItems;

  assert.equal(availableTreats(state).length, 0);
  assert.equal(isValidCareItemsState(state), true);
});
