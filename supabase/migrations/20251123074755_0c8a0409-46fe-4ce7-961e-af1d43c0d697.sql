-- Create shift_assignments table
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assignment_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view shift assignments"
  ON public.shift_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert shift assignments"
  ON public.shift_assignments
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update shift assignments"
  ON public.shift_assignments
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete shift assignments"
  ON public.shift_assignments
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_shift_assignments_updated_at
  BEFORE UPDATE ON public.shift_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_shift_assignments_date ON public.shift_assignments(assignment_date);
CREATE INDEX idx_shift_assignments_user ON public.shift_assignments(user_id);
CREATE INDEX idx_shift_assignments_shift ON public.shift_assignments(shift_id);