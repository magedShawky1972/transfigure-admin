-- Add unique constraint for upsert operations on order_payment
ALTER TABLE public.order_payment 
ADD CONSTRAINT order_payment_ordernumber_created_at_int_unique 
UNIQUE (ordernumber, created_at_int);