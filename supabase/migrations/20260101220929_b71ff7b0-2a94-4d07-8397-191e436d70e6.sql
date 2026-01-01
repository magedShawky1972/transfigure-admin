-- Create table for alert configuration
CREATE TABLE IF NOT EXISTS public.security_alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT UNIQUE NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 10,
  time_window_minutes INTEGER NOT NULL DEFAULT 60,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  alert_recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_alert_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage config
CREATE POLICY "Admins can view security config" ON public.security_alert_config
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage security config" ON public.security_alert_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert default configurations
INSERT INTO public.security_alert_config (alert_type, threshold, time_window_minutes, is_enabled, alert_recipients)
VALUES 
  ('bulk_access', 10, 60, true, ARRAY[]::TEXT[]),
  ('new_user_access', 1, 1440, true, ARRAY[]::TEXT[]),
  ('after_hours_access', 5, 60, true, ARRAY[]::TEXT[])
ON CONFLICT (alert_type) DO NOTHING;

-- Create table to track sent alerts (to avoid duplicates)
CREATE TABLE IF NOT EXISTS public.security_alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  user_id UUID,
  details JSONB,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sent alerts" ON public.security_alerts_sent
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_security_alerts_sent_type ON public.security_alerts_sent(alert_type, sent_at);

-- Function to detect bulk password access
CREATE OR REPLACE FUNCTION public.detect_bulk_password_access(
  p_threshold INTEGER DEFAULT 10,
  p_time_window_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  access_count BIGINT,
  first_access TIMESTAMPTZ,
  last_access TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pal.user_id,
    pal.user_email,
    COUNT(*) as access_count,
    MIN(pal.created_at) as first_access,
    MAX(pal.created_at) as last_access
  FROM public.password_access_logs pal
  WHERE pal.created_at > now() - (p_time_window_minutes || ' minutes')::interval
  GROUP BY pal.user_id, pal.user_email
  HAVING COUNT(*) >= p_threshold
  ORDER BY access_count DESC;
$$;

-- Function to detect new users accessing passwords
CREATE OR REPLACE FUNCTION public.detect_new_user_password_access(
  p_time_window_minutes INTEGER DEFAULT 1440
)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  access_count BIGINT,
  user_created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
    pal.user_id,
    pal.user_email,
    COUNT(*) as access_count,
    au.created_at as user_created_at
  FROM public.password_access_logs pal
  JOIN auth.users au ON au.id = pal.user_id
  WHERE pal.created_at > now() - (p_time_window_minutes || ' minutes')::interval
    AND au.created_at > now() - interval '24 hours'
  GROUP BY pal.user_id, pal.user_email, au.created_at
  ORDER BY access_count DESC;
$$;