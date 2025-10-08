-- Add column to track if user must change password on first login
ALTER TABLE public.profiles 
ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;