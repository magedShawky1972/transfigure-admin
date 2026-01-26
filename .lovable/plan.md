
# Fix Void Payment Treasury Entry Detection and Prevent Duplicates

## Problem Summary

The Void Payment page shows "no entry found" and fails to delete treasury entries because:

1. **Multiple treasury entries exist for the same expense request** - When you rollback and re-pay, a new treasury entry is created without checking for existing ones
2. **The query uses `.maybeSingle()`** - This method returns `null` when multiple rows match, causing the lookup to fail silently

## Solution Overview

We need to fix two issues:

1. **Void Payment**: Query for ALL linked treasury entries and delete them all
2. **Payment Creation**: Add a database unique constraint to prevent duplicate treasury entries for the same expense request

---

## Technical Implementation

### Part 1: Fix Void Payment to Handle Multiple Entries

**File: `src/pages/VoidPayment.tsx`**

Change the treasury entry query from `.maybeSingle()` to fetching all entries:

```typescript
// BEFORE (broken when duplicates exist):
const { data: treasuryEntry } = await supabase
  .from("treasury_entries")
  .select("id, entry_number, converted_amount")
  .eq("expense_request_id", request.id)
  .maybeSingle();

// AFTER (handles multiple entries):
const { data: treasuryEntries } = await supabase
  .from("treasury_entries")
  .select("id, entry_number, converted_amount")
  .eq("expense_request_id", request.id);
```

Update the enrichment logic to:
- Store the first entry's ID for display/UI purposes
- Store ALL entry IDs for deletion
- Sum the converted_amount across all entries for accurate void history

In `handleVoidPayment()`, delete ALL linked treasury entries:

```typescript
// Delete ALL treasury entries for this request
if (selectedRequest.treasury_entry_ids?.length > 0) {
  const { error: treasuryDeleteError } = await supabase
    .from("treasury_entries")
    .delete()
    .in("id", selectedRequest.treasury_entry_ids);
}
```

---

### Part 2: Prevent Duplicate Treasury Entries (Database Migration)

Add a unique partial index that ensures only ONE posted treasury payment entry can exist per expense request:

```sql
CREATE UNIQUE INDEX unique_posted_treasury_payment_per_expense
ON treasury_entries (expense_request_id)
WHERE expense_request_id IS NOT NULL 
  AND status = 'posted' 
  AND entry_type = 'payment';
```

This allows:
- Multiple draft/approved entries (during normal workflow)
- Only one posted payment entry per expense request (enforced at database level)

---

### Part 3: Clean Up Existing Duplicates

Before adding the unique constraint, we need to clean up existing duplicate entries. We'll keep the most recent one and delete the older duplicates:

```sql
-- Find and delete older duplicate entries, keeping only the most recent one
WITH duplicates AS (
  SELECT id, expense_request_id, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY expense_request_id 
      ORDER BY created_at DESC
    ) as rn
  FROM treasury_entries
  WHERE expense_request_id IS NOT NULL 
    AND status = 'posted' 
    AND entry_type = 'payment'
)
DELETE FROM treasury_entries 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
```

---

### Part 4: Update UI to Show Multiple Entries

In the void confirmation dialog, show a count if multiple entries exist:

```typescript
{selectedRequest.treasury_entry_ids?.length > 1 && (
  <span className="text-xs text-amber-600 ml-1">
    ({selectedRequest.treasury_entry_ids.length} entries will be deleted)
  </span>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/VoidPayment.tsx` | Update query to fetch all entries, modify deletion to handle multiple, update UI |
| Database migration | Add unique partial index, clean up existing duplicates |

## Testing Checklist

- Void a paid request that has multiple treasury entries (should delete all)
- Verify treasury balance is correctly recalculated after void
- Try to pay the same expense request twice (should fail with constraint error)
- Verify void history records the correct total amount

---

## Impact

- **Void Payment will work correctly** even when duplicate entries exist
- **Future duplicates are prevented** at the database level
- **Existing duplicates are cleaned up** during migration
- **Treasury balance calculations remain accurate** via the existing database trigger
