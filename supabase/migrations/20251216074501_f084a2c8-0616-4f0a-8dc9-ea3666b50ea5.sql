-- Create user_emails table
CREATE TABLE public.user_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_name text NOT NULL,
    email text NOT NULL,
    password text,
    host text NOT NULL DEFAULT 'Hostinger',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access only
CREATE POLICY "Admins can manage user emails"
ON public.user_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_user_emails_updated_at
BEFORE UPDATE ON public.user_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();