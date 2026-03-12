
# Updated Plan: API-to-PurpleTransaction Pipeline

## Key Updates from User Feedback

1. **Start date**: Only process orders from **Mar-11, 2025** onwards (`order_date >= '2025-03-11'`)
2. **Payment method = payment type**: Map `payment_method` from `payment_transactions` to both `payment_method` and `payment_type` in `purpletransaction` (they are the same field)
3. **New columns on `purpletransaction`**: Add `payment_reference` (text) and `payment_card_number` (text) — the other fields (`customer_ip`, `device_fingerprint`, `transaction_location`, `register_user_id`, `player_id`) already exist
4. **Customer not found**: If customer lookup fails by phone, set `customer_name = 'Not Defined'` instead of leaving null
5. **All header fields mapped**: `customer_ip`, `device_fingerprint`, `transaction_location`, `register_user_id`, `player_id` flow from header → purpletransaction

## Database Migration

Add 2 new columns to `purpletransaction`:
```sql
ALTER TABLE public.purpletransaction ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.purpletransaction ADD COLUMN IF NOT EXISTS payment_card_number text;
```

Also add `is_processed` flag to `sales_order_header`:
```sql
ALTER TABLE public.sales_order_header ADD COLUMN IF NOT EXISTS is_processed boolean DEFAULT false;
```

## Updated Data Mapping

```text
purpletransaction field        ← Source
─────────────────────────────────────────────────────
order_number                   ← header.order_number
created_at_date                ← header.order_date
user_name                      ← header.sales_person
customer_phone                 ← header.customer_phone
customer_name                  ← customers lookup OR 'Not Defined'
customer_ip                    ← header.customer_ip
device_fingerprint             ← header.device_fingerprint
transaction_location           ← header.transaction_location
register_user_id               ← header.register_user_id
player_id                      ← header.player_id OR line.player_id
brand_name                     ← products lookup by SKU
brand_code                     ← brands lookup
product_name                   ← products lookup by SKU
product_id                     ← line.product_sku
coins_number                   ← line.coins_number
unit_price                     ← line.unit_price
cost_price                     ← line.cost_price
qty                            ← line.quantity
cost_sold                      ← line.total_cost
total                          ← line.total
profit                         ← total - cost_sold
payment_method                 ← payment.payment_method  ←─┐ SAME
payment_type                   ← payment.payment_method  ←─┘
payment_brand                  ← payment.payment_brand
payment_reference (NEW)        ← payment.payment_reference
payment_card_number (NEW)      ← payment.payment_card_number
bank_fee                       ← calculated from payment_methods table
company                        ← header.company
status                         ← header.status
status_description             ← header.status_description
is_point                       ← header.is_point
point_value                    ← header.point_value
media                          ← header.media
profit_center                  ← header.profit_center
payment_term                   ← header.payment_term
transaction_type               ← header.transaction_type
trans_type                     ← 'automatic'
```

## Implementation Steps

### Step 1: Database migration
- Add `payment_reference` and `payment_card_number` to `purpletransaction`
- Add `is_processed` to `sales_order_header`

### Step 2: Create edge function `process-api-to-transactions`
Logic:
1. Query unprocessed `sales_order_header` where `is_processed = false` AND `order_date >= '2025-03-11'`
2. For each header, fetch related `sales_order_line` and `payment_transactions` by `order_number`
3. Skip orders missing lines or payments
4. Lookup customer name from `customers` by phone → if not found, use `'Not Defined'`
5. Lookup product/brand info from `products` by SKU
6. Calculate `bank_fee` from `payment_methods` table using `payment_method` (same as payment_type)
7. Build one `purpletransaction` row per sales line, with payment info duplicated across lines
8. Upsert into `purpletransaction` (conflict on order_number + product_id)
9. Upsert `ordertotals` with aggregated order data + bank fees
10. Mark header as `is_processed = true`

### Step 3: Auto-trigger from API endpoints
- After each `api-payment` call, check if header + lines + payment all exist for that order
- If complete, invoke `process-api-to-transactions` for that order

### Step 4: Add manual trigger UI
- Button on API Integration Status page to process all pending API orders

### Files to Create/Modify
- **New**: `supabase/functions/process-api-to-transactions/index.ts`
- **Modify**: `supabase/functions/api-payment/index.ts` (auto-trigger)
- **Modify**: `src/pages/ApiIntegrationStatus.tsx` (manual trigger button)
- **Migration**: Add columns to `purpletransaction` and `sales_order_header`
