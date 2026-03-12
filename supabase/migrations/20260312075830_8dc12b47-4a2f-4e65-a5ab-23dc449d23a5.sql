
ALTER TABLE public.purpletransaction ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.purpletransaction ADD COLUMN IF NOT EXISTS payment_card_number text;
ALTER TABLE public.sales_order_header ADD COLUMN IF NOT EXISTS is_processed boolean DEFAULT false;
