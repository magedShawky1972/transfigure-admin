
-- Drop the existing shift admin update policy
DROP POLICY "Shift admins can update brand balances" ON public.shift_brand_balances;

-- Recreate it to also allow app admins (from user_roles)
CREATE POLICY "Shift admins can update brand balances" 
ON public.shift_brand_balances 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM shift_admins sa WHERE sa.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM shift_admins sa WHERE sa.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
