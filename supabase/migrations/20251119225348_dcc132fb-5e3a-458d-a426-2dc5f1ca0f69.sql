-- Add columns to department_admins for purchase designation and ordering
ALTER TABLE public.department_admins 
ADD COLUMN is_purchase_admin BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN admin_order INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX idx_department_admins_order ON public.department_admins(department_id, admin_order);