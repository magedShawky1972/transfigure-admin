-- Create acknowledgment_approvers table to track who needs to approve documents
CREATE TABLE public.acknowledgment_approvers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.acknowledgment_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

-- Add approval status columns to acknowledgment_documents
ALTER TABLE public.acknowledgment_documents 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Enable RLS
ALTER TABLE public.acknowledgment_approvers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for acknowledgment_approvers
CREATE POLICY "Users can view their own approval requests"
ON public.acknowledgment_approvers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert approval requests"
ON public.acknowledgment_approvers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update their own approval records"
ON public.acknowledgment_approvers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.acknowledgment_documents d 
  WHERE d.id = document_id AND d.created_by = auth.uid()
));

CREATE POLICY "Document creators can delete approval requests"
ON public.acknowledgment_approvers
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.acknowledgment_documents d 
  WHERE d.id = document_id AND d.created_by = auth.uid()
));

-- Add index for faster queries
CREATE INDEX idx_acknowledgment_approvers_document ON public.acknowledgment_approvers(document_id);
CREATE INDEX idx_acknowledgment_approvers_user ON public.acknowledgment_approvers(user_id);
CREATE INDEX idx_acknowledgment_approvers_status ON public.acknowledgment_approvers(status);