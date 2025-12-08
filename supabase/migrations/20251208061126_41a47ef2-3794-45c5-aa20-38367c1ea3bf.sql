-- Add sender tracking columns to notifications table
ALTER TABLE public.notifications 
ADD COLUMN sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN sender_name text;

-- Add parent_notification_id for reply threading
ALTER TABLE public.notifications 
ADD COLUMN parent_notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL;