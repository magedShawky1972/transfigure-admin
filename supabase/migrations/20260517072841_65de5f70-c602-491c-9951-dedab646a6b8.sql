ALTER TABLE public.purpletransaction
  ADD COLUMN IF NOT EXISTS sales_reference text,
  ADD COLUMN IF NOT EXISTS sales_person text;