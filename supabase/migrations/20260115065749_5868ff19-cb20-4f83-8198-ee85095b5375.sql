-- Add detailed pricing fields to expense_requests
ALTER TABLE public.expense_requests 
ADD COLUMN IF NOT EXISTS purchase_item_id UUID REFERENCES public.purchase_items(id),
ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES public.uom(id),
ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_total NUMERIC DEFAULT 0;