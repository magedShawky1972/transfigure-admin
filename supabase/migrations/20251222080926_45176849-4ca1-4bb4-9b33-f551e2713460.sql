-- Add regular date-only columns (not generated) for hyberpaystatement and riyadbankstatement

-- 1. Add the columns
ALTER TABLE public.hyberpaystatement
ADD COLUMN IF NOT EXISTS request_date date;

ALTER TABLE public.riyadbankstatement
ADD COLUMN IF NOT EXISTS txn_date_only date;

-- 2. Create trigger function for hyberpaystatement
CREATE OR REPLACE FUNCTION public.set_hyberpay_request_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requesttimestamp IS NOT NULL THEN
    NEW.request_date := (NEW.requesttimestamp::timestamptz)::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. Create trigger for hyberpaystatement
DROP TRIGGER IF EXISTS trg_set_hyberpay_request_date ON public.hyberpaystatement;
CREATE TRIGGER trg_set_hyberpay_request_date
BEFORE INSERT OR UPDATE ON public.hyberpaystatement
FOR EACH ROW
EXECUTE FUNCTION public.set_hyberpay_request_date();

-- 4. Create trigger function for riyadbankstatement
CREATE OR REPLACE FUNCTION public.set_riyadbank_txn_date_only()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.txn_date IS NOT NULL THEN
    NEW.txn_date_only := to_date(split_part(NEW.txn_date, ' ', 1), 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Create trigger for riyadbankstatement
DROP TRIGGER IF EXISTS trg_set_riyadbank_txn_date_only ON public.riyadbankstatement;
CREATE TRIGGER trg_set_riyadbank_txn_date_only
BEFORE INSERT OR UPDATE ON public.riyadbankstatement
FOR EACH ROW
EXECUTE FUNCTION public.set_riyadbank_txn_date_only();

-- 6. Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_hyberpaystatement_request_date
ON public.hyberpaystatement (request_date);

CREATE INDEX IF NOT EXISTS idx_riyadbankstatement_txn_date_only
ON public.riyadbankstatement (txn_date_only);