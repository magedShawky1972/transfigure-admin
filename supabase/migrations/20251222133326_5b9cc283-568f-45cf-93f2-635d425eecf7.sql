-- Add first and last order number fields to shift_sessions table
ALTER TABLE public.shift_sessions 
ADD COLUMN first_order_number text DEFAULT NULL,
ADD COLUMN last_order_number text DEFAULT NULL;