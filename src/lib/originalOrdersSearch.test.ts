import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { matchesBreakdown, emptyBreakdownFilters, breakdownTextColumns, breakdownNumberColumns, type BreakdownValues } from './originalOrdersSearch';

const row: BreakdownValues = { orderNumber: 'ORD-001', product: 'Example Card', productCode: 'CAT-100', productId: 'ID-200', sku: 'SKU-300', qty: 2, coins: 60, unitPrice: 25, total: 50, cost: 15, totalCost: 30 };
for (const key of breakdownTextColumns) test(`search matches ${key} and rejects a different value`, () => {
  const filters = emptyBreakdownFilters();
  filters.text[key] = row[key].toLowerCase();
  assert.equal(matchesBreakdown(row, filters, true), true);
  filters.text[key] = 'not-present';
  assert.equal(matchesBreakdown(row, filters, true), false);
});
for (const key of breakdownNumberColumns) test(`${key} range includes exact boundaries and excludes outside values`, () => {
  const filters = emptyBreakdownFilters();
  filters.numbers[key] = { min: String(row[key]), max: String(row[key]) };
  assert.equal(matchesBreakdown(row, filters, true), true);
  filters.numbers[key] = { min: String(row[key] + 1) };
  assert.equal(matchesBreakdown(row, filters, true), false);
});
test('global search covers catalog code and formatted numbers', () => {
  assert.equal(matchesBreakdown(row, { ...emptyBreakdownFilters(), search: 'cat-100' }, true), true);
  assert.equal(matchesBreakdown(row, { ...emptyBreakdownFilters(), search: '25.00' }, true), true);
  assert.equal(matchesBreakdown(row, { ...emptyBreakdownFilters(), search: 'missing' }, true), false);
});
test('combined column filters must all match; clear restores rows', () => {
  const filters = emptyBreakdownFilters();
  filters.text.productCode = 'CAT-100';
  filters.text.sku = 'wrong';
  assert.equal(matchesBreakdown(row, filters, true), false);
  assert.equal(matchesBreakdown(row, emptyBreakdownFilters(), true), true);
});
test('hidden coins column does not filter non-A-class lines', () => {
  const filters = emptyBreakdownFilters();
  filters.numbers.coins = { min: '100' };
  assert.equal(matchesBreakdown(row, filters, false), true);
  assert.equal(matchesBreakdown(row, filters, true), false);
});