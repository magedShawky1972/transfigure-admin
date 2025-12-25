-- Add DELETE policy for system_backups table
CREATE POLICY "Authenticated users can delete backups"
ON public.system_backups
FOR DELETE
USING (true);