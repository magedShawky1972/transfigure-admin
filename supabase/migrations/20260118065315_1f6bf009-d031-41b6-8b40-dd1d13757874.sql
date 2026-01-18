-- Add new columns to bank_ledger for HyperPay statement data
ALTER TABLE public.bank_ledger 
ADD COLUMN IF NOT EXISTS transactionid TEXT,
ADD COLUMN IF NOT EXISTS result TEXT,
ADD COLUMN IF NOT EXISTS customercountry TEXT,
ADD COLUMN IF NOT EXISTS riskfrauddescription TEXT,
ADD COLUMN IF NOT EXISTS clearinginstitutename TEXT;

-- Create index on reference_number for faster matching with hyberpaystatement
CREATE INDEX IF NOT EXISTS idx_bank_ledger_reference_number ON public.bank_ledger(reference_number);

-- Create index on transaction_receipt in hyberpaystatement for faster matching
CREATE INDEX IF NOT EXISTS idx_hyberpaystatement_transaction_receipt ON public.hyberpaystatement(transaction_receipt);