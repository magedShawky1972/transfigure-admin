-- Fix RLS policy for user_permissions UPDATE to include WITH CHECK
DROP POLICY IF EXISTS "Admins can update permissions" ON public.user_permissions;

CREATE POLICY "Admins can update permissions"
ON public.user_permissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));