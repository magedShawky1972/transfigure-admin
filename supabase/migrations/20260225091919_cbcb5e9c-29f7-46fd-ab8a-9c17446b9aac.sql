
-- Create coins workflow supervisors table
CREATE TABLE public.coins_workflow_supervisors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.coins_workflow_supervisors ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can read, admins can manage
CREATE POLICY "Authenticated users can view supervisors"
ON public.coins_workflow_supervisors FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage supervisors"
ON public.coins_workflow_supervisors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_coins_workflow_supervisors_updated_at
BEFORE UPDATE ON public.coins_workflow_supervisors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add phase_updated_at to coins_purchase_orders to track delay per phase
ALTER TABLE public.coins_purchase_orders 
ADD COLUMN IF NOT EXISTS phase_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
