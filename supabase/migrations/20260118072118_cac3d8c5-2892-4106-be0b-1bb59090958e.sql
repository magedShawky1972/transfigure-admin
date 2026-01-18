-- Add paymentrefrence column to bank_ledger table
ALTER TABLE public.bank_ledger 
ADD COLUMN IF NOT EXISTS paymentrefrence TEXT;