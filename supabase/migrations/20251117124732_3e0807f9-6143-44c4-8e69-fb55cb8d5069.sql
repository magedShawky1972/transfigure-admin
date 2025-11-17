-- Add brand_code column to purpletransaction
ALTER TABLE public.purpletransaction 
ADD COLUMN brand_code text;

-- Update existing records with brand_code from brands table
UPDATE public.purpletransaction pt
SET brand_code = b.brand_code
FROM public.brands b
WHERE pt.brand_name = b.brand_name;