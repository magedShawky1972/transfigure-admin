

## API-to-Transaction Field Mapping Configuration Screen

### What We're Building
An admin page where users can visually configure how fields from the staging tables (sales_order_header, sales_order_line, payment_transactions) map to the purpletransaction table. Users can change mappings anytime, and choose whether the integration runs per-transaction or on a schedule.

### Database Changes

**New table: `api_transaction_mapping`**
- `id` (uuid, PK)
- `target_field` (text) — purpletransaction column name
- `source_table` (text) — 'sales_order_header' | 'sales_order_line' | 'payment_transactions' | 'computed' | 'fixed'
- `source_field` (text) — column name from source table, or formula/fixed value
- `is_active` (boolean, default true)
- `display_order` (int)
- `created_at`, `updated_at`

**New table: `api_integration_settings`**
- `id` (uuid, PK)
- `trigger_mode` (text) — 'per_transaction' or 'scheduled'
- `schedule_interval_minutes` (int, nullable) — e.g. 60 for hourly
- `is_enabled` (boolean, default false)
- `start_date` (date) — minimum order date to process
- `updated_at`, `updated_by`

RLS: admin-only access for both tables.

### UI Layout — `src/pages/ApiTransactionMapping.tsx`

**Left side**: Table listing all purpletransaction fields (target_field column) with their current mapping status.

**Right side**: For each selected row, a dropdown to pick:
1. Source table (Header / Line / Payment / Computed / Fixed)
2. Source field (columns from the selected table)

**Top section**: Integration settings panel:
- Toggle: Per Transaction vs Scheduled
- If scheduled: interval input (minutes)
- Enable/Disable toggle
- Start date picker
- Save settings button

**Pre-populate**: On first load, if no mappings exist, seed the table with the current hardcoded mappings from the edge function.

### Routing & Security

- New route: `/api-transaction-mapping`
- Add to Admin menu in AppSidebar.tsx
- Add permission key `apiTransactionMapping` in URL_TO_PERMISSION map
- Add to UserSetup security page

### Edge Function Update

Update `process-api-to-transactions` to read mappings from `api_transaction_mapping` table instead of hardcoded field assignments. Also read `api_integration_settings` for trigger mode and start date.

### Files to Create/Modify
1. **Create** `src/pages/ApiTransactionMapping.tsx` — main mapping UI
2. **Modify** `src/components/AppSidebar.tsx` — add menu item + permission
3. **Modify** `src/App.tsx` — add route
4. **Modify** `supabase/functions/process-api-to-transactions/index.ts` — read dynamic mappings
5. **Migration** — create `api_transaction_mapping` and `api_integration_settings` tables with RLS

