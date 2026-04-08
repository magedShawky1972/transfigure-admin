

## Current "Total Transfer Profit" Calculation

The existing formula (lines 138-149) uses **hardcoded** gateway fees (0.8% + 1 SAR fixed + 15% VAT) rather than the actual MADA payment method values from the database. Here's the current logic:

```text
coinsPerTx      = totalTransferCoins / numberOfTransactions
revenuePerTx    = coinsPerTx × (1/sales1UsdCoins) × rate
gatewayFeePerTx = (revenuePerTx × 0.008 + 1) × 1.15   ← HARDCODED
costPerTx       = coinsPerTx × (1/cost1UsdCoins) × rate
profitPerTx     = revenuePerTx - gatewayFeePerTx - costPerTx
Total           = profitPerTx × numberOfTransactions
```

## Proposed Fix: Use Actual MADA Payment Method Fees

Replace the hardcoded values with the real MADA method's `gateway_fee`, `fixed_value`, and `vat_fee` from the `payment_methods` table — the same values already used in `calculateForMethod()`.

### Updated Formula

```text
madaMethod      = paymentMethods.find(m => name includes "mada")
gatewayRate     = madaMethod.gateway_fee / 100
fixedVal        = madaMethod.fixed_value
vatRate         = madaMethod.vat_fee / 100
cashBackRate    = inputs.cashBackPercent / 100

coinsPerTx      = totalTransferCoins / numberOfTransactions
revenuePerTx    = coinsPerTx × (1/sales1UsdCoins) × rate
costPerTx       = coinsPerTx × (1/cost1UsdCoins) × rate
commissionPerTx = revenuePerTx × gatewayRate
vatPerTx        = (fixedVal + commissionPerTx) × vatRate
cashBackPerTx   = revenuePerTx × cashBackRate
profitPerTx     = revenuePerTx - costPerTx - commissionPerTx - fixedVal - vatPerTx - cashBackPerTx
Total           = profitPerTx × numberOfTransactions
```

This mirrors exactly how `calculateForMethod()` computes Net per row, but applied at the transfer level.

### File Change

**`src/pages/PricingScenario.tsx`** — Update the `totalTransferProfit` useMemo (lines 138-149) to:
1. Find the MADA payment method from `paymentMethods` array
2. Use its `gateway_fee`, `fixed_value`, `vat_fee` instead of hardcoded values
3. Include `cashBackPercent` in the deduction (currently missing)
4. Add `paymentMethods` to the dependency array

