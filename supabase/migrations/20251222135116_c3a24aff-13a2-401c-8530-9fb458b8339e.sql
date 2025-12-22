-- Add closing_notes column for user comments when closing shift
ALTER TABLE public.shift_sessions ADD COLUMN closing_notes TEXT;

-- Add admin_notes column for shift admin notes (can be added/edited after close)
ALTER TABLE public.shift_sessions ADD COLUMN admin_notes TEXT;