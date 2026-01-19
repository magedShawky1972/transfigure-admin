-- Drop existing unique constraint on ordernumber alone
ALTER TABLE public.order_payment DROP CONSTRAINT IF EXISTS order_payment_ordernumber_key;

-- Add new composite unique constraint on ordernumber + created_at_int
ALTER TABLE public.order_payment ADD CONSTRAINT order_payment_ordernumber_created_at_int_key 
  UNIQUE (ordernumber, created_at_int);