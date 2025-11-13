-- Add email column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS email text;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.email IS 'Customer email address';