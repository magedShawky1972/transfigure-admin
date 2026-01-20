-- Create API integration settings table
CREATE TABLE IF NOT EXISTS public.api_integration_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT
);

-- Enable RLS
ALTER TABLE public.api_integration_settings ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (admin only page)
CREATE POLICY "Allow all access to api_integration_settings" 
ON public.api_integration_settings 
FOR ALL USING (true) WITH CHECK (true);

-- Insert default mode as 'test'
INSERT INTO public.api_integration_settings (setting_key, setting_value)
VALUES ('api_mode', 'test')
ON CONFLICT (setting_key) DO NOTHING;