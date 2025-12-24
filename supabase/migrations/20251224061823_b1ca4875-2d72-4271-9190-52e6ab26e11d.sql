-- Add seq_number column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS seq_number SERIAL;

-- Create a function to get the next sequence number for a department
CREATE OR REPLACE FUNCTION public.get_next_task_seq_number(p_department_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(seq_number), 0) + 1 INTO next_seq
  FROM public.tasks
  WHERE department_id = p_department_id;
  
  RETURN next_seq;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create a trigger to auto-assign seq_number on insert
CREATE OR REPLACE FUNCTION public.set_task_seq_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.seq_number IS NULL OR NEW.seq_number = 0 THEN
    NEW.seq_number := public.get_next_task_seq_number(NEW.department_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS set_task_seq_number_trigger ON public.tasks;
CREATE TRIGGER set_task_seq_number_trigger
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_seq_number();

-- Update existing tasks with sequential numbers per department
WITH numbered_tasks AS (
  SELECT id, department_id,
         ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY created_at) as rn
  FROM public.tasks
  WHERE seq_number IS NULL OR seq_number = 0
)
UPDATE public.tasks t
SET seq_number = nt.rn
FROM numbered_tasks nt
WHERE t.id = nt.id;