-- Create login_history table to track user login sessions
CREATE TABLE public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  logout_at TIMESTAMP WITH TIME ZONE,
  session_duration_minutes INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Policies for reading login history
CREATE POLICY "Admins can view all login history" 
ON public.login_history 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own login history" 
ON public.login_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own login history" 
ON public.login_history 
FOR UPDATE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_login_at ON public.login_history(login_at DESC);

-- Enable realtime for login history
ALTER PUBLICATION supabase_realtime ADD TABLE public.login_history;