-- Add payment_type column to payment_methods table
ALTER TABLE public.payment_methods
ADD COLUMN payment_type text;

-- Add comment to clarify the columns
COMMENT ON COLUMN public.payment_methods.payment_type IS 'Payment method type (e.g., Credit Card, Debit Card, etc.)';
COMMENT ON COLUMN public.payment_methods.payment_method IS 'Payment brand (e.g., VISA, MASTERCARD, MADA, etc.)';