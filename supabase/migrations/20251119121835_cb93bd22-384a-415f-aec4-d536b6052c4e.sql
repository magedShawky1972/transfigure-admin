-- Allow authenticated users to view department admins (needed for ticket notifications)
CREATE POLICY "Authenticated users can view department admins"
ON public.department_admins
FOR SELECT
USING (true);