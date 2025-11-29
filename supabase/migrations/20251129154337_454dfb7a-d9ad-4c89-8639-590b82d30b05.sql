-- Allow users to delete their own shift sessions (for rollback)
CREATE POLICY "Users can delete their own shift sessions"
ON public.shift_sessions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());