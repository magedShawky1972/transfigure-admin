CREATE OR REPLACE FUNCTION public.set_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  -- order_date is already stored in KSA time, no timezone conversion needed
  IF NEW.order_date IS NOT NULL THEN
    NEW.order_date_int := to_char(NEW.order_date, 'YYYYMMDD')::integer;
  ELSIF NEW.created_at IS NOT NULL THEN
    NEW.order_date_int := to_char(NEW.created_at AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD')::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;