

## Problem

Currently, `totalTransferProfit` uses `txRate` (Transaction Exchange Rate) for **both** revenue and cost:

```text
sarPricePerCoin = (1 / sales1UsdCoins) × txRate   ← WRONG
costSarPerCoin  = (1 / cost1UsdCoins)  × txRate
```

But the business logic is:
- **Revenue** is based on the **Pricing Exchange Rate** (the price we charge customers, already locked in)
- **Cost** is based on the **Transaction Exchange Rate** (the actual rate when we transfer USD to the vendor)

So when `txRate` is lower than `inputs.rate`, we pay less to the vendor while selling at the higher price — profit should **increase**, not decrease.

## Fix

**File: `src/pages/PricingScenario.tsx`** — lines 150-151

Change revenue to use `inputs.rate` (Pricing Exchange Rate) and keep cost using `txRate` (Transaction Exchange Rate):

```text
sarPricePerCoin = (1 / sales1UsdCoins) × inputs.rate   // Pricing Rate (selling price)
costSarPerCoin  = (1 / cost1UsdCoins)  × txRate         // Transaction Rate (actual cost)
```

Also update `amountTransferSAR` (line 138) — this represents the **Total Purchase Amount** (what we pay the vendor), so it should stay using `txRate`, which is already correct.

This is a one-line change on line 150.

