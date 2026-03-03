
-- Drop the old INSERT policy
DROP POLICY "Employees can create own requests" ON public.employee_requests;

-- Create a new INSERT policy that allows:
-- 1. Employees creating their own requests
-- 2. Department managers creating requests for employees in their department
-- 3. HR managers creating requests for any employee
-- 4. Admins creating requests for any employee
CREATE POLICY "Employees and managers can create requests"
ON public.employee_requests
FOR INSERT
WITH CHECK (
  -- Own request
  employee_id IN (SELECT e.id FROM employees e WHERE e.user_id = auth.uid())
  -- Department manager with approve permission
  OR department_id IN (
    SELECT da.department_id FROM department_admins da
    WHERE da.user_id = auth.uid() AND da.approve_employee_request = true
  )
  -- HR manager
  OR EXISTS (
    SELECT 1 FROM hr_managers hm WHERE hm.user_id = auth.uid() AND hm.is_active = true
  )
  -- Admin
  OR EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role
  )
);
