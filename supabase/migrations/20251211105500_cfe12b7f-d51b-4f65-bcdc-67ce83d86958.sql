-- Add opening balance and opening image path columns to shift_brand_balances
ALTER TABLE public.shift_brand_balances 
ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS opening_image_path text;

-- Add comment to explain the columns
COMMENT ON COLUMN public.shift_brand_balances.opening_balance IS 'Brand balance at shift opening';
COMMENT ON COLUMN public.shift_brand_balances.opening_image_path IS 'Image path for opening balance documentation';