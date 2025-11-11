-- Add partner_id column to customers table
ALTER TABLE public.customers 
ADD COLUMN partner_id integer;

-- Add index for faster lookups
CREATE INDEX idx_customers_partner_id ON public.customers(partner_id);