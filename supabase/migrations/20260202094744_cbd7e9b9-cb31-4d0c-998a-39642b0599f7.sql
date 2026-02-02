-- Add deduction notification tracking columns to timesheets table
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS deduction_notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deduction_notification_sent_at TIMESTAMPTZ;