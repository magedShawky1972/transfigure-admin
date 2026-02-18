
-- Drop the bad trigger that uses calculate_order_date_int()
DROP TRIGGER IF EXISTS set_order_date_int ON public.sales_order_header;
DROP TRIGGER IF EXISTS calculate_order_date_int ON public.sales_order_header;

-- Create correct trigger using set_order_date_int() which uses order_date
CREATE TRIGGER set_order_date_int
  BEFORE INSERT OR UPDATE OF order_date ON public.sales_order_header
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_date_int();
