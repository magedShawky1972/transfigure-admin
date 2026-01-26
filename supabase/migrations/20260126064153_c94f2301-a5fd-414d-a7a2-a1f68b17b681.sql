-- Add cost_center_id to tickets table for tracking which cost center the expense should be charged to
ALTER TABLE public.tickets 
ADD COLUMN cost_center_id UUID REFERENCES public.cost_centers(id);

-- Add comment for documentation
COMMENT ON COLUMN public.tickets.cost_center_id IS 'Cost center assigned during approval for purchase tickets';