-- Allow admins to create shift sessions for any user
CREATE POLICY "Admins can create shift sessions for any user"
ON public.shift_sessions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));