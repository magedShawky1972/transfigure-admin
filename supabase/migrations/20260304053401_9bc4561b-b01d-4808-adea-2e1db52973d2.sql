CREATE POLICY "Authenticated users can read API keys"
  ON public.api_keys
  FOR SELECT
  TO authenticated
  USING (true);