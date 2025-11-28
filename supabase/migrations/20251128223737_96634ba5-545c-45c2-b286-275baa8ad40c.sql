-- Add shift_order column to shifts table
ALTER TABLE public.shifts ADD COLUMN shift_order integer NOT NULL DEFAULT 0;