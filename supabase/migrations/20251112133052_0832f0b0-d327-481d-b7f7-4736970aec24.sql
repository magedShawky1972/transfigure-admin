-- Add leadtime field to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS leadtime numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.products.leadtime IS 'Lead time for product delivery in days';