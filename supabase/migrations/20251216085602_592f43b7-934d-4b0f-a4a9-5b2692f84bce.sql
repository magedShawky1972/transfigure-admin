-- Add description and owner columns to user_emails table
ALTER TABLE public.user_emails ADD COLUMN description text;
ALTER TABLE public.user_emails ADD COLUMN owner text;