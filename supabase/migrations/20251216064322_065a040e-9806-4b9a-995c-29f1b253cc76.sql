-- Add partner_profile_id column to suppliers table for Odoo integration
ALTER TABLE public.suppliers ADD COLUMN partner_profile_id integer;