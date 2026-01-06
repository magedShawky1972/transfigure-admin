-- Add ZK time attendance employee code field
ALTER TABLE public.employees 
ADD COLUMN zk_employee_code VARCHAR(50) NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.employees.zk_employee_code IS 'Employee code used in ZK time attendance machines';