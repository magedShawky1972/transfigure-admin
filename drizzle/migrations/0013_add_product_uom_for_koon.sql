ALTER TABLE public.products ADD COLUMN IF NOT EXISTS uom TEXT;
COMMENT ON COLUMN public.products.uom IS 'Unit of measure sent by the product API and KOON product backfill.';