-- Add unique constraint on ordernumber alone for fast native upsert
ALTER TABLE public.order_payment ADD CONSTRAINT order_payment_ordernumber_unique UNIQUE (ordernumber);

-- Create function to auto-calculate created_at_int from create_at
CREATE OR REPLACE FUNCTION public.set_order_payment_created_at_int_from_create_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.create_at IS NOT NULL THEN
    NEW.created_at_int := TO_CHAR(NEW.create_at, 'YYYYMMDD')::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-populate created_at_int
CREATE TRIGGER trigger_set_order_payment_created_at_int_from_create_at
BEFORE INSERT OR UPDATE ON public.order_payment
FOR EACH ROW
EXECUTE FUNCTION public.set_order_payment_created_at_int_from_create_at();