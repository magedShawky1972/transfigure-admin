-- Create shift_admins table for tracking shift supervisors
CREATE TABLE public.shift_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  admin_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shift_id, user_id)
);

-- Enable RLS
ALTER TABLE public.shift_admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_admins
CREATE POLICY "Admins can manage shift admins"
  ON public.shift_admins FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view shift admins"
  ON public.shift_admins FOR SELECT
  USING (true);

-- Create index for performance
CREATE INDEX idx_shift_admins_shift_id ON public.shift_admins(shift_id);
CREATE INDEX idx_shift_admins_user_id ON public.shift_admins(user_id);