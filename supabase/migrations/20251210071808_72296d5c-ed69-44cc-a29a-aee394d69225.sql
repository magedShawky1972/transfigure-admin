-- Add currency_id column to tickets table for purchase tickets
ALTER TABLE public.tickets 
ADD COLUMN currency_id uuid REFERENCES public.currencies(id);