-- Add purchase_type column to tickets table
-- 'expense' = subscription, services, etc. (creates expense_request when fully approved)
-- 'purchase' = physical items like mouse, keyboard (no auto expense_request)
ALTER TABLE public.tickets 
ADD COLUMN purchase_type VARCHAR(20) CHECK (purchase_type IN ('expense', 'purchase'));