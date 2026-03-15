
ALTER TABLE public.sales_order_header ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.testsalesheader ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.sales_order_line ADD COLUMN IF NOT EXISTS vendor_name text;
ALTER TABLE public.testsalesline ADD COLUMN IF NOT EXISTS vendor_name text;

INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, field_order, is_required, field_note)
VALUES ('/api/salesheader', 'Customer_Name', 'Text', 16, false, 'Customer name (optional)');

INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, field_order, is_required, field_note)
VALUES ('/api/salesline', 'Vendor_Name', 'Text', 12, false, 'Vendor name (optional)');
