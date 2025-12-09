-- Add purchase ticket fields to tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS budget_value NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS qty NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT NULL;

-- Create UOM (Unit of Measure) table
CREATE TABLE IF NOT EXISTS public.uom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uom_code TEXT NOT NULL UNIQUE,
  uom_name TEXT NOT NULL,
  uom_name_ar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on uom table
ALTER TABLE public.uom ENABLE ROW LEVEL SECURITY;

-- Create policies for UOM table
CREATE POLICY "Authenticated users can view UOM" 
ON public.uom 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage UOM" 
ON public.uom 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow department admins to insert UOM (for adding new during ticket creation)
CREATE POLICY "Department admins can insert UOM" 
ON public.uom 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM department_admins da
    WHERE da.user_id = auth.uid()
  )
);

-- Allow any authenticated user to insert UOM for convenience during ticket creation
CREATE POLICY "Authenticated users can insert UOM" 
ON public.uom 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert some default UOM values
INSERT INTO public.uom (uom_code, uom_name, uom_name_ar) VALUES
  ('PCS', 'Pieces', 'قطعة'),
  ('BOX', 'Box', 'صندوق'),
  ('SET', 'Set', 'طقم'),
  ('KG', 'Kilogram', 'كيلوغرام'),
  ('LTR', 'Liter', 'لتر'),
  ('MTR', 'Meter', 'متر'),
  ('ROLL', 'Roll', 'رول'),
  ('PACK', 'Pack', 'علبة')
ON CONFLICT (uom_code) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_uom_updated_at
BEFORE UPDATE ON public.uom
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();