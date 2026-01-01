-- Create attendance_types table
CREATE TABLE public.attendance_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_code VARCHAR(50) NOT NULL UNIQUE,
  type_name VARCHAR(100) NOT NULL,
  type_name_ar VARCHAR(100),
  description TEXT,
  is_shift_based BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view attendance_types"
  ON public.attendance_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attendance_types"
  ON public.attendance_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance_types"
  ON public.attendance_types FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete attendance_types"
  ON public.attendance_types FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_attendance_types_updated_at
  BEFORE UPDATE ON public.attendance_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add attendance_type_id to employees table
ALTER TABLE public.employees 
ADD COLUMN attendance_type_id UUID REFERENCES public.attendance_types(id);

-- Insert default attendance types
INSERT INTO public.attendance_types (type_code, type_name, type_name_ar, description, is_shift_based) VALUES
  ('FIXED', 'Fixed Time', 'وقت ثابت', 'Employee has fixed working hours', false),
  ('SHIFT', 'Shift Based', 'نظام الورديات', 'Employee follows shift calendar sessions', true);