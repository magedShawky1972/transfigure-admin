-- Create payment_methods table for storing payment method configurations
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_method TEXT NOT NULL UNIQUE,
  gateway_fee NUMERIC NOT NULL DEFAULT 0,
  fixed_value NUMERIC NOT NULL DEFAULT 0,
  vat_fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on payment_methods"
ON public.payment_methods
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default payment methods
INSERT INTO public.payment_methods (payment_method, gateway_fee, fixed_value, vat_fee) VALUES
('MADA', 0.8, 0, 15),
('VISA', 2.25, 1, 15),
('MASTER', 2.25, 1, 15),
('STC_PAY', 0.9, 0, 15),
('URPAY', 0.95, 0, 15);