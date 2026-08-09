CREATE OR REPLACE FUNCTION public.prevent_delete_employee_with_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payroll_count integer := 0;
  variable_count integer := 0;
  element_count integer := 0;
  attendance_count integer := 0;
BEGIN
  SELECT count(*) INTO payroll_count FROM public.payroll_run_lines WHERE employee_id = OLD.id;
  SELECT count(*) INTO variable_count FROM public.payroll_variable_entries WHERE employee_id = OLD.id;
  SELECT count(*) INTO element_count FROM public.payroll_employee_elements WHERE employee_id = OLD.id;

  IF OLD.zk_employee_code IS NOT NULL AND OLD.zk_employee_code <> '' THEN
    SELECT count(*) INTO attendance_count FROM public.saved_attendance WHERE employee_code = OLD.zk_employee_code;
  END IF;

  IF payroll_count > 0 OR variable_count > 0 OR element_count > 0 OR attendance_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete employee % % : has payroll or timesheet records (payroll lines: %, variable entries: %, payroll elements: %, timesheet rows: %). Set employment status to terminated instead.',
      OLD.first_name, OLD.last_name, payroll_count, variable_count, element_count, attendance_count
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_employee_with_payroll ON public.employees;

CREATE TRIGGER trg_prevent_delete_employee_with_payroll
BEFORE DELETE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_employee_with_payroll();