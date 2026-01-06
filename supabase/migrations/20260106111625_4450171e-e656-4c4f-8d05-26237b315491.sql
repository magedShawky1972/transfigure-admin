-- Add unique constraint on original_order_number to prevent duplicate mappings
ALTER TABLE public.aggregated_order_mapping 
ADD CONSTRAINT aggregated_order_mapping_original_order_number_key 
UNIQUE (original_order_number);