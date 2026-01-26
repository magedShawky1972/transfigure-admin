-- Add cost_center_id to expense_requests
ALTER TABLE public.expense_requests
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id);