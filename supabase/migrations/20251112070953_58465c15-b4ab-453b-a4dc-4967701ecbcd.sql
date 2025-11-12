-- Add odoo_product_id column to products table
ALTER TABLE public.products 
ADD COLUMN odoo_product_id integer NULL;