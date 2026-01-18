-- Add unique constraint on ordernumber column to enable proper upsert behavior
ALTER TABLE public.order_payment 
ADD CONSTRAINT order_payment_ordernumber_key UNIQUE (ordernumber);