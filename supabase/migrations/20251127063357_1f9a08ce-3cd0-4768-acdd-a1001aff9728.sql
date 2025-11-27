-- Create storage policies for shift-receipts bucket

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload shift receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shift-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their shift receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shift-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their shift receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'shift-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view their shift receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'shift-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to view all shift receipts
CREATE POLICY "Admins can view all shift receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'shift-receipts' 
  AND has_role(auth.uid(), 'admin')
);