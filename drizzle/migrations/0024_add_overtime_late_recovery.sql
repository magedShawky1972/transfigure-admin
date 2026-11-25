CREATE TABLE public.overtime_recovery_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_timesheet_id uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE RESTRICT,
 timesheet_id uuid NOT NULL REFERENCES public.timesheets(id) ON DELETE RESTRICT,
 employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
 minutes integer NOT NULL CHECK (minutes > 0),
 approved_by uuid NOT NULL,
 approved_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT overtime_recovery_allocations_unique_target UNIQUE (source_timesheet_id, timesheet_id),
 CONSTRAINT overtime_recovery_allocations_distinct_rows CHECK (source_timesheet_id <> timesheet_id)
);
GRANT SELECT ON public.overtime_recovery_allocations TO authenticated;
GRANT ALL ON public.overtime_recovery_allocations TO service_role;
ALTER TABLE public.overtime_recovery_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View authorized overtime recovery allocations" ON public.overtime_recovery_allocations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::public.app_role)
 OR EXISTS (SELECT 1 FROM public.hr_managers WHERE user_id = auth.uid() AND is_active)
 OR EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid()));
CREATE INDEX overtime_recovery_allocations_source_idx ON public.overtime_recovery_allocations(source_timesheet_id);
CREATE INDEX overtime_recovery_allocations_target_idx ON public.overtime_recovery_allocations(timesheet_id);

CREATE OR REPLACE FUNCTION public.approve_overtime_recovery(_source_timesheet_id uuid, _target_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 s public.timesheets%ROWTYPE;
 t public.timesheets%ROWTYPE;
 available integer;
 used integer;
 credit integer;
 applied integer := 0;
 affected integer := 0;
 old_late integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before approving recovery' USING ERRCODE='42501'; END IF;
 IF coalesce(array_length(_target_ids,1),0) > 5000 THEN RAISE EXCEPTION 'Too many attendance records'; END IF;
 SELECT * INTO s FROM public.timesheets WHERE id = _source_timesheet_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Overtime attendance record no longer exists'; END IF;
 IF NOT public.may_approve_wfh_recovery(s.employee_id,s.work_date) THEN
   RAISE EXCEPTION 'No permission to approve overtime recovery for this employee' USING ERRCODE='42501';
 END IF;
 IF s.status <> 'approved' OR coalesce(s.is_absent,false) OR coalesce(s.overtime_minutes,0) <= 0 THEN
   RETURN jsonb_build_object('minutes',0,'records',0,'available',0);
 END IF;
 SELECT coalesce(sum(minutes),0)::integer INTO used FROM public.overtime_recovery_allocations WHERE source_timesheet_id = s.id;
 available := greatest(0,s.overtime_minutes-used);
 FOR t IN SELECT * FROM public.timesheets WHERE id = ANY(_target_ids) AND employee_id = s.employee_id
   AND work_date > s.work_date AND late_minutes > 0 AND NOT coalesce(is_absent,false)
   AND status NOT IN ('vacation','holiday','wfh','rejected')
   ORDER BY work_date,id FOR UPDATE
 LOOP
   EXIT WHEN available <= 0;
   IF NOT public.may_approve_wfh_recovery(s.employee_id,t.work_date) THEN CONTINUE; END IF;
   IF EXISTS (SELECT 1 FROM public.vacation_requests v WHERE v.employee_id=s.employee_id AND v.status='approved' AND t.work_date BETWEEN v.start_date AND v.end_date)
     OR EXISTS (SELECT 1 FROM public.employee_requests r WHERE r.employee_id=s.employee_id AND r.status='approved' AND
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
   INSERT INTO public.overtime_recovery_allocations(source_timesheet_id,timesheet_id,employee_id,minutes,approved_by)
     VALUES(s.id,t.id,s.employee_id,credit,auth.uid());
   available := available-credit;
   applied := applied+credit;
   affected := affected+1;
 END LOOP;
 RETURN jsonb_build_object('minutes',applied,'records',affected,'available',available);
END;
$$;
REVOKE ALL ON FUNCTION public.approve_overtime_recovery(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_overtime_recovery(uuid,uuid[]) TO authenticated;