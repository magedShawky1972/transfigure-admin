
-- Add order_date_int to sales_order_line
ALTER TABLE public.sales_order_line ADD COLUMN IF NOT EXISTS order_date_int integer;

-- Add order_date_int to payment_transactions
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS order_date_int integer;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sales_order_line_order_date_int ON public.sales_order_line(order_date_int);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_date_int ON public.payment_transactions(order_date_int);

-- Trigger function: auto-set order_date_int from sales_order_header on sales_order_line
CREATE OR REPLACE FUNCTION public.set_salesline_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    SELECT order_date_int INTO NEW.order_date_int
    FROM public.sales_order_header
    WHERE order_number = NEW.order_number
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: auto-set order_date_int from sales_order_header on payment_transactions
CREATE OR REPLACE FUNCTION public.set_payment_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NOT NULL THEN
    SELECT order_date_int INTO NEW.order_date_int
    FROM public.sales_order_header
    WHERE order_number = NEW.order_number
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS set_salesline_order_date_int_trigger ON public.sales_order_line;
CREATE TRIGGER set_salesline_order_date_int_trigger
  BEFORE INSERT OR UPDATE OF order_number ON public.sales_order_line
  FOR EACH ROW
  EXECUTE FUNCTION public.set_salesline_order_date_int();

DROP TRIGGER IF EXISTS set_payment_order_date_int_trigger ON public.payment_transactions;
CREATE TRIGGER set_payment_order_date_int_trigger
  BEFORE INSERT OR UPDATE OF order_number ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payment_order_date_int();

-- Also propagate when sales_order_header.order_date_int changes
CREATE OR REPLACE FUNCTION public.propagate_order_date_int()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_date_int IS DISTINCT FROM OLD.order_date_int THEN
    UPDATE public.sales_order_line SET order_date_int = NEW.order_date_int WHERE order_number = NEW.order_number;
    UPDATE public.payment_transactions SET order_date_int = NEW.order_date_int WHERE order_number = NEW.order_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS propagate_order_date_int_trigger ON public.sales_order_header;
CREATE TRIGGER propagate_order_date_int_trigger
  AFTER UPDATE OF order_date_int ON public.sales_order_header
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_order_date_int();
