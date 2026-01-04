
-- Add balance column to track each vacation type's remaining days per employee
ALTER TABLE public.employee_vacation_types 
ADD COLUMN balance numeric DEFAULT 0;

-- Add used_days column to track days used
ALTER TABLE public.employee_vacation_types 
ADD COLUMN used_days numeric DEFAULT 0;

-- Add year column to track which year this balance is for
ALTER TABLE public.employee_vacation_types 
ADD COLUMN year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Add updated_at column
ALTER TABLE public.employee_vacation_types 
ADD COLUMN updated_at timestamp with time zone DEFAULT now();

-- Create unique constraint to prevent duplicate vacation types per employee per year
ALTER TABLE public.employee_vacation_types 
ADD CONSTRAINT unique_employee_vacation_year UNIQUE (employee_id, vacation_code_id, year);
