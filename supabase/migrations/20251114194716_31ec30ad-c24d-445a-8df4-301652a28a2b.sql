-- Add brand_type_id column to brands table
ALTER TABLE public.brands 
ADD COLUMN brand_type_id UUID REFERENCES public.brand_type(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_brands_brand_type_id ON public.brands(brand_type_id);