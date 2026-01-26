-- Add point_value column to testsalesheader table
ALTER TABLE public.testsalesheader 
ADD COLUMN IF NOT EXISTS point_value DECIMAL(15,2) DEFAULT NULL;

-- Add point_value column to sales_order_header table
ALTER TABLE public.sales_order_header 
ADD COLUMN IF NOT EXISTS point_value DECIMAL(15,2) DEFAULT NULL;

-- Add field config for API documentation
INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, is_required, field_order, field_note)
VALUES ('/api/salesheader', 'Point_Value', 'Decimal', false, 18, 'Point value for the order')
ON CONFLICT (api_endpoint, field_name) DO UPDATE SET
  field_type = EXCLUDED.field_type,
  is_required = EXCLUDED.is_required,
  field_order = EXCLUDED.field_order,
  field_note = EXCLUDED.field_note;