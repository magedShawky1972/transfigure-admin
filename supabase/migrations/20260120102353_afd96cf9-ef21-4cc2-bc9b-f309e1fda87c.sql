-- Create testsuppliers table for API testing
CREATE TABLE IF NOT EXISTS public.testsuppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_code TEXT,
  supplier_name TEXT,
  supplier_email TEXT,
  supplier_phone TEXT,
  status INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on supplier_code for upsert
ALTER TABLE public.testsuppliers ADD CONSTRAINT testsuppliers_supplier_code_key UNIQUE (supplier_code);

-- Enable RLS
ALTER TABLE public.testsuppliers ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for API access
CREATE POLICY "Allow all access to testsuppliers" 
ON public.testsuppliers 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_testsuppliers_updated_at
BEFORE UPDATE ON public.testsuppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();