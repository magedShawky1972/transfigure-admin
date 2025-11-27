-- Create table for storing closing training images per brand
CREATE TABLE public.brand_closing_training (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(brand_id)
);

-- Enable RLS
ALTER TABLE public.brand_closing_training ENABLE ROW LEVEL SECURITY;

-- Only admins can manage closing training
CREATE POLICY "Admins can manage closing training"
ON public.brand_closing_training
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for training images
INSERT INTO storage.buckets (id, name, public) VALUES ('closing-training', 'closing-training', true);

-- Storage policies for closing-training bucket
CREATE POLICY "Admins can upload closing training images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'closing-training' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update closing training images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'closing-training' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete closing training images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'closing-training' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view closing training images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'closing-training');

-- Trigger for updated_at
CREATE TRIGGER update_brand_closing_training_updated_at
BEFORE UPDATE ON public.brand_closing_training
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();