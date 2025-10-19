-- Trim existing whitespace and add triggers to keep it clean
-- 1) One-time cleanup
UPDATE public.customers
SET customer_phone = btrim(customer_phone),
    customer_name = btrim(customer_name);

UPDATE public.purpletransaction
SET customer_phone = btrim(customer_phone),
    customer_name = btrim(customer_name);

-- 2) Triggers to enforce trimming on future writes
CREATE OR REPLACE FUNCTION public.trim_whitespace_customers()
RETURNS trigger AS $$
BEGIN
  IF NEW.customer_phone IS NOT NULL THEN
    NEW.customer_phone = btrim(NEW.customer_phone);
  END IF;
  IF NEW.customer_name IS NOT NULL THEN
    NEW.customer_name = btrim(NEW.customer_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_trim_whitespace_customers ON public.customers;
CREATE TRIGGER trg_trim_whitespace_customers
BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.trim_whitespace_customers();

CREATE OR REPLACE FUNCTION public.trim_whitespace_purpletransaction()
RETURNS trigger AS $$
BEGIN
  IF NEW.customer_phone IS NOT NULL THEN
    NEW.customer_phone = btrim(NEW.customer_phone);
  END IF;
  IF NEW.customer_name IS NOT NULL THEN
    NEW.customer_name = btrim(NEW.customer_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_trim_whitespace_purpletransaction ON public.purpletransaction;
CREATE TRIGGER trg_trim_whitespace_purpletransaction
BEFORE INSERT OR UPDATE ON public.purpletransaction
FOR EACH ROW EXECUTE FUNCTION public.trim_whitespace_purpletransaction();