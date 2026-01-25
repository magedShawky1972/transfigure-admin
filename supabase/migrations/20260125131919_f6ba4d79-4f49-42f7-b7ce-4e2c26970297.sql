-- Update the notifications type check constraint to include new notification types
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['ticket_created'::text, 'ticket_approved'::text, 'ticket_assigned'::text, 'extra_approval_request'::text, 'ticket_cc'::text, 'custom'::text]));