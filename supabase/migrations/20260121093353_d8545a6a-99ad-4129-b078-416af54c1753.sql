-- Add project_id column to software_licenses table
ALTER TABLE public.software_licenses
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;