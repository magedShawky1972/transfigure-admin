-- Add skip_first_row column to excel_sheets table
ALTER TABLE public.excel_sheets ADD COLUMN skip_first_row BOOLEAN NOT NULL DEFAULT false;