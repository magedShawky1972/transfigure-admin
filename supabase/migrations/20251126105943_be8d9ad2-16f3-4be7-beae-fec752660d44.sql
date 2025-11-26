-- Add media_url column to whatsapp_messages table
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Create storage bucket for WhatsApp attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-attachments', 'whatsapp-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for whatsapp-attachments bucket
CREATE POLICY "Allow authenticated users to upload whatsapp attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-attachments');

CREATE POLICY "Allow authenticated users to read whatsapp attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-attachments');

CREATE POLICY "Allow public to read whatsapp attachments"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'whatsapp-attachments');

CREATE POLICY "Allow authenticated users to delete whatsapp attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-attachments');