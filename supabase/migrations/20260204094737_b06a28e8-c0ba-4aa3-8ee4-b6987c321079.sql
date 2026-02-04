-- Add paymentbrand column to order_payment table
ALTER TABLE public.order_payment 
ADD COLUMN IF NOT EXISTS paymentbrand TEXT;