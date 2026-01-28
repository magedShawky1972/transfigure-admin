-- Add position_level column to job_positions for ordering positions within a department
ALTER TABLE public.job_positions ADD COLUMN IF NOT EXISTS position_level integer DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.job_positions.position_level IS 'Position level in hierarchy (0 = highest, higher numbers = lower in hierarchy)';