DROP POLICY IF EXISTS "Admins can manage payment_methods" ON public.payment_methods;

CREATE POLICY "Authenticated users can manage payment_methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
