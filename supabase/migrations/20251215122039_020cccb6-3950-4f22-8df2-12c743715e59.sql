-- Create table for storing user login credentials
CREATE TABLE public.user_logins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  website TEXT,
  application TEXT NOT NULL,
  description TEXT,
  user_name TEXT,
  password TEXT,
  needs_otp BOOLEAN NOT NULL DEFAULT false,
  otp_mobile_number TEXT,
  google_account TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user logins (sensitive data)
CREATE POLICY "Admins can manage user logins"
ON public.user_logins
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_logins_updated_at
BEFORE UPDATE ON public.user_logins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();