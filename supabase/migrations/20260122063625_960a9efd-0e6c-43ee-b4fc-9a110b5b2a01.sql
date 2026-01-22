-- Allow authenticated users to update software license invoices
DO $$ BEGIN
  -- Create UPDATE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='software_license_invoices' AND policyname='Users can update invoices'
  ) THEN
    CREATE POLICY "Users can update invoices"
    ON public.software_license_invoices
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;