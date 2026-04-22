
CREATE TABLE IF NOT EXISTS public.brand_coin_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  reorder_point_at_report numeric,
  source text NOT NULL DEFAULT 'api',
  reported_at timestamptz NOT NULL DEFAULT now(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  notes text,
  triggered_alert boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_coin_balances_brand_id ON public.brand_coin_balances(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_coin_balances_reported_at ON public.brand_coin_balances(reported_at DESC);

ALTER TABLE public.brand_coin_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view brand coin balances"
ON public.brand_coin_balances FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage brand coin balances"
ON public.brand_coin_balances FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
