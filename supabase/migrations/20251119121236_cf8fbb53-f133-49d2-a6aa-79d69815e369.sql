-- Enable DELETE for ticket owners on their own open, unassigned tickets
CREATE POLICY "Users can delete their own open unassigned tickets"
ON public.tickets
FOR DELETE
USING (
  user_id = auth.uid() 
  AND status = 'Open' 
  AND assigned_to IS NULL
);