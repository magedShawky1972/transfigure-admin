-- Add company column to purpletransaction table
ALTER TABLE public.purpletransaction 
ADD COLUMN company text DEFAULT 'Purple';