
-- CRM Pipeline Stages
CREATE TABLE public.crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_name TEXT NOT NULL,
  stage_name_ar TEXT,
  stage_order INTEGER NOT NULL DEFAULT 0,
  stage_type TEXT NOT NULL DEFAULT 'both' CHECK (stage_type IN ('sales', 'support', 'both')),
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pipeline stages"
  ON public.crm_pipeline_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage pipeline stages"
  ON public.crm_pipeline_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default stages
INSERT INTO public.crm_pipeline_stages (stage_name, stage_name_ar, stage_order, color, is_closed) VALUES
  ('New', 'جديد', 1, '#6366f1', false),
  ('In Progress', 'قيد التنفيذ', 2, '#3b82f6', false),
  ('Waiting on Customer', 'بانتظار العميل', 3, '#f59e0b', false),
  ('Escalated', 'تم التصعيد', 4, '#ef4444', false),
  ('Resolved', 'تم الحل', 5, '#22c55e', true),
  ('Closed', 'مغلق', 6, '#64748b', true);

-- CRM Cases
CREATE TABLE public.crm_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  case_type TEXT NOT NULL DEFAULT 'support' CHECK (case_type IN ('sales', 'support')),
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  stage_id UUID REFERENCES public.crm_pipeline_stages(id),
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  brand_id UUID REFERENCES public.brands(id),
  product_id UUID,
  assigned_to UUID,
  assigned_to_name TEXT,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  ticket_id UUID,
  shift_session_id UUID,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cases"
  ON public.crm_cases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cases"
  ON public.crm_cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update cases"
  ON public.crm_cases FOR UPDATE TO authenticated USING (true);

-- Auto-generate case number
CREATE OR REPLACE FUNCTION public.generate_crm_case_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  counter := (SELECT COUNT(*) FROM public.crm_cases) + 1;
  new_number := 'CRM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  WHILE EXISTS (SELECT 1 FROM public.crm_cases WHERE case_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'CRM-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  END LOOP;
  RETURN new_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_crm_case_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := generate_crm_case_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_crm_case_number_trigger
  BEFORE INSERT ON public.crm_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_crm_case_number();

CREATE TRIGGER update_crm_cases_updated_at
  BEFORE UPDATE ON public.crm_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM Case Notes / Activity log
CREATE TABLE public.crm_case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.crm_cases(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'note' CHECK (note_type IN ('note', 'status_change', 'assignment', 'email', 'call', 'tawasoul', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_case_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read case notes"
  ON public.crm_case_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert case notes"
  ON public.crm_case_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- CRM Case Links (tickets, tasks, emails, shifts)
CREATE TABLE public.crm_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.crm_cases(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('ticket', 'task', 'email', 'shift', 'tawasoul')),
  linked_id TEXT NOT NULL,
  linked_title TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_case_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read case links"
  ON public.crm_case_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage case links"
  ON public.crm_case_links FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete case links"
  ON public.crm_case_links FOR DELETE TO authenticated USING (true);

-- Enable realtime for cases
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_cases;

-- Index for performance
CREATE INDEX idx_crm_cases_stage_id ON public.crm_cases(stage_id);
CREATE INDEX idx_crm_cases_assigned_to ON public.crm_cases(assigned_to);
CREATE INDEX idx_crm_cases_customer_id ON public.crm_cases(customer_id);
CREATE INDEX idx_crm_cases_case_type ON public.crm_cases(case_type);
CREATE INDEX idx_crm_case_notes_case_id ON public.crm_case_notes(case_id);
CREATE INDEX idx_crm_case_links_case_id ON public.crm_case_links(case_id);
