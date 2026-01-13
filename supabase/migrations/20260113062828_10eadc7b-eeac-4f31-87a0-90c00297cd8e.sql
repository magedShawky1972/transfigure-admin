-- Add is_pk column to excel_column_mappings table
ALTER TABLE public.excel_column_mappings 
ADD COLUMN is_pk boolean NOT NULL DEFAULT false;