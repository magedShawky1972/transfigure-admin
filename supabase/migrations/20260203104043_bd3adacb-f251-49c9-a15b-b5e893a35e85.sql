-- Add customer_group column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS customer_group TEXT;

-- Add customer_group column to testcustomers table as well
ALTER TABLE public.testcustomers 
ADD COLUMN IF NOT EXISTS customer_group TEXT;

-- Add last_transaction column to customers table if missing
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS last_transaction TIMESTAMP WITH TIME ZONE;

-- Add last_transaction column to testcustomers table if missing
ALTER TABLE public.testcustomers 
ADD COLUMN IF NOT EXISTS last_transaction TIMESTAMP WITH TIME ZONE;