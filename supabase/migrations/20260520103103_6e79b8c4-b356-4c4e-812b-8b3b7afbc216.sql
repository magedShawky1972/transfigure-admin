CREATE POLICY "Authenticated users can delete api logs"
ON public.api_consumption_logs
FOR DELETE
TO authenticated
USING (true);