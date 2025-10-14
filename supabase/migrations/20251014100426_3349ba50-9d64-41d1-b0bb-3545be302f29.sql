-- Create brands table
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active'
);

-- Enable Row Level Security
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Create policy for brands
CREATE POLICY "Allow all operations on brands"
ON public.brands
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert unique brands from purpletransaction
INSERT INTO public.brands (brand_name)
SELECT DISTINCT brand_name
FROM public.purpletransaction
WHERE brand_name IS NOT NULL AND brand_name != ''
ON CONFLICT (brand_name) DO NOTHING;