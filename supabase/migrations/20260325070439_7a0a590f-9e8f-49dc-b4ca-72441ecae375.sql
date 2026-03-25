
-- Create api_transaction_mapping table
CREATE TABLE public.api_transaction_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_field text NOT NULL,
  source_table text NOT NULL DEFAULT 'fixed',
  source_field text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create api_integration_settings table (already exists but add trigger_mode and schedule fields)
-- First check if it needs new columns
ALTER TABLE public.api_integration_settings 
  ADD COLUMN IF NOT EXISTS trigger_mode text DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS schedule_interval_minutes int DEFAULT 60,
  ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_date date DEFAULT '2025-03-11';

-- Enable RLS
ALTER TABLE public.api_transaction_mapping ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_transaction_mapping - admin only
CREATE POLICY "Admins can manage transaction mappings" ON public.api_transaction_mapping
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Update trigger for updated_at
CREATE TRIGGER update_api_transaction_mapping_updated_at
  BEFORE UPDATE ON public.api_transaction_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
