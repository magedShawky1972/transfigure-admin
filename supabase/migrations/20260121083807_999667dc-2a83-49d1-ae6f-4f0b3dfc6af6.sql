-- Create table for software license invoice history
CREATE TABLE IF NOT EXISTS public.software_license_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES public.software_licenses(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.software_license_invoices ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Users can view all invoices" ON public.software_license_invoices
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert invoices" ON public.software_license_invoices
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete invoices" ON public.software_license_invoices
  FOR DELETE TO authenticated USING (true);

-- Add index for faster lookups
CREATE INDEX idx_software_license_invoices_license_id ON public.software_license_invoices(license_id);