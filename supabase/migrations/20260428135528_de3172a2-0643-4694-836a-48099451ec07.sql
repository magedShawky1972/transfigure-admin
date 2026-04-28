-- Ensure brand_code column exists (already exists per schema; safe-guard)
ALTER TABLE public.purpletransaction
  ADD COLUMN IF NOT EXISTS brand_code text;

-- Trigger function: derive brand_code from products by product_id
CREATE OR REPLACE FUNCTION public.set_purpletransaction_brand_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.brand_code
      INTO NEW.brand_code
    FROM public.products p
    WHERE p.product_id = NEW.product_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_brand_code_on_purpletransaction ON public.purpletransaction;

CREATE TRIGGER trg_set_brand_code_on_purpletransaction
BEFORE INSERT OR UPDATE OF product_id ON public.purpletransaction
FOR EACH ROW
EXECUTE FUNCTION public.set_purpletransaction_brand_code();

-- One-time backfill from products by product_id
UPDATE public.purpletransaction t
SET brand_code = p.brand_code
FROM public.products p
WHERE t.product_id IS NOT NULL
  AND t.product_id = p.product_id
  AND (t.brand_code IS DISTINCT FROM p.brand_code);

CREATE INDEX IF NOT EXISTS idx_purpletransaction_brand_code
  ON public.purpletransaction (brand_code);