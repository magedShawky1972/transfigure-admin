-- Add SELECT policy for UOM table (it was missing)
CREATE POLICY "Authenticated users can view UOM" 
ON public.uom 
FOR SELECT 
USING (true);