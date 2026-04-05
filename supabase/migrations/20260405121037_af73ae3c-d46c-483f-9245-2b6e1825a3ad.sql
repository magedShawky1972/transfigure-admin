
-- Add the new column
ALTER TABLE public.purpletransaction ADD COLUMN IF NOT EXISTS created_at_date_int_utc INTEGER;

-- Create trigger function to compute UTC date int
CREATE OR REPLACE FUNCTION public.compute_created_at_date_int_utc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.created_at_date IS NOT NULL THEN
    NEW.created_at_date_int_utc := TO_CHAR(
      NEW.created_at_date::timestamptz AT TIME ZONE 'UTC',
      'YYYYMMDD'
    )::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_compute_created_at_date_int_utc ON public.purpletransaction;
CREATE TRIGGER trg_compute_created_at_date_int_utc
  BEFORE INSERT OR UPDATE OF created_at_date
  ON public.purpletransaction
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_created_at_date_int_utc();

-- Backfill existing data
UPDATE public.purpletransaction
SET created_at_date_int_utc = TO_CHAR(
  created_at_date::timestamptz AT TIME ZONE 'UTC',
  'YYYYMMDD'
)::INTEGER
WHERE created_at_date IS NOT NULL AND created_at_date_int_utc IS NULL;
