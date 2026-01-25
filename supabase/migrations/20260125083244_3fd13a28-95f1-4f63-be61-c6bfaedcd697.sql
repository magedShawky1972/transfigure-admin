-- Add is_point flag to sales order header tables
ALTER TABLE public.testsalesheader ADD COLUMN IF NOT EXISTS is_point BOOLEAN DEFAULT false;
ALTER TABLE public.sales_order_header ADD COLUMN IF NOT EXISTS is_point BOOLEAN DEFAULT false;

-- Update API field configs - remove Point from salesline and add to salesheader
DELETE FROM public.api_field_configs WHERE api_endpoint = '/api/salesline' AND field_name = 'Point';

INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, is_required, field_note, field_order)
VALUES ('/api/salesheader', 'Point', 'Bit', false, 'Point flag (0 = No, 1 = Yes)', 19)
ON CONFLICT DO NOTHING;