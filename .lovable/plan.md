

## Reconcile Excel vs Database Feature

### What It Does
After upload completes, a "Reconcile" button appears in the summary dialog. Clicking it re-reads the last uploaded Excel file, groups rows by order number, sums the `total` column per order, then queries `purpletransaction` for the same order numbers and compares totals. A new dialog shows a table with columns: Order Number, Excel Total, DB Total, Difference, and Status (Match/Mismatch). Summary stats at top show total matched, mismatched, and missing orders.

### Implementation Steps

**Step 1: Store uploaded Excel data for reconciliation**
In `src/pages/LoadData.tsx`, after a successful upload, store the parsed `jsonData` and the file's sheet config in state so the reconcile function can access it without re-reading the file.

**Step 2: Add Reconcile button to the summary dialog**
In the `showSummaryDialog` section of `LoadData.tsx`, add a "Reconcile with Database" button below the existing summary stats. Only show it when the target table is `purpletransaction`.

**Step 3: Create ReconcileDialog component**
New file: `src/components/ReconcileDialog.tsx`
- Accepts: `excelData` (array of rows from Excel), `open`, `onOpenChange`
- On open:
  1. Groups Excel rows by `ordernumber` (or mapped order column), sums `total` per order
  2. Fetches from `purpletransaction` using `.in('ordernumber', orderNumbers)` in batches, sums `total` per order
  3. Compares and builds a results array with: orderNumber, excelTotal, dbTotal, difference
- Renders a scrollable table with color-coded rows (green=match, red=mismatch, yellow=missing in DB)
- Shows summary: X matched, Y mismatched, Z missing, total Excel value, total DB value, total difference

**Step 4: Wire it together**
- Add state for `reconcileExcelData` and `showReconcileDialog` in `LoadData.tsx`
- When upload completes for purpletransaction target, save the jsonData
- Reconcile button opens the dialog with the saved data

### Technical Details

**Excel grouping logic:**
```typescript
const excelByOrder = new Map<string, number>();
excelData.forEach(row => {
  const orderNum = String(row.ordernumber || row['Order Number'] || '');
  const total = parseFloat(String(row.total || 0));
  excelByOrder.set(orderNum, (excelByOrder.get(orderNum) || 0) + total);
});
```

**DB query (batched):**
```typescript
const orderNums = Array.from(excelByOrder.keys());
// Fetch in batches of 500
const dbData = [];
for (let i = 0; i < orderNums.length; i += 500) {
  const batch = orderNums.slice(i, i + 500);
  const { data } = await supabase
    .from('purpletransaction')
    .select('ordernumber, total')
    .in('ordernumber', batch);
  dbData.push(...(data || []));
}
```

**Matching tolerance:** Use `Math.abs(diff) < 0.01` to account for floating point.

### Files to Create/Edit
- **Create**: `src/components/ReconcileDialog.tsx`
- **Edit**: `src/pages/LoadData.tsx` (add reconcile state, button in summary dialog, store excel data after upload)

