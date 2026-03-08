
ALTER TABLE public.supplier_advance_payments 
  ADD COLUMN IF NOT EXISTS receiving_image text,
  ADD COLUMN IF NOT EXISTS receiving_notes text,
  ADD COLUMN IF NOT EXISTS sent_for_receiving boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_for_receiving_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_for_receiving_by text,
  ADD COLUMN IF NOT EXISTS accounting_recorded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accounting_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_recorded_by text;
