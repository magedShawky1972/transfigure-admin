-- Create table for daily sync jobs
CREATE TABLE IF NOT EXISTS public.daily_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_days INTEGER DEFAULT 0,
  completed_days INTEGER DEFAULT 0,
  failed_days INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  successful_orders INTEGER DEFAULT 0,
  failed_orders INTEGER DEFAULT 0,
  skipped_orders INTEGER DEFAULT 0,
  current_day TEXT,
  day_statuses JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own daily sync jobs" 
ON public.daily_sync_jobs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily sync jobs" 
ON public.daily_sync_jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily sync jobs" 
ON public.daily_sync_jobs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own daily sync jobs" 
ON public.daily_sync_jobs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can do anything (for edge functions)
CREATE POLICY "Service role can manage all daily sync jobs"
ON public.daily_sync_jobs
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_sync_jobs_updated_at
BEFORE UPDATE ON public.daily_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for daily sync jobs
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_sync_jobs;