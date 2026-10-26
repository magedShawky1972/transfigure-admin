import { test } from "node:test";
import { strict as assert } from "node:assert";
import { filterPaymentMethodRows, paymentMethodTotals, type PaymentMethodRow } from "./paymentMethodReport";

const rows: PaymentMethodRow[] = [
  { report_date: 20261001, payment_method: "Hyperpay", payment_brand: "VISA", payment_type: "credit", order_count: 2, line_count: 3, total_amount: 100, bank_fee: 2 },
  { report_date: 20261002, payment_method: "Cash", payment_brand: "Unknown", payment_type: "cash", order_count: 1, line_count: 1, total_amount: 50, bank_fee: 0 },
];
test("selecting a payment method excludes other methods", () => {
  assert.deepEqual(filterPaymentMethodRows(rows, "Hyperpay").map(row => row.payment_method), ["Hyperpay"]);
  assert.deepEqual(paymentMethodTotals(filterPaymentMethodRows(rows, "Hyperpay")), { lines: 3, amount: 100, fees: 2 });
});
test("all payment methods includes the full total", () => {
  assert.deepEqual(paymentMethodTotals(filterPaymentMethodRows(rows, "all")), { lines: 4, amount: 150, fees: 2 });
});
test("payment type filters rows and totals independently of payment method", () => {
  const filtered = filterPaymentMethodRows(rows, "all", "credit");
  assert.deepEqual(filtered.map(row => row.payment_type), ["credit"]);
  assert.deepEqual(paymentMethodTotals(filtered), { lines: 3, amount: 100, fees: 2 });
});
test("payment method and payment type must both match", () => {
  assert.deepEqual(filterPaymentMethodRows(rows, "Cash", "credit"), []);
  assert.deepEqual(filterPaymentMethodRows(rows, "Cash", "cash"), [rows[1]]);
});