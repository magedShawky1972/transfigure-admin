-- Add validation flags to excel_sheets table
ALTER TABLE public.excel_sheets 
ADD COLUMN IF NOT EXISTS check_customer boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS check_brand boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS check_product boolean NOT NULL DEFAULT true;