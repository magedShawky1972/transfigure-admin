ALTER TABLE public.odoo_sync_run_details
  ADD COLUMN sajel_payload jsonb,
  ADD COLUMN sajel_response jsonb;

GRANT SELECT, INSERT, UPDATE ON public.odoo_sync_run_details TO authenticated;
GRANT ALL ON public.odoo_sync_run_details TO service_role;