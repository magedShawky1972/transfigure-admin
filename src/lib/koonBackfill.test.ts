import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dateToInt, intToDateIntString, isValidKoonBackfillRange } from './koonBackfill';

test('backfill dates use inclusive integer order dates and dd/MM/yyyy display', () => {
  assert.equal(dateToInt(new Date(2026, 0, 5)), 20260105);
  assert.equal(intToDateIntString(20260105), '05/01/2026');
});
test('backfill accepts the same From and To date and months-long ranges', () => {
  assert.equal(isValidKoonBackfillRange(new Date(2026, 0, 1), new Date(2026, 0, 1)), true);
  assert.equal(isValidKoonBackfillRange(new Date(2026, 0, 1), new Date(2026, 3, 30)), true);
});
test('backfill rejects missing, invalid, or reversed dates', () => {
  assert.equal(isValidKoonBackfillRange(undefined, new Date(2026, 0, 1)), false);
  assert.equal(isValidKoonBackfillRange(new Date('invalid'), new Date(2026, 0, 1)), false);
  assert.equal(isValidKoonBackfillRange(new Date(2026, 3, 30), new Date(2026, 0, 1)), false);
});
