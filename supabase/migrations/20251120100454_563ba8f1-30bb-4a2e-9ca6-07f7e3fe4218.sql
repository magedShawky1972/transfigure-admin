-- Allow users to delete their own unapproved tickets (hard delete)
CREATE POLICY "Users can delete their own unapproved tickets"
ON public.tickets
FOR DELETE
USING (
  user_id = auth.uid() 
  AND approved_at IS NULL
);