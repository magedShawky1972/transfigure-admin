-- Create ticket_cc_users table for storing CC recipients
CREATE TABLE public.ticket_cc_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- Enable RLS
ALTER TABLE public.ticket_cc_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view CC entries for tickets they created or are CC'd on
CREATE POLICY "Users can view CC entries for their tickets"
ON public.ticket_cc_users FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.department_admins da ON da.department_id = t.department_id
    WHERE t.id = ticket_id AND da.user_id = auth.uid()
  )
);

-- Users can add CC entries when creating tickets
CREATE POLICY "Users can add CC entries"
ON public.ticket_cc_users FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Only ticket creator or admin can delete CC entries
CREATE POLICY "Users can delete CC entries for their tickets"
ON public.ticket_cc_users FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Add index for faster lookups
CREATE INDEX idx_ticket_cc_users_ticket_id ON public.ticket_cc_users(ticket_id);
CREATE INDEX idx_ticket_cc_users_user_id ON public.ticket_cc_users(user_id);