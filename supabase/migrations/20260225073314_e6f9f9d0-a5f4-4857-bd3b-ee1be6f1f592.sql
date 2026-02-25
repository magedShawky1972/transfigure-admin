
-- Create coins_purchase_attachments table for file uploads at any phase
CREATE TABLE public.coins_purchase_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.coins_purchase_orders(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'creation',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by TEXT,
  uploaded_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coins_purchase_attachments ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can CRUD
CREATE POLICY "Authenticated users can view attachments"
  ON public.coins_purchase_attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert attachments"
  ON public.coins_purchase_attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete attachments"
  ON public.coins_purchase_attachments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Index for faster lookup
CREATE INDEX idx_coins_purchase_attachments_order ON public.coins_purchase_attachments(purchase_order_id);
