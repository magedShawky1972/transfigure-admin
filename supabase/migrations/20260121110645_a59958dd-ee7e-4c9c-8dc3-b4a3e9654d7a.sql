-- Add cost columns to software_license_invoices table for AI-extracted invoice costs
ALTER TABLE public.software_license_invoices 
ADD COLUMN IF NOT EXISTS extracted_cost DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS cost_sar DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS ai_extraction_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS ai_extraction_error TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_software_license_invoices_license_id ON public.software_license_invoices(license_id);