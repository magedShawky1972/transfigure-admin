-- Add cost_center_id and balance_before to treasury_entries
ALTER TABLE public.treasury_entries
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
ADD COLUMN IF NOT EXISTS balance_before numeric;