-- Create storage bucket for software license invoices if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('software-license-invoices', 'software-license-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for software-license-invoices bucket
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'software-license-invoices');

CREATE POLICY "Authenticated users can view invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'software-license-invoices');

CREATE POLICY "Authenticated users can update invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'software-license-invoices');

CREATE POLICY "Admins can delete invoices"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'software-license-invoices' AND has_role(auth.uid(), 'admin'::app_role));