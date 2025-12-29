-- Create table to track background sync jobs
CREATE TABLE public.background_sync_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_orders INTEGER DEFAULT 0,
  processed_orders INTEGER DEFAULT 0,
  successful_orders INTEGER DEFAULT 0,
  failed_orders INTEGER DEFAULT 0,
  skipped_orders INTEGER DEFAULT 0,
  current_order_number TEXT,
  error_message TEXT,
  email_sent BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.background_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users to manage their own jobs
CREATE POLICY "Users can view their own background jobs" 
ON public.background_sync_jobs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own background jobs" 
ON public.background_sync_jobs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own background jobs" 
ON public.background_sync_jobs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy for service role to update jobs (edge function will use service role)
CREATE POLICY "Service role can manage all jobs" 
ON public.background_sync_jobs 
FOR ALL 
USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.background_sync_jobs;

-- Create index for faster queries
CREATE INDEX idx_background_sync_jobs_user_id ON public.background_sync_jobs(user_id);
CREATE INDEX idx_background_sync_jobs_status ON public.background_sync_jobs(status);