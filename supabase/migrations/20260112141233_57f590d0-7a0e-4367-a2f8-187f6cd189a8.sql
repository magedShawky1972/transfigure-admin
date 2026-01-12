-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Authenticated users can delete their own backups" ON public.system_backups;

-- Create a more permissive delete policy for authenticated users
CREATE POLICY "Authenticated users can delete backups" 
ON public.system_backups 
FOR DELETE 
USING (auth.uid() IS NOT NULL);