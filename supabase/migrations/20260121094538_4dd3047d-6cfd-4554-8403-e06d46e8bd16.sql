-- Add domain_name and mails columns to software_licenses table
ALTER TABLE public.software_licenses
ADD COLUMN IF NOT EXISTS domain_name TEXT,
ADD COLUMN IF NOT EXISTS mails TEXT;