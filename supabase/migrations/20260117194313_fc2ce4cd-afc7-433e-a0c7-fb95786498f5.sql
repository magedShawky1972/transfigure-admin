-- Add order_date_int column to ordertotals table
ALTER TABLE public.ordertotals 
ADD COLUMN IF NOT EXISTS order_date_int INTEGER;

-- Create function to compute order_date_int from order_date
CREATE OR REPLACE FUNCTION public.compute_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_date IS NOT NULL THEN
    NEW.order_date_int := TO_CHAR(NEW.order_date::date, 'YYYYMMDD')::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-compute order_date_int on insert/update
DROP TRIGGER IF EXISTS trigger_compute_order_date_int ON public.ordertotals;
CREATE TRIGGER trigger_compute_order_date_int
BEFORE INSERT OR UPDATE OF order_date ON public.ordertotals
FOR EACH ROW
EXECUTE FUNCTION public.compute_order_date_int();

-- Update existing rows to populate order_date_int
UPDATE public.ordertotals 
SET order_date_int = TO_CHAR(order_date::date, 'YYYYMMDD')::INTEGER
WHERE order_date IS NOT NULL AND order_date_int IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ordertotals_order_date_int ON public.ordertotals(order_date_int);