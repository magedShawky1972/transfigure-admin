ALTER TABLE public.sajel_erp_settings
ADD COLUMN IF NOT EXISTS ap_invoice_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS payment_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS one_step_combined_transaction_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS expense_entry_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS generate_batch_number_api_type text DEFAULT 'GET',
ADD COLUMN IF NOT EXISTS stock_issue_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS stock_movement_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS payroll_api_type text DEFAULT 'POST',
ADD COLUMN IF NOT EXISTS chart_of_account_api_type text DEFAULT 'GET';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sajel_erp_settings TO authenticated;
GRANT ALL ON public.sajel_erp_settings TO service_role;

ALTER TABLE public.sajel_erp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access to sajel_erp_settings" ON public.sajel_erp_settings;
CREATE POLICY "Allow authenticated full access to sajel_erp_settings"
ON public.sajel_erp_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);