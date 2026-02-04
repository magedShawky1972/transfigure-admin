-- Add allow_negative_balance column to banks table for credit cards
ALTER TABLE public.banks 
ADD COLUMN IF NOT EXISTS allow_negative_balance boolean DEFAULT false;