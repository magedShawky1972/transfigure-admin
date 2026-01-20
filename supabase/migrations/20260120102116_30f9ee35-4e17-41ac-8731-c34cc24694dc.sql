-- Add created_at_int column to order_payment table
ALTER TABLE public.order_payment ADD COLUMN IF NOT EXISTS created_at_int INTEGER;

-- Create function to calculate YYYYMMDD integer from timestamp
CREATE OR REPLACE FUNCTION public.set_order_payment_created_at_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.create_at IS NOT NULL THEN
    NEW.created_at_int := CAST(TO_CHAR(NEW.create_at, 'YYYYMMDD') AS INTEGER);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate created_at_int on INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_set_order_payment_created_at_int_from_create_at ON public.order_payment;
CREATE TRIGGER trigger_set_order_payment_created_at_int_from_create_at
BEFORE INSERT OR UPDATE ON public.order_payment
FOR EACH ROW
EXECUTE FUNCTION public.set_order_payment_created_at_int();

-- Backfill existing data
UPDATE public.order_payment 
SET created_at_int = CAST(TO_CHAR(create_at, 'YYYYMMDD') AS INTEGER)
WHERE create_at IS NOT NULL AND created_at_int IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_payment_created_at_int ON public.order_payment(created_at_int);