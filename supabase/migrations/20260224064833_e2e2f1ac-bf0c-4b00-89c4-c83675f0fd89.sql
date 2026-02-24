
-- Add supplier_id to receiving_coins_line
ALTER TABLE public.receiving_coins_line 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);
