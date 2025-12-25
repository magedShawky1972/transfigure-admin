-- Create backups metadata table
CREATE TABLE public.system_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('structure', 'data')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all backups
CREATE POLICY "Authenticated users can view backups" 
ON public.system_backups 
FOR SELECT 
TO authenticated
USING (true);

-- Allow authenticated users to insert backups
CREATE POLICY "Authenticated users can create backups" 
ON public.system_backups 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update their own backups
CREATE POLICY "Authenticated users can update backups" 
ON public.system_backups 
FOR UPDATE 
TO authenticated
USING (true);

-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public) 
VALUES ('system-backups', 'system-backups', false);

-- Storage policies for backups bucket
CREATE POLICY "Authenticated users can upload backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'system-backups');

CREATE POLICY "Authenticated users can view backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'system-backups');

CREATE POLICY "Authenticated users can delete backups"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'system-backups');