ALTER TABLE public.supplier_advance_payments
ADD COLUMN IF NOT EXISTS sajel_request_body jsonb,
ADD COLUMN IF NOT EXISTS sajel_response jsonb,
ADD COLUMN IF NOT EXISTS sajel_error text,
ADD COLUMN IF NOT EXISTS sajel_sent_at timestamp with time zone;