-- Create official_holidays table for HR vacation calendar
CREATE TABLE public.official_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  holiday_name_ar TEXT,
  holiday_date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  year INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.official_holidays ENABLE ROW LEVEL SECURITY;

-- Create policies for read access (all authenticated users can view)
CREATE POLICY "All authenticated users can view official holidays" 
ON public.official_holidays 
FOR SELECT 
TO authenticated
USING (true);

-- Create policies for insert/update/delete (only admins - will be managed via edge functions)
CREATE POLICY "Authenticated users can insert official holidays" 
ON public.official_holidays 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update official holidays" 
ON public.official_holidays 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete official holidays" 
ON public.official_holidays 
FOR DELETE 
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_official_holidays_updated_at
BEFORE UPDATE ON public.official_holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some common Saudi Arabia official holidays as examples
INSERT INTO public.official_holidays (holiday_name, holiday_name_ar, holiday_date, is_recurring, year) VALUES
('Saudi National Day', 'اليوم الوطني السعودي', '2026-09-23', true, NULL),
('Founding Day', 'يوم التأسيس', '2026-02-22', true, NULL);