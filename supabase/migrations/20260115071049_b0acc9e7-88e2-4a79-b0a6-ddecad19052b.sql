-- Add transfer-related columns to bank_entries
ALTER TABLE public.bank_entries
ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS to_bank_id UUID REFERENCES public.banks(id),
ADD COLUMN IF NOT EXISTS to_treasury_id UUID REFERENCES public.treasuries(id),
ADD COLUMN IF NOT EXISTS from_currency_id UUID REFERENCES public.currencies(id),
ADD COLUMN IF NOT EXISTS to_currency_id UUID REFERENCES public.currencies(id),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS converted_amount NUMERIC,
ADD COLUMN IF NOT EXISTS bank_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_charges NUMERIC DEFAULT 0;

-- Add transfer-related columns to treasury_entries
ALTER TABLE public.treasury_entries
ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS to_treasury_id UUID REFERENCES public.treasuries(id),
ADD COLUMN IF NOT EXISTS to_bank_id UUID REFERENCES public.banks(id),
ADD COLUMN IF NOT EXISTS from_currency_id UUID REFERENCES public.currencies(id),
ADD COLUMN IF NOT EXISTS to_currency_id UUID REFERENCES public.currencies(id),
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS converted_amount NUMERIC,
ADD COLUMN IF NOT EXISTS bank_charges NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_charges NUMERIC DEFAULT 0;