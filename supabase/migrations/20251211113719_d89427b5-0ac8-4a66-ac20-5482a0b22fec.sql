-- Create purchase_items table for predefined items
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  item_name_ar TEXT,
  item_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(item_name)
);

-- Enable RLS
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view active items" 
ON public.purchase_items 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage items" 
ON public.purchase_items 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert items" 
ON public.purchase_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_purchase_items_updated_at
BEFORE UPDATE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add item_id column to tickets table
ALTER TABLE public.tickets ADD COLUMN item_id UUID REFERENCES public.purchase_items(id);