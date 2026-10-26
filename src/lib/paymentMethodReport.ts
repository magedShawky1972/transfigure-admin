export interface PaymentMethodRow {
  report_date: number;
  payment_method: string;
  payment_brand: string;
  payment_type: string;
  order_count: number;
  line_count: number;
  total_amount: number;
  bank_fee: number;
}

export function filterPaymentMethodRows(rows: PaymentMethodRow[], method: string, paymentType = "all") {
  return rows.filter(row => (method === "all" || row.payment_method === method) && (paymentType === "all" || row.payment_type === paymentType));
}

export function paymentMethodTotals(rows: PaymentMethodRow[]) {
  return rows.reduce((total, row) => ({
    lines: total.lines + Number(row.line_count),
    amount: total.amount + Number(row.total_amount),
    fees: total.fees + Number(row.bank_fee),
  }), { lines: 0, amount: 0, fees: 0 });
}