-- Add transaction_receipt column to bank_ledger table
ALTER TABLE public.bank_ledger 
ADD COLUMN IF NOT EXISTS transaction_receipt TEXT;