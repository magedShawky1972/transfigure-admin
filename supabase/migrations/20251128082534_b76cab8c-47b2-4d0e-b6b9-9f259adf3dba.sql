-- Drop the unique constraint on brand_id to allow multiple images per brand
ALTER TABLE public.brand_closing_training DROP CONSTRAINT IF EXISTS brand_closing_training_brand_id_fkey;
ALTER TABLE public.brand_closing_training DROP CONSTRAINT IF EXISTS brand_closing_training_brand_id_key;

-- Add foreign key back without unique constraint
ALTER TABLE public.brand_closing_training 
ADD CONSTRAINT brand_closing_training_brand_id_fkey 
FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;

-- Add a description column to store image metadata (device type, mode, etc.)
ALTER TABLE public.brand_closing_training 
ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS display_mode TEXT DEFAULT 'unknown';