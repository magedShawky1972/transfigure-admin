

## Problem
The Riyad Bank Report crashes when loading two months of data (~16K+ rows) because:
1. All rows are fetched into memory at once and stored in state
2. All rows are rendered as DOM nodes simultaneously (no virtualization)
3. Sorting/totals recompute on every render over the full dataset

## Plan

### 1. Add server-side pagination with "Load More" approach
- Require at least one date filter (txn_date) before allowing search — prevent loading the entire 308K row table
- Keep the paginated fetch loop but add a configurable max limit (e.g., 50K rows) with a warning
- Compute totals incrementally during fetch, not after

### 2. Virtualize the table rendering
- Use `@tanstack/react-virtual` (already in the project, used by `VirtualizedTransactionTable`) to only render visible rows
- Replace the current `<TableBody>` that renders all `sortedData.map(...)` with a virtualized container showing ~30 visible rows at a time
- This is the main fix — 16K DOM rows is what causes the crash

### 3. Optimize sorting and totals
- Use `useMemo` for `sortedData` and `totals` to avoid recomputation on unrelated re-renders
- Compute totals during the fetch loop instead of re-reducing the entire array on every render

### Technical Details
- Import `useVirtualizer` from `@tanstack/react-virtual`
- Create a scrollable container div with a fixed height (~600px)
- Virtualize rows with estimated row height of 35px
- Wrap `sortedData` and `totals` in `useMemo` with proper dependencies
- Add validation: if no txn date range selected, show warning and block fetch

### Files to modify
- `src/pages/RiyadBankReport.tsx` — virtualization, memoization, fetch guard

