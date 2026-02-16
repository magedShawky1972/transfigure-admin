-- Allow shift admins to insert brand balances (for uploading missing images on behalf of users)
CREATE POLICY "Shift admins can insert brand balances"
ON public.shift_brand_balances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shift_admins sa WHERE sa.user_id = auth.uid()
  )
);
