CREATE OR REPLACE FUNCTION public.reconcile_employee_wfh_timesheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.timesheets
  SET status = 'wfh',
      is_absent = false,
      absence_reason = NULL,
      absence_has_notice = NULL,
      late_minutes = 0,
      early_leave_minutes = 0,
      deduction_amount = 0,
      deduction_rule_id = NULL,
      notes = CASE
        WHEN NEW.description IS NOT NULL AND btrim(NEW.description) <> ''
          THEN 'Employee WFH Day - ' || NEW.description
        ELSE 'Employee WFH Day'
      END,
      updated_at = now()
  WHERE employee_id = NEW.employee_id
    AND work_date = NEW.wfh_date;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reconcile_employee_wfh_timesheet_trigger ON public.employee_wfh_days;
CREATE TRIGGER reconcile_employee_wfh_timesheet_trigger
AFTER INSERT OR UPDATE OF employee_id, wfh_date, description
ON public.employee_wfh_days
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_employee_wfh_timesheet();

UPDATE public.timesheets t
SET status = 'wfh',
    is_absent = false,
    absence_reason = NULL,
    absence_has_notice = NULL,
    late_minutes = 0,
    early_leave_minutes = 0,
    deduction_amount = 0,
    deduction_rule_id = NULL,
    notes = CASE
      WHEN w.description IS NOT NULL AND btrim(w.description) <> ''
        THEN 'Employee WFH Day - ' || w.description
      ELSE 'Employee WFH Day'
    END,
    updated_at = now()
FROM public.employee_wfh_days w
WHERE t.employee_id = w.employee_id
  AND t.work_date = w.wfh_date
  AND (t.is_absent = true OR t.status IS DISTINCT FROM 'wfh');