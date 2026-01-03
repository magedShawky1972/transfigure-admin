
-- Add SELECT policies for authenticated users to view security dashboard data

-- 1. audit_logs - Allow authenticated users to view for security dashboard
CREATE POLICY "Authenticated users can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2. security_alerts_sent - Allow authenticated users to view
CREATE POLICY "Authenticated users can view security alerts"
ON public.security_alerts_sent
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. password_access_logs - Allow authenticated users to view
CREATE POLICY "Authenticated users can view password access logs"
ON public.password_access_logs
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
