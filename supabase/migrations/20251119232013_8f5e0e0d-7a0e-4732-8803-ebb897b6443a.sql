-- Add is_purchase_ticket field to tickets table
ALTER TABLE public.tickets 
ADD COLUMN is_purchase_ticket BOOLEAN NOT NULL DEFAULT false;

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create ticket_attachments table
CREATE TABLE public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ticket_attachments
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_attachments
CREATE POLICY "Users can view attachments on their tickets"
ON public.ticket_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Department admins can view all attachments on department tickets"
ON public.ticket_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.department_admins da ON da.department_id = t.department_id
    WHERE t.id = ticket_attachments.ticket_id
    AND da.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can upload attachments to accessible tickets"
ON public.ticket_attachments
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_attachments.ticket_id
      AND t.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.department_admins da ON da.department_id = t.department_id
      WHERE t.id = ticket_attachments.ticket_id
      AND da.user_id = auth.uid()
    )
  )
);

-- Storage policies for ticket attachments
CREATE POLICY "Users can view their ticket attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'ticket-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.ticket_attachments ta
      JOIN public.tickets t ON t.id = ta.ticket_id
      WHERE ta.file_path = storage.objects.name
      AND t.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ticket_attachments ta
      JOIN public.tickets t ON t.id = ta.ticket_id
      JOIN public.department_admins da ON da.department_id = t.department_id
      WHERE ta.file_path = storage.objects.name
      AND da.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can upload attachments to their tickets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND auth.uid() IS NOT NULL
);