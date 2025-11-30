-- Create shift_hard_close_logs table
CREATE TABLE public.shift_hard_close_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  shift_assignment_id UUID NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  admin_user_name TEXT NOT NULL,
  shift_name TEXT NOT NULL,
  shift_date DATE NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_hard_close_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage hard close logs"
ON public.shift_hard_close_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Shift admins can view hard close logs"
ON public.shift_hard_close_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM shift_admins sa WHERE sa.user_id = auth.uid()
));