
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view companies"
ON public.companies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update companies"
ON public.companies FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete companies"
ON public.companies FOR DELETE
TO authenticated
USING (true);

CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companies (name) VALUES ('Purple'), ('Ish7an') ON CONFLICT DO NOTHING;
