ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS ticket_escalation_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS ticket_escalation_count integer DEFAULT 0;