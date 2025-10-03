-- Add target_table column to excel_sheets to track which table each sheet maps to
ALTER TABLE excel_sheets ADD COLUMN target_table text;