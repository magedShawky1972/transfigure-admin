-- Add product_api_url field to odoo_api_config table
ALTER TABLE odoo_api_config 
ADD COLUMN product_api_url text;