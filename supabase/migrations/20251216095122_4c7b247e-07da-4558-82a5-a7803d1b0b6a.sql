-- Create mail_types table for shared mail server configurations
CREATE TABLE public.mail_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_name TEXT NOT NULL UNIQUE,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mail_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage mail types"
ON public.mail_types
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view mail types"
ON public.mail_types
FOR SELECT
USING (true);

-- Add mail_type_id to profiles table
ALTER TABLE public.profiles ADD COLUMN mail_type_id UUID REFERENCES public.mail_types(id);

-- Insert default mail types
INSERT INTO public.mail_types (type_name, imap_host, imap_port, smtp_host, smtp_port) VALUES
('Hostinger', 'imap.hostinger.com', 993, 'smtp.hostinger.com', 465),
('Gmail', 'imap.gmail.com', 993, 'smtp.gmail.com', 587);