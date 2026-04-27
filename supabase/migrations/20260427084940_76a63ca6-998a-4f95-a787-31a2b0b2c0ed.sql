CREATE OR REPLACE FUNCTION public.enforce_cancelled_order_shift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid;
  v_shift_name text;
  v_user_name text;
  v_is_admin boolean;
BEGIN
  -- Auto-fill submitter from auth context if missing
  IF NEW.submitted_by IS NULL THEN
    NEW.submitted_by := auth.uid();
  END IF;

  -- Admin bypass: admins can insert without an active shift (for Excel imports / manual entry)
  v_is_admin := public.has_role(auth.uid(), 'admin'::app_role);

  IF NOT v_is_admin THEN
    SELECT ss.id, s.shift_name
      INTO v_session_id, v_shift_name
    FROM public.shift_sessions ss
    LEFT JOIN public.shift_assignments sa ON sa.id = ss.shift_assignment_id
    LEFT JOIN public.shifts s ON s.id = sa.shift_id
    WHERE ss.user_id = NEW.submitted_by
      AND ss.status = 'open'
    ORDER BY ss.opened_at DESC
    LIMIT 1;

    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'No active shift session. You must have an open shift to submit a cancellation request.'
        USING ERRCODE = 'P0001';
    END IF;

    NEW.shift_session_id := v_session_id;
    NEW.shift_name := v_shift_name;
  END IF;

  -- Capture submitter name from profiles (best effort)
  SELECT user_name INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.submitted_by
  LIMIT 1;
  IF v_user_name IS NOT NULL THEN
    NEW.submitted_by_name := v_user_name;
  END IF;

  RETURN NEW;
END;
$function$;