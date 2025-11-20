-- Drop existing column and index if they exist
DROP INDEX IF EXISTS idx_purpletransaction_date_int;
ALTER TABLE public.purpletransaction DROP COLUMN IF EXISTS created_at_date_int;

-- Add computed column that formats created_at_date as yyyymmdd integer
-- The multiplication ensures proper digit placement (e.g., 2025-01-20 becomes 20250120)
ALTER TABLE public.purpletransaction 
ADD COLUMN created_at_date_int BIGINT 
GENERATED ALWAYS AS (
  CAST(
    EXTRACT(YEAR FROM created_at_date)::int * 10000 + 
    EXTRACT(MONTH FROM created_at_date)::int * 100 + 
    EXTRACT(DAY FROM created_at_date)::int
  AS BIGINT)
) STORED;

-- Create index for performance
CREATE INDEX idx_purpletransaction_date_int ON public.purpletransaction(created_at_date_int);