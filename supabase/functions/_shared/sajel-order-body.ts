// Keep the company header first and the batch number last for Sajel.
export function buildSajelOrderBody<I, P>(invoice: I, payment?: P, batchNumber?: string) {
  return {
    companyCode: 'Asus-Card',
    invoice,
    ...(payment ? { payment } : {}),
    ...(batchNumber ? { batchNumber } : {}),
  };
}