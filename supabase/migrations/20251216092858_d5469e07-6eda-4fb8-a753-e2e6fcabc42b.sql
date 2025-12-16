-- Create email configurations table for storing IMAP/SMTP settings per user
CREATE TABLE public.user_email_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT,
  -- IMAP settings
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  -- SMTP settings
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  -- Credentials (encrypted in practice)
  email_username TEXT NOT NULL,
  email_password TEXT NOT NULL,
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email_address)
);

-- Create emails table for storing fetched emails
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES public.user_email_configs(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  subject TEXT,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses JSONB DEFAULT '[]'::jsonb,
  bcc_addresses JSONB DEFAULT '[]'::jsonb,
  body_text TEXT,
  body_html TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  has_attachments BOOLEAN NOT NULL DEFAULT false,
  email_date TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Workflow links
  linked_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Create email attachments table
CREATE TABLE public.email_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_email_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_email_configs
CREATE POLICY "Users can view their own email configs"
  ON public.user_email_configs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own email configs"
  ON public.user_email_configs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email configs"
  ON public.user_email_configs FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own email configs"
  ON public.user_email_configs FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for emails
CREATE POLICY "Users can view their own emails"
  ON public.emails FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own emails"
  ON public.emails FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own emails"
  ON public.emails FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own emails"
  ON public.emails FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for email_attachments
CREATE POLICY "Users can view attachments of their emails"
  ON public.email_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.emails e 
    WHERE e.id = email_attachments.email_id 
    AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage attachments of their emails"
  ON public.email_attachments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.emails e 
    WHERE e.id = email_attachments.email_id 
    AND e.user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_emails_user_folder ON public.emails(user_id, folder);
CREATE INDEX idx_emails_user_date ON public.emails(user_id, email_date DESC);
CREATE INDEX idx_emails_config ON public.emails(config_id);
CREATE INDEX idx_email_attachments_email ON public.email_attachments(email_id);

-- Add updated_at triggers
CREATE TRIGGER update_user_email_configs_updated_at
  BEFORE UPDATE ON public.user_email_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();