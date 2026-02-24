
-- Add purchase_order_id to receiving_coins_header to link auto-created entries
ALTER TABLE public.receiving_coins_header 
ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.coins_purchase_orders(id);

-- Add index for fast lookup during rollback cleanup
CREATE INDEX IF NOT EXISTS idx_receiving_coins_header_purchase_order_id 
ON public.receiving_coins_header(purchase_order_id);
