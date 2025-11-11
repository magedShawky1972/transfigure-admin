-- Create table for Odoo API configuration
CREATE TABLE public.odoo_api_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_url text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.odoo_api_config ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is admin-only)
CREATE POLICY "Allow all operations on odoo_api_config"
  ON public.odoo_api_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_odoo_api_config_updated_at
  BEFORE UPDATE ON public.odoo_api_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();