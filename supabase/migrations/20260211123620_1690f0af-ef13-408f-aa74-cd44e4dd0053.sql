CREATE POLICY "Authenticated users can update api logs"
ON public.api_consumption_logs
FOR UPDATE
USING (true)
WITH CHECK (true);