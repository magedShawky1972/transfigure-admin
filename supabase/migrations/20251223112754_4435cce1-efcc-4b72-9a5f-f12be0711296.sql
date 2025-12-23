-- Add Salla order number columns to shift_sessions table
ALTER TABLE public.shift_sessions 
ADD COLUMN IF NOT EXISTS salla_first_order_number TEXT,
ADD COLUMN IF NOT EXISTS salla_last_order_number TEXT;