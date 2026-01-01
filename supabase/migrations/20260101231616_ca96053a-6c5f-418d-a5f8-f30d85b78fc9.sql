-- Create user_device_activations table to track activated devices per user
CREATE TABLE public.user_device_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_id UUID REFERENCES public.user_certificates(id) ON DELETE SET NULL,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_info JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE public.user_device_activations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all device activations"
ON public.user_device_activations
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own device activations"
ON public.user_device_activations
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own device activations"
ON public.user_device_activations
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own device activations"
ON public.user_device_activations
FOR UPDATE
USING (user_id = auth.uid());

-- Create updated_at trigger
CREATE TRIGGER update_user_device_activations_updated_at
BEFORE UPDATE ON public.user_device_activations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();