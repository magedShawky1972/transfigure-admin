-- Add DELETE policy for employee_requests table
CREATE POLICY "Authenticated users can delete employee requests"
ON public.employee_requests
FOR DELETE
TO authenticated
USING (true);
