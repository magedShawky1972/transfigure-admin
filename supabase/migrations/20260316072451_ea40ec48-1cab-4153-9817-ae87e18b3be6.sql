
CREATE TABLE public.wfh_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkout_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'checked_in',
  notes TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  device_info TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE public.wfh_checkins ENABLE ROW LEVEL SECURITY;

-- Users can see their own check-ins
CREATE POLICY "Users can view own checkins" ON public.wfh_checkins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own check-ins
CREATE POLICY "Users can insert own checkins" ON public.wfh_checkins
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own check-ins (for checkout)
CREATE POLICY "Users can update own checkins" ON public.wfh_checkins
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all check-ins
CREATE POLICY "Admins can view all checkins" ON public.wfh_checkins
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_wfh_checkins_updated_at
  BEFORE UPDATE ON public.wfh_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
