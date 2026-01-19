-- Add created_at_int column to order_payment table for yyyyMMdd format
ALTER TABLE public.order_payment 
ADD COLUMN IF NOT EXISTS created_at_int integer;

-- Create index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_order_payment_created_at_int ON public.order_payment(created_at_int);

-- Update existing rows to populate created_at_int from created_at
UPDATE public.order_payment 
SET created_at_int = CAST(TO_CHAR(created_at, 'YYYYMMDD') AS integer)
WHERE created_at IS NOT NULL AND created_at_int IS NULL;

-- Create trigger function to auto-populate created_at_int on insert/update
CREATE OR REPLACE FUNCTION public.set_order_payment_created_at_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at IS NOT NULL THEN
    NEW.created_at_int := CAST(TO_CHAR(NEW.created_at, 'YYYYMMDD') AS integer);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set created_at_int
DROP TRIGGER IF EXISTS trigger_set_order_payment_created_at_int ON public.order_payment;
CREATE TRIGGER trigger_set_order_payment_created_at_int
BEFORE INSERT OR UPDATE ON public.order_payment
FOR EACH ROW
EXECUTE FUNCTION public.set_order_payment_created_at_int();