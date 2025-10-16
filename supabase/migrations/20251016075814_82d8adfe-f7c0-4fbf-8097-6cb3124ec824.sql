-- Create view for customers in transactions but not in customers table
CREATE OR REPLACE VIEW public.notin_customer_incustomer AS
SELECT 
  customer_phone,
  customer_name,
  MIN(created_at_date) as creation_date
FROM public.purpletransaction 
WHERE customer_phone NOT IN (SELECT customer_phone FROM public.customers)
GROUP BY customer_phone, customer_name;