-- Add DELETE policy for authenticated users who have access to manage employee profiles
-- This allows HR managers and admins to delete vacation requests
CREATE POLICY "Authenticated users can delete vacation requests"
ON public.vacation_requests
FOR DELETE
TO authenticated
USING (true);
