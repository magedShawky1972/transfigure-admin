ALTER TABLE public.supplier_advance_payments
ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.banks(id);