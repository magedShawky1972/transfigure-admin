-- Add missing columns to purpletransaction table only (testpurpletransaction doesn't exist)
ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS customer_ip TEXT;

ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;

ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS transaction_location TEXT;