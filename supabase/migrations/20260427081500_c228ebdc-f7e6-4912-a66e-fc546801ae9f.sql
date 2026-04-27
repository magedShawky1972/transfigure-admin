-- Cancelled Orders table
CREATE TABLE public.cancelled_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_by_name TEXT,
  shift_session_id UUID REFERENCES public.shift_sessions(id) ON DELETE SET NULL,
  shift_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cancelled_orders_submitted_by ON public.cancelled_orders(submitted_by);
CREATE INDEX idx_cancelled_orders_created_at ON public.cancelled_orders(created_at);

ALTER TABLE public.cancelled_orders ENABLE ROW LEVEL SECURITY;

-- Employees can view their own submissions
CREATE POLICY "Users view own cancelled orders"
ON public.cancelled_orders FOR SELECT
TO authenticated
USING (submitted_by = auth.uid());

-- Admins can view all
CREATE POLICY "Admins view all cancelled orders"
ON public.cancelled_orders FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own (validated by trigger)
CREATE POLICY "Users insert own cancelled orders"
ON public.cancelled_orders FOR INSERT
TO authenticated
WITH CHECK (submitted_by = auth.uid());

-- Only admins can update/delete
CREATE POLICY "Admins update cancelled orders"
ON public.cancelled_orders FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete cancelled orders"
ON public.cancelled_orders FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger function: enforce active shift, auto-set submitter + shift info
CREATE OR REPLACE FUNCTION public.enforce_cancelled_order_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_shift_name TEXT;
  v_user_name TEXT;
BEGIN
  -- Force submitted_by to be the auth user (cannot spoof)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  NEW.submitted_by := auth.uid();

  -- Find an open shift session for this user
  SELECT ss.id, s.shift_name
    INTO v_session_id, v_shift_name
  FROM public.shift_sessions ss
  LEFT JOIN public.shift_assignments sa ON sa.id = ss.shift_assignment_id
  LEFT JOIN public.shifts s ON s.id = sa.shift_id
  WHERE ss.user_id = auth.uid()
    AND ss.status = 'open'
  ORDER BY ss.opened_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'No active shift session. You must have an open shift to submit a cancellation request.'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.shift_session_id := v_session_id;
  NEW.shift_name := v_shift_name;

  -- Capture user display name from profiles
  SELECT user_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  NEW.submitted_by_name := COALESCE(v_user_name, NEW.submitted_by_name);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_cancelled_order_shift
BEFORE INSERT ON public.cancelled_orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cancelled_order_shift();
