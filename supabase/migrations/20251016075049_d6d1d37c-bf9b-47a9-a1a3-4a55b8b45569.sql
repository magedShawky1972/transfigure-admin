-- Create index on customers table for customer_phone column
CREATE INDEX IF NOT EXISTS idx_customers_customer_phone 
ON public.customers(customer_phone);

-- Create index on purpletransaction table for customer_phone column
CREATE INDEX IF NOT EXISTS idx_purpletransaction_customer_phone 
ON public.purpletransaction(customer_phone);