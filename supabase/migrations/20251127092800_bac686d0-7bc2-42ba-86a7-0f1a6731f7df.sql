-- Create ludo_training table for AI training
CREATE TABLE public.ludo_training (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_sku TEXT NOT NULL UNIQUE,
  image_path TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.ludo_training ENABLE ROW LEVEL SECURITY;

-- RLS policies for ludo_training
CREATE POLICY "Admins can manage ludo training"
  ON public.ludo_training
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create ludo_transactions table for manual charging transactions
CREATE TABLE public.ludo_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_session_id UUID NOT NULL REFERENCES public.shift_sessions(id) ON DELETE CASCADE,
  product_sku TEXT NOT NULL,
  order_number TEXT NOT NULL,
  player_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  image_path TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ludo_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for ludo_transactions
CREATE POLICY "Users can create their own ludo transactions"
  ON public.ludo_transactions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own ludo transactions"
  ON public.ludo_transactions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own ludo transactions"
  ON public.ludo_transactions
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own ludo transactions"
  ON public.ludo_transactions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all ludo transactions"
  ON public.ludo_transactions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for ludo receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('ludo-receipts', 'ludo-receipts', false);

-- Storage policies for ludo-receipts bucket
CREATE POLICY "Authenticated users can upload ludo receipts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'ludo-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view ludo receipts"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'ludo-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their ludo receipts"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'ludo-receipts' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their ludo receipts"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'ludo-receipts' AND auth.role() = 'authenticated');

-- Create sequence for ludo order numbers
CREATE SEQUENCE IF NOT EXISTS ludo_order_number_seq START 1;

-- Create function to generate LUDO order number
CREATE OR REPLACE FUNCTION public.generate_ludo_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  seq_val INTEGER;
BEGIN
  seq_val := nextval('ludo_order_number_seq');
  new_number := 'LUDO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_val::TEXT, 6, '0');
  RETURN new_number;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_ludo_training_updated_at
  BEFORE UPDATE ON public.ludo_training
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ludo_transactions_updated_at
  BEFORE UPDATE ON public.ludo_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();