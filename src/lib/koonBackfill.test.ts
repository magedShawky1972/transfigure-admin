import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dateToInt, getKoonEndpointStatus, intToDateIntString, isValidKoonBackfillRange, type KoonEndpointProgress } from './koonBackfill';

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

const endpoint = (phase: number, values: Partial<KoonEndpointProgress> = {}): KoonEndpointProgress => ({
  phase,
  endpoint: `api-${phase}`,
  total: 0,
  pending: 0,
  success: 0,
  failed: 0,
  ...values,
});

test('only the active API is shown as running while later APIs wait', () => {
  assert.equal(getKoonEndpointStatus(endpoint(2), 'preparing', 2, 'api-2'), 'running');
  assert.equal(getKoonEndpointStatus(endpoint(1), 'preparing', 2, 'api-2'), 'completed');
  assert.equal(getKoonEndpointStatus(endpoint(3), 'preparing', 2, 'api-2'), 'waiting');
});

test('API status distinguishes queued, completed, and failed work', () => {
  assert.equal(getKoonEndpointStatus(endpoint(4, { total: 8, pending: 8 }), 'running', 4), 'pending');
  assert.equal(getKoonEndpointStatus(endpoint(4, { total: 8, pending: 8 }), 'paused', 4), 'pending');
  assert.equal(getKoonEndpointStatus(endpoint(4, { total: 8, success: 8 }), 'running', 5), 'completed');
  assert.equal(getKoonEndpointStatus(endpoint(5, { total: 8, failed: 2, success: 6 }), 'completed_with_errors', 5), 'failed');
  assert.equal(getKoonEndpointStatus(endpoint(3), 'failed', 3), 'failed');
});
