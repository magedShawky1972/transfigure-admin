-- Create backup_schedule table for scheduled backup settings
CREATE TABLE IF NOT EXISTS public.backup_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  schedule_time TIME NOT NULL DEFAULT '02:00:00',
  retention_days INTEGER NOT NULL DEFAULT 30,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.backup_schedule ENABLE ROW LEVEL SECURITY;

-- Create policies for backup_schedule
CREATE POLICY "Authenticated users can view backup schedule" 
ON public.backup_schedule 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update backup schedule" 
ON public.backup_schedule 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert backup schedule" 
ON public.backup_schedule 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default schedule (disabled by default)
INSERT INTO public.backup_schedule (is_enabled, schedule_time, retention_days)
VALUES (false, '02:00:00', 30)
ON CONFLICT DO NOTHING;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_backup_schedule_updated_at
BEFORE UPDATE ON public.backup_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension for HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;