-- Create temp_ludo_transactions table for storing pending transactions
CREATE TABLE public.temp_ludo_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_sku TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  player_id TEXT,
  transaction_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.temp_ludo_transactions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own temp transactions
CREATE POLICY "Users can view their own temp transactions"
ON public.temp_ludo_transactions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own temp transactions"
ON public.temp_ludo_transactions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own temp transactions"
ON public.temp_ludo_transactions
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own temp transactions"
ON public.temp_ludo_transactions
FOR DELETE
USING (user_id = auth.uid());

-- Admins can manage all temp transactions
CREATE POLICY "Admins can manage all temp transactions"
ON public.temp_ludo_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));