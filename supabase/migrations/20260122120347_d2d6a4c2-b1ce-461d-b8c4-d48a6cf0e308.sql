-- Add cost_center_id column to expense_entries table
ALTER TABLE public.expense_entries 
ADD COLUMN cost_center_id UUID REFERENCES public.cost_centers(id);