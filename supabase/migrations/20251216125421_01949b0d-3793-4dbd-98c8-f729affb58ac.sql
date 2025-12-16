-- Create email_contacts table for admin-managed contacts
CREATE TABLE public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

-- Admins can manage contacts
CREATE POLICY "Admins can manage email contacts"
ON public.email_contacts
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- All authenticated users can view contacts
CREATE POLICY "Authenticated users can view email contacts"
ON public.email_contacts
FOR SELECT
USING (is_active = true);