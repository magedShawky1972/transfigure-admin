-- Update total_value for existing upload logs based on transaction data
UPDATE public.upload_logs
SET total_value = (
  SELECT COALESCE(SUM(total), 0)
  FROM public.purpletransaction
  WHERE created_at_date::date >= upload_logs.date_range_start::date
    AND created_at_date::date <= upload_logs.date_range_end::date
)
WHERE status = 'completed'
  AND date_range_start IS NOT NULL
  AND date_range_end IS NOT NULL;