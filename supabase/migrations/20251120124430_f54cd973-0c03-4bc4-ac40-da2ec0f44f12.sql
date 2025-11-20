-- Add RLS policies for ticket-attachments bucket to allow authenticated users to view files
CREATE POLICY "Authenticated users can view ticket attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- Add policy for authenticated users to access license invoice files
CREATE POLICY "Authenticated users can view license invoices in ticket-attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments' 
  AND (storage.foldername(name))[1] = 'license-invoices'
);