-- Create a function to update total values based on excel_dates
CREATE OR REPLACE FUNCTION update_upload_log_totals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  log_record RECORD;
  dates_array text[];
  total_sum numeric;
BEGIN
  -- Loop through all completed upload logs
  FOR log_record IN 
    SELECT id, excel_dates 
    FROM public.upload_logs 
    WHERE status = 'completed' 
      AND excel_dates IS NOT NULL
      AND jsonb_array_length(excel_dates) > 0
  LOOP
    -- Convert jsonb array to text array
    SELECT ARRAY(SELECT jsonb_array_elements_text(log_record.excel_dates)) INTO dates_array;
    
    -- Calculate total value for transactions on those dates
    SELECT COALESCE(SUM(total), 0)
    INTO total_sum
    FROM public.purpletransaction
    WHERE created_at_date::date = ANY(dates_array::date[]);
    
    -- Update the upload log
    UPDATE public.upload_logs
    SET total_value = total_sum
    WHERE id = log_record.id;
  END LOOP;
END;
$$;

-- Execute the function to update existing records
SELECT update_upload_log_totals();

-- Drop the function as it's no longer needed
DROP FUNCTION update_upload_log_totals();