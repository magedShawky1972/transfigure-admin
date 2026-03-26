ALTER TABLE public.purpletransaction
ADD COLUMN IF NOT EXISTS source text;

UPDATE public.purpletransaction
SET source = CASE
  WHEN source IS NOT NULL THEN source
  WHEN order_number IS NOT NULL
    AND line_no IS NOT NULL
    AND ordernumber = concat(order_number, '-', line_no::text) THEN 'API'
  ELSE 'EXCEL'
END
WHERE source IS NULL;

ALTER TABLE public.purpletransaction
ALTER COLUMN source SET DEFAULT 'EXCEL';

ALTER TABLE public.purpletransaction
ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purpletransaction_source_check'
      AND conrelid = 'public.purpletransaction'::regclass
  ) THEN
    ALTER TABLE public.purpletransaction
    ADD CONSTRAINT purpletransaction_source_check
    CHECK (source IN ('API', 'EXCEL'));
  END IF;
END $$;