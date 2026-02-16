
CREATE OR REPLACE FUNCTION public.set_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute order_date_int from order_date (actual order date), not created_at
  IF NEW.order_date IS NOT NULL THEN
    NEW.order_date_int := to_char(NEW.order_date AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD')::integer;
  ELSIF NEW.created_at IS NOT NULL THEN
    NEW.order_date_int := to_char(NEW.created_at AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD')::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
