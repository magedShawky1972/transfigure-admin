-- Allow all authenticated users to read table metadata for Excel mapping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='generated_tables' AND policyname='Authenticated can read generated_tables'
  ) THEN
    CREATE POLICY "Authenticated can read generated_tables"
    ON public.generated_tables
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;