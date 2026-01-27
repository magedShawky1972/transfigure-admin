

# Plan: Fix Multi-Currency Conversion Logic in Expense Entry

## Summary
The current expense entry system has a mismatch in how amounts are stored and displayed:
- **Manual entries**: `grand_total` stores the **original currency** amount (e.g., 25 USD)
- **Expense Request entries**: `grand_total` stores the **SAR (base currency)** amount

The display and payment logic assumes one format for both, causing incorrect calculations. We need to fix the UI logic to handle both cases correctly.

## Current State

```text
Manual Entry (25 USD @ 3.75 rate):
┌──────────────────────────────────────────────────────────────┐
│ Database: grand_total = 25, currency_id = USD, rate = 3.75  │
├──────────────────────────────────────────────────────────────┤
│ Current Display (WRONG):                                     │
│   Original Value: 6.67 (incorrectly dividing)               │
│   Amount SAR: 25 (wrong - shows stored value)               │
│   Treasury (EGP): 2.03 (wrong - based on wrong SAR)         │
└──────────────────────────────────────────────────────────────┘
```

## Target State

```text
Manual Entry (25 USD @ 3.75 rate):
┌──────────────────────────────────────────────────────────────┐
│ Database: grand_total = 25, currency_id = USD, rate = 3.75  │
├──────────────────────────────────────────────────────────────┤
│ Correct Display:                                             │
│   Original Value: 25.00 USD (direct from grand_total)       │
│   Amount SAR: 93.75 (25 * 3.75)                             │
│   Treasury (EGP): 1,153.13 (93.75 * 12.3)                   │
└──────────────────────────────────────────────────────────────┘
```

## Changes Required

### File: `src/pages/ExpenseEntry.tsx`

**1. Update Grid Display Functions**

**A. Original Value Column (line ~647-669)**
- For **manual entries** (no matching expense_request): Display `grand_total` directly as the original value
- For **expense-request entries**: Reverse-calculate from base using `convertFromBaseCurrency`

**B. Amount SAR Column (line ~819-820)**
- For **manual entries**: Calculate using `convertToBaseCurrency(grand_total, currency_id, ...)`
- For **expense-request entries**: Display `grand_total` directly (already in SAR)

**C. Treasury/Bank Amount Column (line ~814-817)**
- First calculate SAR amount (using logic from B above)
- Then convert to treasury/bank currency using `convertFromBaseCurrency`
- Apply to both treasury and bank payment methods (user requested this)

**2. Update Helper Functions**

**A. Replace `getOriginalValue` function**
```typescript
const getAmountInOriginalCurrency = (entry: ExpenseEntry) => {
  // If entry is from expense_request, grand_total is already SAR
  // Need to reverse-convert to original currency
  if (entry.from_expense_request) {
    return convertFromBaseCurrency(
      entry.grand_total, 
      entry.currency_id, 
      currencyRates, 
      baseCurrency
    );
  }
  // Manual entry: grand_total IS the original amount
  return entry.grand_total;
};
```

**B. Add `getAmountInSAR` function**
```typescript
const getAmountInSAR = (entry: ExpenseEntry) => {
  // If entry is from expense_request, grand_total is already SAR
  if (entry.from_expense_request) {
    return entry.grand_total;
  }
  // Manual entry: convert from original currency to SAR
  return convertToBaseCurrency(
    entry.grand_total,
    entry.currency_id,
    currencyRates,
    baseCurrency
  );
};
```

**C. Update `convertToTreasuryCurrency` to `getAmountInPaymentCurrency`**
```typescript
const getAmountInPaymentCurrency = (entry: ExpenseEntry) => {
  const sarAmount = getAmountInSAR(entry);
  
  if (entry.payment_method === "treasury" && entry.treasury_id) {
    const treasury = treasuries.find(t => t.id === entry.treasury_id);
    return convertFromBaseCurrency(sarAmount, treasury?.currency_id, ...);
  } else if (entry.payment_method === "bank" && entry.bank_id) {
    const bank = banks.find(b => b.id === entry.bank_id);
    return convertFromBaseCurrency(sarAmount, bank?.currency_id, ...);
  }
  return sarAmount;
};
```

**3. Update Payment Logic (line ~239-248)**

The payment logic already converts correctly but needs to use the same detection logic:
```typescript
// Determine if grand_total is in original currency or SAR
const grandTotalInSAR = entry.from_expense_request
  ? grandTotal  // Already SAR for expense-request entries
  : convertToBaseCurrency(grandTotal, fullEntry?.currency_id, ...);
```

**4. Update Bank Payment Support**

- Fetch bank currency_id (already available in `banks` state)
- Show payment currency column for both bank and treasury payments
- Update bank entry creation to include proper currency conversion

**5. Update Table Headers**

Change "Treasury Amount" column header to "Payment Amount" since it now applies to both payment methods.

## Conversion Flow Summary

```text
MANUAL ENTRY (e.g., 25 USD):
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Original: 25 USD│───▶│ SAR: 93.75      │───▶│ Treasury: 1,153 │
│ (grand_total)   │×3.75│ (calculated)    │×12.3│ (EGP)          │
└─────────────────┘    └─────────────────┘    └─────────────────┘

EXPENSE-REQUEST ENTRY (e.g., 93.75 SAR):
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ SAR: 93.75      │◀───│ Original: 25 USD│───▶│ Treasury: 1,153 │
│ (grand_total)   │÷3.75│ (reverse calc)  │×12.3│ (EGP)          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Technical Details

### Files to Modify
1. `src/pages/ExpenseEntry.tsx`
   - Update display helper functions
   - Update grid columns to use new helpers
   - Update payment logic for consistency
   - Add bank currency lookup

### Data Already Available
- `from_expense_request` flag: Already computed in `fetchEntries`
- `banks` with `currency_id`: Need to add to the query (currently only fetches balance)
- `currencies` and `currencyRates`: Already loaded

### Database Query Update
Update banks query to include `currency_id`:
```typescript
supabase.from("banks").select("id, bank_name, bank_name_ar, current_balance, currency_id")
```

