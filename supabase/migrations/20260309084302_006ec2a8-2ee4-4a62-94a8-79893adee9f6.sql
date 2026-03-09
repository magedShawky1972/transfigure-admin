
CREATE OR REPLACE FUNCTION public.generate_employee_request_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  seq_val INTEGER;
  new_number TEXT;
BEGIN
  -- Use a safer approach: get max existing number for today + 1
  SELECT COALESCE(MAX(
    CASE 
      WHEN request_number LIKE 'ER-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%'
      THEN SUBSTRING(request_number FROM LENGTH('ER-YYYYMMDD-') + 1)::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO seq_val
  FROM employee_requests
  WHERE request_number LIKE 'ER-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-%';
  
  new_number := 'ER-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_val::TEXT, 4, '0');
  
  -- Safety: if still collides, append random suffix
  WHILE EXISTS (SELECT 1 FROM employee_requests WHERE request_number = new_number) LOOP
    seq_val := seq_val + 1;
    new_number := 'ER-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_val::TEXT, 4, '0');
  END LOOP;
  
  NEW.request_number := new_number;
  RETURN NEW;
END;
$function$;
