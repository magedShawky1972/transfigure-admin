-- Add expected_number column to brand_closing_training table for training verification
ALTER TABLE public.brand_closing_training 
ADD COLUMN expected_number numeric NULL;