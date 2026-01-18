-- Add entry_date_int column for better performance
ALTER TABLE public.bank_ledger ADD COLUMN entry_date_int INTEGER;

-- Create index for the new column
CREATE INDEX idx_bank_ledger_entry_date_int ON public.bank_ledger(entry_date_int);

-- Create trigger function to auto-populate entry_date_int
CREATE OR REPLACE FUNCTION public.compute_bank_ledger_entry_date_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entry_date IS NOT NULL THEN
    NEW.entry_date_int := TO_CHAR(NEW.entry_date::date, 'YYYYMMDD')::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER set_bank_ledger_entry_date_int
  BEFORE INSERT OR UPDATE ON public.bank_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_bank_ledger_entry_date_int();

-- Backfill existing records
UPDATE public.bank_ledger 
SET entry_date_int = TO_CHAR(entry_date::date, 'YYYYMMDD')::INTEGER 
WHERE entry_date IS NOT NULL AND entry_date_int IS NULL;