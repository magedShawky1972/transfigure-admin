-- Add column to track if admin level requires cost center selection for purchase tickets
ALTER TABLE public.department_admins 
ADD COLUMN requires_cost_center BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.department_admins.requires_cost_center IS 'When true, this admin must select a cost center when approving purchase tickets';