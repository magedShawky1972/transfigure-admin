CREATE TABLE IF NOT EXISTS public.menu_customizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('group','item')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  name_en TEXT,
  name_ar TEXT,
  hidden BOOLEAN NOT NULL DEFAULT false,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read menu customizations"
ON public.menu_customizations FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins can insert menu customizations"
ON public.menu_customizations FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update menu customizations"
ON public.menu_customizations FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete menu customizations"
ON public.menu_customizations FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_menu_customizations_updated_at
BEFORE UPDATE ON public.menu_customizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_menu_customizations_kind ON public.menu_customizations(kind);