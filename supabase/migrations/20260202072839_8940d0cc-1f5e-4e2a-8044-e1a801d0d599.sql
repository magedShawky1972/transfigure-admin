-- Create table to track overdue shift reminders
CREATE TABLE IF NOT EXISTS public.shift_overdue_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_session_id UUID NOT NULL,
  shift_assignment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  shift_name TEXT NOT NULL,
  overdue_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_shift_overdue_reminders_session 
  ON public.shift_overdue_reminders(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_shift_overdue_reminders_created 
  ON public.shift_overdue_reminders(created_at);

-- Enable RLS
ALTER TABLE public.shift_overdue_reminders ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view all reminders
CREATE POLICY "Admins can view all overdue reminders" 
  ON public.shift_overdue_reminders 
  FOR SELECT 
  USING (true);

-- Create policy for service role to insert
CREATE POLICY "Service role can insert overdue reminders" 
  ON public.shift_overdue_reminders 
  FOR INSERT 
  WITH CHECK (true);