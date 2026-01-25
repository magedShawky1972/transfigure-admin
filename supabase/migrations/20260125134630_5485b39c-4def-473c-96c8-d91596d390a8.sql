-- Add delegation flag to profiles table for viewing all tickets
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_view_all_tickets BOOLEAN DEFAULT FALSE;