-- Enums
DO $$ BEGIN
  CREATE TYPE public.integration_type AS ENUM ('oauth', 'api_key', 'webhook');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_status AS ENUM ('active', 'warning', 'error', 'disabled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_access_target AS ENUM ('user', 'role', 'group');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- integrations
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  app_key TEXT,
  description TEXT,
  type public.integration_type NOT NULL DEFAULT 'oauth',
  status public.integration_status NOT NULL DEFAULT 'active',
  icon_url TEXT,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  daily_requests INTEGER NOT NULL DEFAULT 0,
  monthly_requests INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) NOT NULL DEFAULT 100,
  expires_at TIMESTAMPTZ,
  warning_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integrations" ON public.integrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert integrations" ON public.integrations
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update integrations" ON public.integrations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete integrations" ON public.integrations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- integration_activity
CREATE TABLE IF NOT EXISTS public.integration_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success', -- success | fail | warning
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_activity_created_at ON public.integration_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_activity_integration_id ON public.integration_activity(integration_id);

ALTER TABLE public.integration_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity" ON public.integration_activity
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert activity" ON public.integration_activity
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete activity" ON public.integration_activity
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- integration_access (permission matrix)
CREATE TABLE IF NOT EXISTS public.integration_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  target_type public.integration_access_target NOT NULL,
  target_id TEXT NOT NULL, -- user_id, role name, or group id (as text for flexibility)
  target_label TEXT,        -- friendly label cached for display
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_access_integration_id ON public.integration_access(integration_id);

ALTER TABLE public.integration_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access" ON public.integration_access
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert access" ON public.integration_access
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update access" ON public.integration_access
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete access" ON public.integration_access
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_integration_access_updated_at
  BEFORE UPDATE ON public.integration_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();