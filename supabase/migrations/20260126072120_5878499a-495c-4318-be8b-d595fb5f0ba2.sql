-- Add exchange rate and base currency amount columns for expenses created from tickets
ALTER TABLE public.expense_requests 
ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS base_currency_amount numeric;