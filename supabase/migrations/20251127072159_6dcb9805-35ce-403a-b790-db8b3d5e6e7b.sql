-- Create currencies table
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_code TEXT NOT NULL UNIQUE,
  currency_name TEXT NOT NULL,
  currency_name_ar TEXT,
  symbol TEXT,
  is_base BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create currency rates table (rates relative to base currency)
CREATE TABLE public.currency_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE CASCADE,
  rate_to_base NUMERIC NOT NULL DEFAULT 1,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(currency_id, effective_date)
);

-- Enable RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

-- RLS policies for currencies
CREATE POLICY "Authenticated users can view currencies"
ON public.currencies FOR SELECT
USING (true);

CREATE POLICY "Admins can manage currencies"
ON public.currencies FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for currency_rates
CREATE POLICY "Authenticated users can view currency rates"
ON public.currency_rates FOR SELECT
USING (true);

CREATE POLICY "Admins can manage currency rates"
ON public.currency_rates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at on currencies
CREATE TRIGGER update_currencies_updated_at
BEFORE UPDATE ON public.currencies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on currency_rates
CREATE TRIGGER update_currency_rates_updated_at
BEFORE UPDATE ON public.currency_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one base currency
CREATE OR REPLACE FUNCTION public.ensure_single_base_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_base = true THEN
    UPDATE public.currencies SET is_base = false WHERE id != NEW.id AND is_base = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to ensure single base currency
CREATE TRIGGER ensure_single_base_currency_trigger
BEFORE INSERT OR UPDATE ON public.currencies
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_base_currency();