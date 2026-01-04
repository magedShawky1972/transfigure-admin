-- Add columns for email status tracking
ALTER TABLE public.user_emails 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_error text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_checked_at timestamp with time zone DEFAULT NULL;