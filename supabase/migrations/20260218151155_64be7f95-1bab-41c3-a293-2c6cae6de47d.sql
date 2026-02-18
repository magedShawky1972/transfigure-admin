
-- Add brand_id to coins_purchase_receiving for per-brand image tracking
ALTER TABLE public.coins_purchase_receiving 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id);
