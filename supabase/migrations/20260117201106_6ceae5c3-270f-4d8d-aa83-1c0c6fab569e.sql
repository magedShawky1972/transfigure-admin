-- Create indexes for ordertotals table for better query performance
CREATE INDEX IF NOT EXISTS idx_ordertotals_payment_type ON public.ordertotals(payment_type);
CREATE INDEX IF NOT EXISTS idx_ordertotals_payment_type_lower ON public.ordertotals(LOWER(payment_type));

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_ordertotals_date_payment ON public.ordertotals(order_date_int, payment_type);