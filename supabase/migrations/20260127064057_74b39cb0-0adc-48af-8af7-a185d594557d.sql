-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Users can delete draft expense entries" ON public.expense_entries;

-- Create new policy that allows deleting draft OR pending entries
CREATE POLICY "Users can delete draft or pending expense entries"
ON public.expense_entries
FOR DELETE
USING (status IN ('draft', 'pending'));