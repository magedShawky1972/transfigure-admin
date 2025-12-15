-- Add display_order and color columns to departments table for organizational chart customization
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_departments_display_order ON public.departments(display_order);