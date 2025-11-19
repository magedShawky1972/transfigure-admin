-- Ensure all RLS policies for user_permissions are correct for upsert operations
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can update permissions" ON public.user_permissions;

-- INSERT policy needs WITH CHECK for upsert to work
CREATE POLICY "Admins can insert permissions"
ON public.user_permissions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE policy needs both USING and WITH CHECK for upsert to work
CREATE POLICY "Admins can update permissions"
ON public.user_permissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));