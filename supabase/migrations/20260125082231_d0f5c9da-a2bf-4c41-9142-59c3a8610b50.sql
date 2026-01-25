-- Add player_id column to testsalesheader table
ALTER TABLE public.testsalesheader ADD COLUMN IF NOT EXISTS player_id TEXT;

-- Add player_id column to sales_order_header table
ALTER TABLE public.sales_order_header ADD COLUMN IF NOT EXISTS player_id TEXT;

-- Add Player_Id field to api_field_configs for /api/salesheader
INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, is_required, field_note, field_order)
VALUES ('/api/salesheader', 'Player_Id', 'Text', false, 'Player identifier', 18)
ON CONFLICT DO NOTHING;