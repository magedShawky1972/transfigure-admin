-- Add indexes for dashboard performance
-- These indexes will dramatically speed up date-range queries

-- Index on purpletransaction.created_at_date for date filtering
CREATE INDEX IF NOT EXISTS idx_purpletransaction_created_at_date 
ON public.purpletransaction(created_at_date);

-- Index on ordertotals.order_date for date filtering
CREATE INDEX IF NOT EXISTS idx_ordertotals_order_date 
ON public.ordertotals(order_date);

-- Composite index for common payment method queries
CREATE INDEX IF NOT EXISTS idx_purpletransaction_payment_method_date 
ON public.purpletransaction(payment_method, created_at_date);

-- Composite index for brand filtering with dates
CREATE INDEX IF NOT EXISTS idx_purpletransaction_brand_date 
ON public.purpletransaction(brand_name, created_at_date);

-- Index for user name queries
CREATE INDEX IF NOT EXISTS idx_purpletransaction_user_name 
ON public.purpletransaction(user_name) 
WHERE user_name IS NOT NULL;

-- Index for payment brand queries
CREATE INDEX IF NOT EXISTS idx_ordertotals_payment_brand_date 
ON public.ordertotals(payment_brand, order_date);

-- Analyze tables to update statistics
ANALYZE public.purpletransaction;
ANALYZE public.ordertotals;