
-- Table for company-wide WFH days (specific dates)
CREATE TABLE public.company_wfh_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wfh_date DATE NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for recurring weekly WFH patterns (e.g., every Sunday)
CREATE TABLE public.company_wfh_recurring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- RLS
ALTER TABLE public.company_wfh_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_wfh_recurring ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read WFH days" ON public.company_wfh_days
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage WFH days" ON public.company_wfh_days
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read WFH recurring" ON public.company_wfh_recurring
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage WFH recurring" ON public.company_wfh_recurring
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
