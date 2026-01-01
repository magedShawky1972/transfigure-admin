-- Drop existing restrictive policies on system_backups
DROP POLICY IF EXISTS "Users can view system backups" ON public.system_backups;
DROP POLICY IF EXISTS "Admins can manage system backups" ON public.system_backups;

-- Create new policies that allow authenticated users to manage their own backups
CREATE POLICY "Authenticated users can view system backups" 
ON public.system_backups 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create system backups" 
ON public.system_backups 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Authenticated users can update their own backups" 
ON public.system_backups 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Authenticated users can delete their own backups" 
ON public.system_backups 
FOR DELETE 
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());