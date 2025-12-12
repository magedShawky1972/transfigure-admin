-- Add department_id to job_positions to link jobs to departments
ALTER TABLE public.job_positions ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_job_positions_department_id ON public.job_positions(department_id);