

## Plan: Add Search to Brand Filter in Sales Order Detail Report

**What**: Replace the plain `Select` dropdown for the Brand filter with the searchable Combobox pattern (Popover + Command) already used throughout the app.

**Why**: The brand list is long, making it hard to find a specific brand in a plain dropdown.

### Changes

**File: `src/pages/SalesOrderDetailReport.tsx`**

1. Add imports for `Popover`, `PopoverTrigger`, `PopoverContent`, `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, and `Check` icon.

2. Add a local state `brandOpen` (boolean) to control the popover visibility.

3. Replace the current Brand `<Select>` block (lines 484-497) with a searchable Combobox:
   - Popover with a Button trigger showing the selected brand name (or "All" placeholder)
   - CommandInput for typing to search/filter brands
   - CommandList with "All" option + filtered `brandOptions`
   - On select: set `filterBrand`, close popover

This follows the exact same searchable selection pattern already used in Dashboard brand filter, Coins Sheets, and Product Details.

