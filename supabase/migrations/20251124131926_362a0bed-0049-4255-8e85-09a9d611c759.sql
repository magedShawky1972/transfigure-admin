-- Add DELETE policy for shift_sessions to allow admins to delete
CREATE POLICY "Admins can delete shift sessions"
ON shift_sessions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for shift_brand_balances to allow admins to delete
CREATE POLICY "Admins can delete brand balances"
ON shift_brand_balances
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));