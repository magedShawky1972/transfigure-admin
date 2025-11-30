-- Create table to log shift reopen actions
CREATE TABLE public.shift_reopen_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_session_id UUID NOT NULL REFERENCES shift_sessions(id) ON DELETE CASCADE,
  shift_assignment_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  admin_user_name TEXT NOT NULL,
  shift_name TEXT NOT NULL,
  shift_date DATE NOT NULL,
  reopened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_reopen_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage reopen logs
CREATE POLICY "Admins can manage shift reopen logs"
ON public.shift_reopen_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Shift admins can view reopen logs
CREATE POLICY "Shift admins can view reopen logs"
ON public.shift_reopen_logs
FOR SELECT
USING (EXISTS (SELECT 1 FROM shift_admins sa WHERE sa.user_id = auth.uid()));

-- Shift admins can insert reopen logs
CREATE POLICY "Shift admins can insert reopen logs"
ON public.shift_reopen_logs
FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM shift_admins sa WHERE sa.user_id = auth.uid()));