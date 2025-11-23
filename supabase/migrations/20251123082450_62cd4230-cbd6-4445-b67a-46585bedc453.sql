-- Rename type_name to zone_name in shift_types table
ALTER TABLE public.shift_types 
RENAME COLUMN type_name TO zone_name;

-- Add new type column for Sales/Support classification
ALTER TABLE public.shift_types 
ADD COLUMN type TEXT;

COMMENT ON COLUMN public.shift_types.zone_name IS 'Shift zone (e.g., Evening, Morning, Night, Rotating, Split)';
COMMENT ON COLUMN public.shift_types.type IS 'Shift type classification (e.g., Sales, Support)';