-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT UNIQUE,
  product_name TEXT NOT NULL,
  product_price TEXT,
  product_cost TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on products"
  ON public.products
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert unique products from purpletransaction
INSERT INTO public.products (product_id, product_name, product_price, product_cost)
SELECT DISTINCT 
  product_id,
  product_name,
  unit_price,
  cost_price
FROM public.purpletransaction
WHERE product_name IS NOT NULL
ON CONFLICT (product_id) DO NOTHING;