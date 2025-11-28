-- Create ticket activity log table
CREATE TABLE public.ticket_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  user_id uuid,
  user_name text,
  recipient_id uuid,
  recipient_name text,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_ticket_activity_logs_ticket_id ON public.ticket_activity_logs(ticket_id);
CREATE INDEX idx_ticket_activity_logs_created_at ON public.ticket_activity_logs(created_at);

-- Enable RLS
ALTER TABLE public.ticket_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage ticket activity logs"
ON public.ticket_activity_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Department admins can view their department ticket logs"
ON public.ticket_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    JOIN department_admins da ON da.department_id = t.department_id
    WHERE t.id = ticket_activity_logs.ticket_id
    AND da.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view logs for their own tickets"
ON public.ticket_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tickets t
    WHERE t.id = ticket_activity_logs.ticket_id
    AND t.user_id = auth.uid()
  )
);

-- Allow insert from authenticated users (for edge functions via service role)
CREATE POLICY "Service can insert activity logs"
ON public.ticket_activity_logs
FOR INSERT
WITH CHECK (true);