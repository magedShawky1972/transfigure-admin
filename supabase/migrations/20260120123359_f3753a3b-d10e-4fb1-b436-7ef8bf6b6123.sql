-- Create API consumption logs table
CREATE TABLE public.api_consumption_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  request_body JSONB,
  response_status INTEGER,
  response_message TEXT,
  success BOOLEAN DEFAULT true,
  execution_time_ms INTEGER,
  source_ip TEXT,
  api_key_id UUID REFERENCES public.api_keys(id),
  api_key_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for faster queries
CREATE INDEX idx_api_logs_endpoint ON public.api_consumption_logs(endpoint);
CREATE INDEX idx_api_logs_created_at ON public.api_consumption_logs(created_at DESC);
CREATE INDEX idx_api_logs_success ON public.api_consumption_logs(success);
CREATE INDEX idx_api_logs_api_key ON public.api_consumption_logs(api_key_id);

-- Enable RLS
ALTER TABLE public.api_consumption_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read logs
CREATE POLICY "Authenticated users can read api logs"
ON public.api_consumption_logs
FOR SELECT
TO authenticated
USING (true);

-- Allow service role to insert logs (edge functions use service role)
CREATE POLICY "Service role can insert api logs"
ON public.api_consumption_logs
FOR INSERT
TO service_role
WITH CHECK (true);