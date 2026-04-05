
-- Add UTC date int column
ALTER TABLE public.sales_order_header ADD COLUMN IF NOT EXISTS order_date_int_utc INTEGER;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.compute_order_date_int_utc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.created_at IS NOT NULL THEN
    NEW.order_date_int_utc := TO_CHAR(
      NEW.created_at AT TIME ZONE 'UTC',
      'YYYYMMDD'
    )::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_compute_order_date_int_utc ON public.sales_order_header;
CREATE TRIGGER trg_compute_order_date_int_utc
  BEFORE INSERT OR UPDATE OF created_at
  ON public.sales_order_header
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_order_date_int_utc();

-- Backfill existing data
UPDATE public.sales_order_header
SET order_date_int_utc = TO_CHAR(
  created_at AT TIME ZONE 'UTC',
  'YYYYMMDD'
)::INTEGER
WHERE created_at IS NOT NULL AND order_date_int_utc IS NULL;
