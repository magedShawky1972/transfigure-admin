CREATE OR REPLACE FUNCTION public.may_approve_wfh_recovery(_employee_id uuid, _work_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.hr_managers h JOIN public.employees e ON e.id = _employee_id
      WHERE h.user_id = auth.uid() AND h.is_active = true AND (
        NOT EXISTS (SELECT 1 FROM public.hr_manager_business_units b WHERE b.hr_manager_id = h.id)
        OR EXISTS (SELECT 1 FROM public.hr_manager_business_units b WHERE b.hr_manager_id = h.id AND b.business_unit_id = e.working_business_unit_id)))
    OR (NOT EXISTS (SELECT 1 FROM public.timesheet_month_locks l WHERE l.month_key = to_char(_work_date,'YYYY-MM') AND l.is_confirmed)
      AND EXISTS (SELECT 1 FROM public.timesheet_edit_permissions p WHERE p.employee_id = _employee_id AND p.month_key = to_char(_work_date,'YYYY-MM') AND p.is_active))
  );
$$;
REVOKE ALL ON FUNCTION public.may_approve_wfh_recovery(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.may_approve_wfh_recovery(uuid,date) TO authenticated, service_role;

CREATE TABLE public.wfh_recovery_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 wfh_checkin_id uuid NOT NULL REFERENCES public.wfh_checkins(id) ON DELETE RESTRICT,
 timesheet_id uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE RESTRICT,
 employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
 minutes integer NOT NULL CHECK (minutes > 0),
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wfh_recovery_allocations TO authenticated;
GRANT ALL ON public.wfh_recovery_allocations TO service_role;
ALTER TABLE public.wfh_recovery_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View authorized WFH recovery allocations" ON public.wfh_recovery_allocations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
 OR EXISTS (SELECT 1 FROM public.hr_managers WHERE user_id = auth.uid() AND is_active)
 OR EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid()));
CREATE INDEX wfh_recovery_allocations_source_idx ON public.wfh_recovery_allocations(wfh_checkin_id);
CREATE INDEX wfh_recovery_allocations_target_idx ON public.wfh_recovery_allocations(timesheet_id);

CREATE OR REPLACE FUNCTION public.approve_wfh_recovery(_wfh_checkin_id uuid, _target_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 s public.wfh_checkins%ROWTYPE;
 t public.timesheets%ROWTYPE;
 emp uuid;
 available integer;
 used integer;
 credit integer;
 applied integer := 0;
 affected integer := 0;
 old_late integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before approving recovery' USING ERRCODE='42501'; END IF;
 IF coalesce(array_length(_target_ids,1),0) > 5000 THEN RAISE EXCEPTION 'Too many attendance records'; END IF;
 SELECT * INTO s FROM public.wfh_checkins WHERE id = _wfh_checkin_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WFH session no longer exists'; END IF;
 SELECT id INTO emp FROM public.employees WHERE user_id = s.user_id;
 IF emp IS NULL OR NOT public.may_approve_wfh_recovery(emp,s.checkin_date) THEN
   RAISE EXCEPTION 'No permission to approve WFH recovery for this employee' USING ERRCODE='42501';
 END IF;
 IF s.status <> 'approved' OR s.checkout_time IS NULL OR s.checkin_time IS NULL OR s.checkout_time <= s.checkin_time THEN
   RETURN jsonb_build_object('minutes',0,'records',0,'available',0);
 END IF;
 SELECT coalesce(sum(minutes),0)::integer INTO used FROM public.wfh_recovery_allocations WHERE wfh_checkin_id = s.id;
 available := greatest(0, floor(floor(extract(epoch FROM (s.checkout_time-s.checkin_time))/60) * 0.20)::integer - used);
 FOR t IN SELECT * FROM public.timesheets WHERE id = ANY(_target_ids) AND employee_id = emp
   AND late_minutes > 0 AND NOT coalesce(is_absent,false) AND status NOT IN ('vacation','holiday','wfh','rejected')
   ORDER BY work_date,id FOR UPDATE
 LOOP
   EXIT WHEN available <= 0;
   IF NOT public.may_approve_wfh_recovery(emp,t.work_date) THEN CONTINUE; END IF;
   IF EXISTS (SELECT 1 FROM public.vacation_requests v WHERE v.employee_id=emp AND v.status='approved' AND t.work_date BETWEEN v.start_date AND v.end_date)
     OR EXISTS (SELECT 1 FROM public.employee_requests r WHERE r.employee_id=emp AND r.status='approved' AND
       ((r.request_type IN ('vacation','sick_leave','work_from_home') AND t.work_date BETWEEN r.start_date AND r.end_date)
        OR (r.request_type='delay' AND r.delay_date=t.work_date))) THEN CONTINUE; END IF;
   old_late := t.late_minutes;
   credit := least(available,old_late);
   UPDATE public.timesheets SET late_minutes=old_late-credit,
     late_recovery_minutes=coalesce(late_recovery_minutes,0)+credit,
     late_recovery_approved_by=auth.uid(),late_recovery_approved_at=now(),
     deduction_amount=CASE WHEN old_late=credit THEN 0 ELSE round(coalesce(deduction_amount,0)*(old_late-credit)/old_late,2) END,
     deduction_rule_id=CASE WHEN old_late=credit THEN NULL ELSE deduction_rule_id END
   WHERE id=t.id;
   INSERT INTO public.wfh_recovery_allocations(wfh_checkin_id,timesheet_id,employee_id,minutes,approved_by)
     VALUES(s.id,t.id,emp,credit,auth.uid());
   available := available-credit;
   applied := applied+credit;
   affected := affected+1;
 END LOOP;
 RETURN jsonb_build_object('minutes',applied,'records',affected,'available',available);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_wfh_recovery(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_wfh_recovery(uuid,uuid[]) TO authenticated;
