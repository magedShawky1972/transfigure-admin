CREATE POLICY "Users can update own scenarios"
ON public.pricing_scenarios
FOR UPDATE
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);