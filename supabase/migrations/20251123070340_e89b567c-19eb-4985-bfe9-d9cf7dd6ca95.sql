-- Create shift_types table
CREATE TABLE IF NOT EXISTS public.shift_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_name TEXT NOT NULL,
  shift_start_time TIME NOT NULL,
  shift_end_time TIME NOT NULL,
  shift_type_id UUID REFERENCES public.shift_types(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift_job_positions junction table (many-to-many)
CREATE TABLE IF NOT EXISTS public.shift_job_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  job_position_id UUID NOT NULL REFERENCES public.job_positions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shift_id, job_position_id)
);

-- Enable RLS
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_job_positions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_types
CREATE POLICY "Authenticated users can view shift types"
  ON public.shift_types FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shift types"
  ON public.shift_types FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for shifts
CREATE POLICY "Authenticated users can view shifts"
  ON public.shifts FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shifts"
  ON public.shifts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for shift_job_positions
CREATE POLICY "Authenticated users can view shift job positions"
  ON public.shift_job_positions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shift job positions"
  ON public.shift_job_positions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_shift_types_updated_at
  BEFORE UPDATE ON public.shift_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default shift types
INSERT INTO public.shift_types (type_name) VALUES
  ('Morning'),
  ('Evening'),
  ('Night'),
  ('Rotating'),
  ('Split')
ON CONFLICT (type_name) DO NOTHING;