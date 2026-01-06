-- Create table to store mapping of aggregated order numbers to original order numbers
CREATE TABLE public.aggregated_order_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aggregated_order_number TEXT NOT NULL,
  original_order_number TEXT NOT NULL,
  aggregation_date DATE NOT NULL,
  brand_name TEXT,
  payment_method TEXT,
  payment_brand TEXT,
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aggregated_order_mapping ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to insert
CREATE POLICY "Authenticated users can insert aggregated_order_mapping" 
ON public.aggregated_order_mapping 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create policy for authenticated users to select
CREATE POLICY "Authenticated users can select aggregated_order_mapping" 
ON public.aggregated_order_mapping 
FOR SELECT 
TO authenticated
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_aggregated_order_mapping_aggregated_number ON public.aggregated_order_mapping(aggregated_order_number);
CREATE INDEX idx_aggregated_order_mapping_original_number ON public.aggregated_order_mapping(original_order_number);
CREATE INDEX idx_aggregated_order_mapping_date ON public.aggregated_order_mapping(aggregation_date);