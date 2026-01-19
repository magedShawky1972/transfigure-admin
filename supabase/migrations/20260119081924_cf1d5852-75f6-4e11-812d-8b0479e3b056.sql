-- Add religion column to official_holidays table
ALTER TABLE public.official_holidays 
ADD COLUMN IF NOT EXISTS religion TEXT DEFAULT 'all' CHECK (religion IN ('all', 'muslim', 'christian', 'other'));