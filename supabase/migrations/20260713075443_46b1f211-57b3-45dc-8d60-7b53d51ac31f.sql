ALTER TABLE public.receiving_coins_header
  ADD COLUMN IF NOT EXISTS sent_to_accounting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_to_accounting_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS sent_to_accounting_by text,
  ADD COLUMN IF NOT EXISTS sajel_payload jsonb,
  ADD COLUMN IF NOT EXISTS sajel_response jsonb;