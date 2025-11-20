-- Add RLS policy to allow users to view tickets assigned to them
CREATE POLICY "Assigned users can view their assigned non-deleted tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid() AND is_deleted = false
);