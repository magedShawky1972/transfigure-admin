
CREATE OR REPLACE FUNCTION public.generate_employee_request_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  seq_val INTEGER;
  new_number TEXT;
  today_prefix TEXT;
BEGIN
  today_prefix := 'ER-' || TO_CHAR(NOW() AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD') || '-';
  
  -- Lock the table to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('employee_request_number'));
  
  -- Get the max sequence for today
  SELECT COALESCE(MAX(
    CASE 
      WHEN request_number LIKE today_prefix || '%'
      THEN SUBSTRING(request_number FROM LENGTH(today_prefix) + 1)::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO seq_val
  FROM employee_requests;
  
  new_number := today_prefix || LPAD(seq_val::TEXT, 4, '0');
  
  NEW.request_number := new_number;
  RETURN NEW;
END;
$function$;
