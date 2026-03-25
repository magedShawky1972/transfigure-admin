-- Add line_no column with default 1
ALTER TABLE public.purpletransaction ADD COLUMN line_no INTEGER NOT NULL DEFAULT 1;

-- Drop the old unique constraint on ordernumber only
ALTER TABLE public.purpletransaction DROP CONSTRAINT IF EXISTS purpletransaction_ordernumber_unique;

-- Create new unique constraint on ordernumber + line_no
ALTER TABLE public.purpletransaction ADD CONSTRAINT purpletransaction_ordernumber_lineno_unique UNIQUE (ordernumber, line_no);

-- Backfill existing duplicate ordernumber rows with sequential line_no
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY ordernumber ORDER BY created_at, id) AS rn
  FROM public.purpletransaction
)
UPDATE public.purpletransaction pt
SET line_no = n.rn
FROM numbered n
WHERE pt.id = n.id AND n.rn > 1;