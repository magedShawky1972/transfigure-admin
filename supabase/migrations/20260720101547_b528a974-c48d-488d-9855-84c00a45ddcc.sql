ALTER TABLE public.sajel_erp_settings ADD COLUMN IF NOT EXISTS stock_movement_api_url TEXT;

COMMENT ON COLUMN public.sajel_erp_settings.stock_movement_api_url IS 'URL for Sajel Stock Movement API';

GRANT SELECT, INSERT, UPDATE ON public.sajel_erp_settings TO authenticated;
GRANT ALL ON public.sajel_erp_settings TO service_role;