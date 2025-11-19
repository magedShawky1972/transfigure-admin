-- Create software_licenses table
CREATE TABLE public.software_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  software_name TEXT NOT NULL,
  version TEXT,
  license_key TEXT,
  vendor_provider TEXT NOT NULL,
  vendor_portal_url TEXT,
  category TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  expiry_date DATE,
  renewal_cycle TEXT NOT NULL CHECK (renewal_cycle IN ('monthly', 'yearly', 'one-time')),
  notification_days INTEGER[] DEFAULT ARRAY[7, 30],
  cost NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  assigned_to TEXT,
  assigned_department TEXT,
  invoice_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'expiring_soon')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.software_licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view software licenses"
ON public.software_licenses
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert software licenses"
ON public.software_licenses
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update software licenses"
ON public.software_licenses
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete software licenses"
ON public.software_licenses
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_software_licenses_updated_at
BEFORE UPDATE ON public.software_licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-update status based on expiry date
CREATE OR REPLACE FUNCTION public.update_software_license_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.software_licenses
  SET status = CASE
    WHEN expiry_date < CURRENT_DATE THEN 'expired'
    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'active'
  END
  WHERE expiry_date IS NOT NULL;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_software_licenses_expiry_date ON public.software_licenses(expiry_date);
CREATE INDEX idx_software_licenses_status ON public.software_licenses(status);
CREATE INDEX idx_software_licenses_category ON public.software_licenses(category);