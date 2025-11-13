-- Create brand_type table
CREATE TABLE public.brand_type (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_code TEXT NOT NULL UNIQUE,
  type_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.brand_type ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on brand_type"
ON public.brand_type
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at
CREATE TRIGGER update_brand_type_updated_at
  BEFORE UPDATE ON public.brand_type
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();