-- Add RLS policy for admins to update any shift session
CREATE POLICY "Admins can update any shift session"
ON public.shift_sessions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));