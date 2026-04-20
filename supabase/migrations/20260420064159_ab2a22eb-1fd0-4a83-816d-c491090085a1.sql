DROP POLICY IF EXISTS "Users can view own scenarios" ON public.pricing_scenarios;
DROP POLICY IF EXISTS "Admins can view all scenarios" ON public.pricing_scenarios;
CREATE POLICY "Authenticated users can view all scenarios"
ON public.pricing_scenarios
FOR SELECT
TO authenticated
USING (true);