
CREATE TABLE public.brand_coin_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  coin_value INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, coin_value)
);

CREATE INDEX idx_brand_coin_tiers_brand_id ON public.brand_coin_tiers(brand_id);

ALTER TABLE public.brand_coin_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view brand coin tiers"
ON public.brand_coin_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert brand coin tiers"
ON public.brand_coin_tiers FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update brand coin tiers"
ON public.brand_coin_tiers FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete brand coin tiers"
ON public.brand_coin_tiers FOR DELETE TO authenticated USING (true);
