-- Add partner_profile_id and res_partner_id fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS partner_profile_id integer,
ADD COLUMN IF NOT EXISTS res_partner_id integer;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.partner_profile_id IS 'Partner profile ID from Odoo (primary partner ID)';
COMMENT ON COLUMN public.customers.res_partner_id IS 'Resource partner ID from Odoo';

-- Update existing records to set partner_profile_id from partner_id if it exists
UPDATE public.customers 
SET partner_profile_id = partner_id 
WHERE partner_id IS NOT NULL AND partner_profile_id IS NULL;