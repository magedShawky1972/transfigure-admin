-- Add 'canceled' to the allowed status values for software_licenses
ALTER TABLE public.software_licenses 
DROP CONSTRAINT IF EXISTS software_licenses_status_check;

ALTER TABLE public.software_licenses 
ADD CONSTRAINT software_licenses_status_check 
CHECK (status IN ('active', 'expired', 'expiring_soon', 'canceled'));