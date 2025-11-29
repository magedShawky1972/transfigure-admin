-- Add RLS policy for shift admins to view all shift sessions
CREATE POLICY "Shift admins can view all shift sessions"
ON public.shift_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shift_admins sa
    WHERE sa.user_id = auth.uid()
  )
);