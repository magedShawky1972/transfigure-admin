
-- Drop the old 2-parameter version to resolve ambiguity
DROP FUNCTION IF EXISTS public.transactions_summary(date, date);
