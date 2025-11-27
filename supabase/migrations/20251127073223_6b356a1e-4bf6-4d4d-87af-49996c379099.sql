-- Add currency_id column to software_licenses table
ALTER TABLE public.software_licenses
ADD COLUMN currency_id uuid REFERENCES public.currencies(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_software_licenses_currency_id ON public.software_licenses(currency_id);