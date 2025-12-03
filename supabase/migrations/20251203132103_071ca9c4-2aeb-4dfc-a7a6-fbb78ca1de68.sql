-- Drop existing constraint and add new one with 'custom' type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['ticket_created'::text, 'ticket_approved'::text, 'ticket_assigned'::text, 'custom'::text]));