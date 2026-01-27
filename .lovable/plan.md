
# Plan: Enable Payment for Manual Expense Entries

## Problem
When users enter manual expense entries (not via Expense Requests), they currently don't have a proper payment workflow. While there is a "Pay" button visible for approved entries, the payment logic has several issues:

1. No balance validation before payment
2. No proper currency conversion to treasury currency
3. Missing `converted_amount` field (required for auto-balance trigger)
4. Entry type uses "withdrawal" instead of "payment"
5. Status goes to "paid" instead of "posted" (inconsistent with Expense Requests)

## Solution
Update the payment logic in `src/pages/ExpenseEntry.tsx` to align with the robust payment workflow already implemented in `src/pages/ExpenseRequests.tsx`.

## Changes

### 1. Update `src/pages/ExpenseEntry.tsx`

#### A. Add currency conversion import
Add the `convertFromBaseCurrency` function from the global currency utility.

#### B. Enhance Treasury Entry Logic
Update the payment handling for treasury entries:

- **Balance Validation**: Check if treasury has sufficient balance in its own currency before proceeding
- **Currency Conversion**: Calculate `converted_amount` using `convertFromBaseCurrency` to get the amount in treasury's currency
- **Entry Type**: Change from "withdrawal" to "payment" for consistency
- **Status Flow**: Update to "posted" status (not just "paid") after successful payment
- **Include All Fields**: Add `converted_amount`, `balance_before`, `balance_after`, `expense_entry_id`

#### C. Enhance Bank Entry Logic
Apply similar improvements for bank payments:

- **Balance Validation**: Check if bank has sufficient balance
- **Proper Amount Handling**: Ensure correct amount calculations
- **Entry Type Consistency**: Use appropriate entry type

### Technical Details

```text
Payment Flow (Updated):
+---------------------+     +-----------------------+     +-------------------+
| Approved Expense    | --> | Validate Balance      | --> | Create Treasury/  |
| Entry               |     | (in treasury currency)|     | Bank Entry        |
+---------------------+     +-----------------------+     +-------------------+
                                                                   |
                                                                   v
                                                          +-------------------+
                                                          | Update Entry to   |
                                                          | "posted" status   |
                                                          +-------------------+
```

### Currency Conversion Logic
- Fetch treasury's currency
- Convert expense amount (stored in base currency SAR) to treasury currency using `convertFromBaseCurrency`
- Validate treasury balance against the converted amount
- Store `converted_amount` in treasury_entries for the balance trigger

### Files to Modify
1. `src/pages/ExpenseEntry.tsx`
   - Import `convertFromBaseCurrency` from `@/lib/currencyConversion`
   - Update `handleStatusChange` function for "paid" status
   - Add balance validation
   - Fix treasury entry creation with proper fields
   - Remove manual treasury balance updates (let the database trigger handle it)
   - Update status to "posted" after successful payment
