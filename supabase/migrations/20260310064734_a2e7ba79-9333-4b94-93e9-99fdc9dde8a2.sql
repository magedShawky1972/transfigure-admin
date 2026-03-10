ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'ticket_update', 'ticket_assigned', 'ticket_resolved', 'ticket_comment', 
  'general', 'task_update', 'ticket_returned', 'ticket_created', 
  'ticket_approved', 'extra_approval_request', 'custom', 'ticket_rejected'
));