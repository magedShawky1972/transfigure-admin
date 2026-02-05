-- Add Order_Date_int column to sales_order_header table
ALTER TABLE public.sales_order_header 
ADD COLUMN IF NOT EXISTS order_date_int INTEGER;

-- Create function to calculate date integer from created_at
CREATE OR REPLACE FUNCTION public.calculate_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_date_int := TO_CHAR(NEW.created_at AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD')::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to automatically set order_date_int on insert/update
DROP TRIGGER IF EXISTS set_order_date_int ON public.sales_order_header;
CREATE TRIGGER set_order_date_int
  BEFORE INSERT OR UPDATE OF created_at ON public.sales_order_header
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_order_date_int();

-- Update existing records with calculated order_date_int
UPDATE public.sales_order_header 
SET order_date_int = TO_CHAR(created_at AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD')::INTEGER
WHERE order_date_int IS NULL;

-- Create index for performance on date filtering
CREATE INDEX IF NOT EXISTS idx_sales_order_header_order_date_int 
ON public.sales_order_header(order_date_int);