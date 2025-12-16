-- Add UPDATE policy for authenticated users on suppliers table
CREATE POLICY "Authenticated users can update suppliers"
ON public.suppliers
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add INSERT policy for authenticated users on suppliers table  
CREATE POLICY "Authenticated users can insert suppliers"
ON public.suppliers
FOR INSERT
WITH CHECK (true);