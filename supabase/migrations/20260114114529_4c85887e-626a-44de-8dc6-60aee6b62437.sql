-- Create junction table for holiday-attendance type relationship
CREATE TABLE public.holiday_attendance_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_id UUID NOT NULL REFERENCES public.official_holidays(id) ON DELETE CASCADE,
  attendance_type_id UUID NOT NULL REFERENCES public.attendance_types(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(holiday_id, attendance_type_id)
);

-- Enable Row Level Security
ALTER TABLE public.holiday_attendance_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can view holiday attendance types" 
ON public.holiday_attendance_types 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert holiday attendance types" 
ON public.holiday_attendance_types 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update holiday attendance types" 
ON public.holiday_attendance_types 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete holiday attendance types" 
ON public.holiday_attendance_types 
FOR DELETE 
TO authenticated 
USING (true);