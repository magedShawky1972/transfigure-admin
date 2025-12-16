-- Add email_password column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_password TEXT;