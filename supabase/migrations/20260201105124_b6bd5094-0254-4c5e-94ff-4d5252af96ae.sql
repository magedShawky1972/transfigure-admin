-- Create acknowledgment documents table
CREATE TABLE public.acknowledgment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_ar TEXT,
  content TEXT NOT NULL,
  content_ar TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_signature BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for document recipients (by user or job position)
CREATE TABLE public.acknowledgment_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.acknowledgment_documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID,
  job_position_id UUID REFERENCES public.job_positions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT at_least_one_recipient CHECK (user_id IS NOT NULL OR job_position_id IS NOT NULL)
);

-- Create table for tracking signatures/approvals
CREATE TABLE public.acknowledgment_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.acknowledgment_documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  UNIQUE(document_id, user_id)
);

-- Enable RLS
ALTER TABLE public.acknowledgment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acknowledgment_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acknowledgment_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for acknowledgment_documents
CREATE POLICY "Users can view active documents" ON public.acknowledgment_documents
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage documents" ON public.acknowledgment_documents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for acknowledgment_recipients
CREATE POLICY "Users can view recipients" ON public.acknowledgment_recipients
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage recipients" ON public.acknowledgment_recipients
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for acknowledgment_signatures
CREATE POLICY "Users can view all signatures" ON public.acknowledgment_signatures
  FOR SELECT USING (true);

CREATE POLICY "Users can sign documents" ON public.acknowledgment_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_ack_recipients_document ON public.acknowledgment_recipients(document_id);
CREATE INDEX idx_ack_recipients_user ON public.acknowledgment_recipients(user_id);
CREATE INDEX idx_ack_recipients_job ON public.acknowledgment_recipients(job_position_id);
CREATE INDEX idx_ack_signatures_document ON public.acknowledgment_signatures(document_id);
CREATE INDEX idx_ack_signatures_user ON public.acknowledgment_signatures(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_acknowledgment_documents_updated_at
  BEFORE UPDATE ON public.acknowledgment_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();