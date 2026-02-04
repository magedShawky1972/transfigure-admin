-- Add creator_notes column to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS creator_notes TEXT;

-- Create a table for workflow step notes/comments
CREATE TABLE IF NOT EXISTS public.ticket_workflow_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  note TEXT NOT NULL,
  approval_level INTEGER,
  activity_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.ticket_workflow_notes ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view workflow notes
CREATE POLICY "Authenticated users can view workflow notes"
ON public.ticket_workflow_notes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create policy for authenticated users to insert their own notes
CREATE POLICY "Authenticated users can insert workflow notes"
ON public.ticket_workflow_notes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_workflow_notes_ticket_id ON public.ticket_workflow_notes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_workflow_notes_created_at ON public.ticket_workflow_notes(created_at);