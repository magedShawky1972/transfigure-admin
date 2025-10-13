-- Create upload_logs table to track all uploads
CREATE TABLE public.upload_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  sheet_id UUID REFERENCES excel_sheets(id),
  excel_dates JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Allow all operations on upload_logs"
ON public.upload_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_upload_logs_updated_at
BEFORE UPDATE ON public.upload_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();