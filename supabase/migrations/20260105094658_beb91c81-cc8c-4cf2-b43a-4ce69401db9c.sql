-- Add email_id column to notifications table to link notifications to stored emails
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS email_id uuid REFERENCES public.emails(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_email_id ON public.notifications(email_id);