-- Add SELECT policy for brand_closing_training so authenticated users can view training data
CREATE POLICY "Authenticated users can view closing training" 
ON public.brand_closing_training 
FOR SELECT 
USING (true);

-- Add INSERT policy for authenticated users to add training images
CREATE POLICY "Authenticated users can insert closing training" 
ON public.brand_closing_training 
FOR INSERT 
WITH CHECK (true);

-- Add UPDATE policy for authenticated users to update training
CREATE POLICY "Authenticated users can update closing training" 
ON public.brand_closing_training 
FOR UPDATE 
USING (true);

-- Add DELETE policy for authenticated users to delete training
CREATE POLICY "Authenticated users can delete closing training" 
ON public.brand_closing_training 
FOR DELETE 
USING (true);