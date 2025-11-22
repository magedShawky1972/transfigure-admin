-- Add field to track current approval level in tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS next_admin_order integer DEFAULT 1;

COMMENT ON COLUMN public.tickets.next_admin_order IS 'Tracks which admin order level should approve next (1 for first admin, 2 for second, etc.)';
