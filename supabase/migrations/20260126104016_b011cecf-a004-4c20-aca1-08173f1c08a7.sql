-- Create void_payment_history table to track voided payments with all details
CREATE TABLE public.void_payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  void_number TEXT NOT NULL UNIQUE,
  expense_request_id UUID NOT NULL,
  request_number TEXT NOT NULL,
  description TEXT,
  original_amount NUMERIC NOT NULL,
  treasury_amount NUMERIC,
  currency_code TEXT,
  treasury_currency_code TEXT,
  treasury_id UUID,
  treasury_name TEXT,
  treasury_entry_number TEXT,
  original_paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_by UUID NOT NULL,
  voided_by_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.void_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view void history" 
ON public.void_payment_history FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert void history" 
ON public.void_payment_history FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = voided_by);

-- Create function to generate void number
CREATE OR REPLACE FUNCTION public.generate_void_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  counter := (SELECT COUNT(*) FROM public.void_payment_history) + 1;
  new_number := 'VOID-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.void_payment_history WHERE void_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'VOID-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Trigger to auto-generate void number
CREATE OR REPLACE FUNCTION public.set_void_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.void_number IS NULL OR NEW.void_number = '' THEN
    NEW.void_number := generate_void_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_void_number_trigger
BEFORE INSERT ON public.void_payment_history
FOR EACH ROW
EXECUTE FUNCTION set_void_number();