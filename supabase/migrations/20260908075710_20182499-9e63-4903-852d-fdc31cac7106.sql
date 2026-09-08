ALTER TABLE public.sajel_erp_settings ADD COLUMN IF NOT EXISTS chart_of_account_api_url TEXT;

COMMENT ON COLUMN public.sajel_erp_settings.chart_of_account_api_url IS 'Sajel Chart Of Account API endpoint URL';