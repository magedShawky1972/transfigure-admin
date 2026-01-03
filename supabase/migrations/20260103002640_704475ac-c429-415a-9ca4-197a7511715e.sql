
-- Add SELECT policies for critical dashboard tables that were missed

-- 1. purpletransaction - Allow authenticated users to view transactions
CREATE POLICY "Authenticated users can view transactions"
ON public.purpletransaction
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2. shifts - Allow authenticated users to view shifts
CREATE POLICY "Authenticated users can view shifts"
ON public.shifts
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. shift_assignments - Allow authenticated users to view assignments
CREATE POLICY "Authenticated users can view shift assignments"
ON public.shift_assignments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 4. tickets - Allow authenticated users to view non-deleted tickets
CREATE POLICY "Authenticated users can view tickets for dashboard"
ON public.tickets
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND is_deleted = false);

-- 5. tasks - Allow authenticated to view all tasks
CREATE POLICY "Authenticated users can view all tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 6. projects - Allow authenticated to view projects
CREATE POLICY "Authenticated users can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 7. customers - Allow authenticated to view customers
CREATE POLICY "Authenticated users can view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 8. brand_type - Allow authenticated to view brand types
CREATE POLICY "Authenticated users can view brand types"
ON public.brand_type
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 9. departments - Allow all authenticated to view (not just active)
CREATE POLICY "Authenticated users can view all departments"
ON public.departments
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 10. employees - Allow authenticated to view for dashboards
CREATE POLICY "Authenticated users can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 11. timesheets - Allow authenticated to view
CREATE POLICY "Authenticated users can view timesheets"
ON public.timesheets
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 12. project_members - Allow authenticated to view
CREATE POLICY "Authenticated users can view project members"
ON public.project_members
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
