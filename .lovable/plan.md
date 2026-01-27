
# Plan: Treasury Entry Enhancements - Filter, Ledger View & Reversal Entries

## Summary
This plan addresses three key enhancements to the Treasury Entry system:
1. **Treasury Filter** - Add a dropdown to filter transactions by specific treasury
2. **Ledger View** - New accounting-style view with Dr./Cr. columns and running balance
3. **Void Reversal** - Replace deletion with reversing entries for proper accounting trail

## Current State Analysis

```text
CURRENT VOID PAYMENT FLOW:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ User Clicks     │───▶│ Edge Function   │───▶│ DELETE Entries  │
│ "Void Payment"  │    │ void-expense-   │    │ from table      │
│                 │    │ payment         │    │ (No Trail)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘

TARGET VOID PAYMENT FLOW:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ User Clicks     │───▶│ Edge Function   │───▶│ INSERT Reversal │
│ "Void Payment"  │    │ void-expense-   │    │ Entry (Opposite │
│                 │    │ payment         │    │ Sign = Dr/Cr)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Changes Required

### 1. Treasury Filter (src/pages/TreasuryEntry.tsx)

**A. Add Filter State**
- Add `selectedTreasuryFilter` state to track selected treasury
- Add filter logic to apply when fetching/displaying entries

**B. Add Filter UI**
- Add a Select dropdown above the table to filter by treasury
- Include "All Treasuries" option as default
- Trigger data re-fetch when filter changes

**C. Update Data Fetching**
- Modify `fetchData()` to accept optional treasury ID parameter
- Apply `.eq("treasury_id", selectedTreasuryFilter)` when a treasury is selected

### 2. Dual View Mode - Current & Ledger View (src/pages/TreasuryEntry.tsx)

**A. Add View Toggle State**
- Add `viewMode` state: `"standard"` | `"ledger"`
- Add toggle buttons/tabs to switch between views

**B. Standard View (Current)**
Keep existing columns:
- Entry No., Treasury, Date, Type, Currency, Rate, Amount (SAR), Treasury Amount, Bal. Before, Bal. After, Cost Center, Status, Actions

**C. New Ledger View (Accounting Style)**
Simplified columns for accounting focus:
| Column | Description |
|--------|-------------|
| Entry No. | Transaction reference |
| Date | Treasury date |
| Type | Receipt/Payment/Transfer/Void |
| Description | Transaction details |
| Dr. | Debit amount (money IN to treasury) |
| Cr. | Credit amount (money OUT of treasury) |
| Bal. Before | Balance before transaction |
| Bal. After | Balance after transaction |

**D. Dr./Cr. Logic**
- **Dr. (Debit)** = Money added to treasury = `entry_type === "receipt"` 
- **Cr. (Credit)** = Money deducted from treasury = `entry_type === "payment"` or `entry_type === "transfer"`
- Void entries will have opposite sign to original

### 3. Void Payment Reversal Logic

**A. Update Edge Function (supabase/functions/void-expense-payment/index.ts)**

Instead of deleting entries, create reversal entries:

```text
ORIGINAL ENTRY (Payment of 1000 SAR):
┌──────────────────────────────────────────────────┐
│ Entry No: TRE-001                                │
│ Type: payment | Amount: 1000 | Cr: 1000 | Dr: 0 │
│ Bal Before: 5000 | Bal After: 4000              │
└──────────────────────────────────────────────────┘

REVERSAL ENTRY (Created on Void):
┌──────────────────────────────────────────────────┐
│ Entry No: TRE-002                                │
│ Type: void_reversal | Amount: 1000 | Dr: 1000   │
│ Description: "Void of TRE-001: [reason]"        │
│ Bal Before: 4000 | Bal After: 5000              │
│ reference_type: "void" | reference_id: TRE-001  │
└──────────────────────────────────────────────────┘
```

**B. Edge Function Changes**
- Instead of `.delete()`, create INSERT of new entry with:
  - `entry_type`: `"void_reversal"` (new type to add to ENTRY_TYPES)
  - `amount`: Same as original but with opposite effect
  - `description`: Include original entry reference and void reason
  - `reference_type`: `"void"`
  - `reference_id`: Original entry ID being voided
  - Mark original entry with `status: "voided"` instead of reverting to "approved"

**C. Mark Original as Voided**
- Update original entry status to `"voided"` (not "approved")
- Update expense_request/expense_entry status to `"voided"` as well

**D. Bank Entry Handling**
- Same logic for bank_entries: create reversal entry instead of deletion
- Remove manual balance updates since trigger/ledger handles it

### 4. Database/Type Updates

**A. Add New Entry Type**
Add `"void_reversal"` to the ENTRY_TYPES constant:
```typescript
const ENTRY_TYPES = [
  { value: "receipt", labelEn: "Receipt", labelAr: "إيصال" },
  { value: "payment", labelEn: "Payment", labelAr: "صرف" },
  { value: "transfer", labelEn: "Transfer", labelAr: "تحويل" },
  { value: "void_reversal", labelEn: "Void Reversal", labelAr: "إلغاء" },
];
```

**B. Add Status Color for Voided**
```typescript
const STATUS_COLORS: Record<string, string> = {
  ...existing,
  voided: "bg-purple-100 text-purple-800",
};
```

## File Changes Summary

| File | Changes |
|------|---------|
| `src/pages/TreasuryEntry.tsx` | Add treasury filter, view toggle, ledger view columns, void_reversal type, voided status |
| `supabase/functions/void-expense-payment/index.ts` | Replace DELETE with INSERT reversal logic for treasury_entries and bank_entries |

## Technical Details

### Treasury Filter Implementation
```typescript
// New state
const [selectedTreasuryFilter, setSelectedTreasuryFilter] = useState<string>("all");

// Modified fetch
const entriesQuery = supabase
  .from("treasury_entries")
  .select("*")
  .order("entry_date", { ascending: false });

if (selectedTreasuryFilter !== "all") {
  entriesQuery.eq("treasury_id", selectedTreasuryFilter);
}
```

### Ledger View Dr./Cr. Logic
```typescript
const getDebitAmount = (entry: TreasuryEntryType) => {
  // Dr. = money coming IN to treasury
  if (entry.entry_type === "receipt" || entry.entry_type === "void_reversal") {
    // void_reversal of a payment = money back in = Dr.
    return entry.converted_amount || entry.amount;
  }
  return 0;
};

const getCreditAmount = (entry: TreasuryEntryType) => {
  // Cr. = money going OUT of treasury
  if (entry.entry_type === "payment" || entry.entry_type === "transfer") {
    return entry.converted_amount || entry.amount;
  }
  return 0;
};
```

### Void Reversal Entry Creation (Edge Function)
```typescript
// Instead of delete, insert reversal
const reversalEntry = {
  treasury_id: originalEntry.treasury_id,
  entry_date: new Date().toISOString(),
  entry_type: "void_reversal",
  entry_number: "TEMP", // Will be auto-generated
  amount: originalEntry.amount,
  converted_amount: originalEntry.converted_amount,
  description: `Void of ${originalEntry.entry_number}: ${reason}`,
  reference_type: "void",
  reference_id: originalEntry.id,
  status: "posted", // Immediately posted
  created_by: userId,
  posted_by: userId,
  posted_at: new Date().toISOString(),
  from_currency_id: originalEntry.from_currency_id,
  to_currency_id: originalEntry.to_currency_id,
  exchange_rate: originalEntry.exchange_rate,
};

await serviceClient.from("treasury_entries").insert(reversalEntry);

// Mark original as voided
await serviceClient
  .from("treasury_entries")
  .update({ status: "voided" })
  .eq("id", originalEntry.id);
```

## Accounting Trail Benefit

```text
BEFORE (Delete approach):
Date       Entry    Type      Dr.    Cr.    Balance
2024-01-01 TRE-001  Payment   -      1000   4000
[Entry deleted - no trace of what happened]

AFTER (Reversal approach):
Date       Entry    Type           Dr.    Cr.    Balance
2024-01-01 TRE-001  Payment        -      1000   4000
2024-01-15 TRE-002  Void Reversal  1000   -      5000
[Complete audit trail maintained]
```
