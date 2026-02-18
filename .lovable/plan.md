

## Fix: Wrong `order_date_int` in Sales Order Header

### Root Cause
The trigger `set_order_date_int` on `sales_order_header` calls the wrong function: `calculate_order_date_int()` instead of `set_order_date_int()`.

- `calculate_order_date_int()` computes the date from **`created_at`** (database insertion time), NOT from `order_date` (actual order time)
- For order 822262: the order was placed at 21:15 KSA (Feb 17), but inserted into the database at 00:19 KSA (Feb 18). The trigger used the insertion time, producing `20260218` instead of the correct `20260217`

### Fix Steps

1. **Replace the trigger** to use the correct function `set_order_date_int()` which derives the date from `order_date`:
   - Drop the current trigger that calls `calculate_order_date_int()`
   - Create a new trigger that calls `set_order_date_int()` and fires on INSERT or UPDATE OF `order_date`

2. **Fix existing corrupted data** by recalculating `order_date_int` for all rows where `order_date` exists:
   ```text
   UPDATE sales_order_header
   SET order_date_int = to_char(order_date, 'YYYYMMDD')::integer
   WHERE order_date IS NOT NULL
     AND order_date_int != to_char(order_date, 'YYYYMMDD')::integer;
   ```

3. **Propagate fixes to child tables** (`sales_order_line`, `payment_transactions`) so their `order_date_int` values also get corrected

### Technical Details

The correct function already exists:
```text
set_order_date_int():
  -- Uses order_date (actual order time), no timezone conversion needed
  -- since order_date is already stored in KSA time
  NEW.order_date_int := to_char(NEW.order_date, 'YYYYMMDD')::integer;
```

The wrong function currently attached:
```text
calculate_order_date_int():
  -- Uses created_at (DB insertion time) converted to KSA
  NEW.order_date_int := TO_CHAR(NEW.created_at AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD')::INTEGER;
```

SQL migration will:
1. Drop the bad trigger
2. Create a correct trigger using `set_order_date_int()` on INSERT/UPDATE OF `order_date`
3. Bulk-fix all mismatched `order_date_int` values
4. Propagate corrected values to `sales_order_line` and `payment_transactions`

