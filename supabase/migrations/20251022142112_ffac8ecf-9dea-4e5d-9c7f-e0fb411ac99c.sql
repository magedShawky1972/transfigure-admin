-- Drop the existing unique constraint on payment_method
ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_payment_method_key;

-- Create a new unique constraint on the combination of payment_type and payment_method
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_type_method_unique UNIQUE (payment_type, payment_method);

COMMENT ON CONSTRAINT payment_methods_type_method_unique ON public.payment_methods IS 'Ensures unique combination of payment type and payment method';