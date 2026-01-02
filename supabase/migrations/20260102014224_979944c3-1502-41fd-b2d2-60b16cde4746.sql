-- Add SELECT policy for software_licenses so authenticated users can view licenses
CREATE POLICY "Authenticated users can view software licenses" 
ON public.software_licenses 
FOR SELECT 
TO authenticated
USING (true);