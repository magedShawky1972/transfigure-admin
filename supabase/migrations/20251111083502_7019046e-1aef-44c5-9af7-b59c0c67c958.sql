-- Add order_date column to ordertotals table to store the actual transaction date
ALTER TABLE public.ordertotals 
ADD COLUMN order_date timestamp without time zone;

-- Create index for better query performance
CREATE INDEX idx_ordertotals_order_date ON public.ordertotals(order_date);

-- Update existing records to set order_date from purpletransaction
UPDATE public.ordertotals ot
SET order_date = pt.created_at_date
FROM (
  SELECT order_number, MIN(created_at_date) as created_at_date
  FROM public.purpletransaction
  WHERE order_number IS NOT NULL
  GROUP BY order_number
) pt
WHERE ot.order_number = pt.order_number
  AND ot.order_date IS NULL;