-- Create saved_attendance table for storing reviewed attendance summaries
CREATE TABLE public.saved_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_code TEXT NOT NULL,
  attendance_date DATE NOT NULL,
  in_time TEXT,
  out_time TEXT,
  total_hours NUMERIC,
  expected_hours NUMERIC,
  difference_hours NUMERIC,
  record_status TEXT DEFAULT 'normal',
  vacation_type TEXT,
  deduction_rule_id UUID REFERENCES public.deduction_rules(id),
  deduction_amount NUMERIC DEFAULT 0,
  is_confirmed BOOLEAN DEFAULT false,
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  saved_by UUID NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  filter_from_date DATE,
  filter_to_date DATE,
  batch_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_code, attendance_date, batch_id)
);

-- Enable Row Level Security
ALTER TABLE public.saved_attendance ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Users can view saved attendance" 
ON public.saved_attendance 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert saved attendance" 
ON public.saved_attendance 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update saved attendance" 
ON public.saved_attendance 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Users can delete saved attendance" 
ON public.saved_attendance 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_attendance_updated_at
BEFORE UPDATE ON public.saved_attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_saved_attendance_employee_code ON public.saved_attendance(employee_code);
CREATE INDEX idx_saved_attendance_date ON public.saved_attendance(attendance_date);
CREATE INDEX idx_saved_attendance_batch ON public.saved_attendance(batch_id);
CREATE INDEX idx_saved_attendance_confirmed ON public.saved_attendance(is_confirmed);