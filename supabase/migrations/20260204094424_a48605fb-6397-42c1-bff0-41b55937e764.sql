-- Add bank_transaction_id column to order_payment table
ALTER TABLE public.order_payment 
ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT;

-- Also add redemption_ip and payment_location columns if they don't exist
ALTER TABLE public.order_payment 
ADD COLUMN IF NOT EXISTS redemption_ip TEXT;

ALTER TABLE public.order_payment 
ADD COLUMN IF NOT EXISTS payment_location TEXT;