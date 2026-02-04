-- Add paymentreference column (correct spelling for API compatibility)
ALTER TABLE public.order_payment 
ADD COLUMN IF NOT EXISTS paymentreference TEXT;