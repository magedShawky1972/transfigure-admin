
-- Create storage bucket for bank transfer files
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-transfer-files', 'bank-transfer-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload bank transfer files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bank-transfer-files');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read bank transfer files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bank-transfer-files');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete bank transfer files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bank-transfer-files');

-- Allow public read access for viewing
CREATE POLICY "Public can read bank transfer files"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'bank-transfer-files');
