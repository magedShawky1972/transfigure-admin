import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSajelOrderBody } from '../../supabase/functions/_shared/sajel-order-body';

test('Sajel order body sends Asus-Card as the root company header', () => {
  const invoice = { businessUnitCode: 'Asus-Trading', lines: [{ quantity: 1 }] };
  const payment = { paymentMethod: 'CARD' };
  const body = buildSajelOrderBody(invoice, payment, 'TEST-BATCH');
  assert.equal(body.companyCode, 'Asus-Card');
  assert.deepEqual(Object.keys(body), ['companyCode', 'invoice', 'payment', 'batchNumber']);
  assert.deepEqual(body.invoice, invoice);
  assert.deepEqual(body.payment, payment);
  assert.equal(body.batchNumber, 'TEST-BATCH');
  assert.deepEqual(buildSajelOrderBody(invoice), { companyCode: 'Asus-Card', invoice });
});