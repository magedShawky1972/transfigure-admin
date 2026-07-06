
CREATE TABLE public.sajel_erp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key TEXT,
  ap_invoice_api_url TEXT,
  payment_api_url TEXT,
  one_step_combined_transaction_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sajel_erp_settings TO authenticated;
GRANT ALL ON public.sajel_erp_settings TO service_role;

ALTER TABLE public.sajel_erp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view sajel erp settings"
ON public.sajel_erp_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert sajel erp settings"
ON public.sajel_erp_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update sajel erp settings"
ON public.sajel_erp_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete sajel erp settings"
ON public.sajel_erp_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sajel_erp_settings_updated_at
BEFORE UPDATE ON public.sajel_erp_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
