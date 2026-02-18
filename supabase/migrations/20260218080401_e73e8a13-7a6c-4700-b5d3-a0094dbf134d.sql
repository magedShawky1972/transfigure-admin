-- Add unique constraint on order_number for upsert to work
CREATE UNIQUE INDEX idx_purpletransaction_temp_order_number ON public.purpletransaction_temp (order_number) WHERE order_number IS NOT NULL;