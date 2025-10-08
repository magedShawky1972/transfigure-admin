-- Allow users to update their own must_change_password flag
CREATE POLICY "Users can update their own password change flag"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());