-- Create ordertotals table to store aggregated order data
CREATE TABLE public.ordertotals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  total NUMERIC,
  payment_method TEXT,
  payment_type TEXT,
  payment_brand TEXT,
  bank_fee NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordertotals ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on ordertotals" 
ON public.ordertotals 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ordertotals_updated_at
BEFORE UPDATE ON public.ordertotals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on order_number for better query performance
CREATE INDEX idx_ordertotals_order_number ON public.ordertotals(order_number);

-- Populate historical data from existing transactions
INSERT INTO public.ordertotals (order_number, total, payment_method, payment_type, payment_brand, bank_fee)
SELECT 
  order_number,
  SUM(total) as total,
  MAX(payment_method) as payment_method,
  MAX(payment_type) as payment_type,
  MAX(payment_brand) as payment_brand,
  0 as bank_fee
FROM public.purpletransaction
WHERE order_number IS NOT NULL
GROUP BY order_number
ON CONFLICT (order_number) DO NOTHING;

-- Now update bank fees for historical orders based on payment_brand
UPDATE public.ordertotals ot
SET bank_fee = (
  SELECT 
    CASE 
      WHEN ot.payment_method = 'point' THEN 0
      ELSE (
        (ot.total * COALESCE(pm.gateway_fee, 0) / 100 + COALESCE(pm.fixed_value, 0)) * 1.15
      )
    END
  FROM public.payment_methods pm
  WHERE LOWER(TRIM(pm.payment_method)) = LOWER(TRIM(ot.payment_brand))
  AND pm.is_active = true
  LIMIT 1
)
WHERE ot.payment_method != 'point' OR ot.payment_method IS NULL;