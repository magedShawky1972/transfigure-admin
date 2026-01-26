-- Add UPDATE policy for treasury_opening_balances
CREATE POLICY "Users can update treasury_opening_balances" 
ON public.treasury_opening_balances 
FOR UPDATE 
USING (true)
WITH CHECK (true);