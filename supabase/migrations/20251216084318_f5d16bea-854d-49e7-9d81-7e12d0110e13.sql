-- Add SELECT policy for authenticated users to view suppliers
CREATE POLICY "Authenticated users can view suppliers"
ON public.suppliers
FOR SELECT
USING (true);