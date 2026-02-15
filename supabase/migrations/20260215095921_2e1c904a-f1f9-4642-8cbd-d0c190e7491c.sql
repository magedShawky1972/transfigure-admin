
-- Create receiving coins header table
CREATE TABLE public.receiving_coins_header (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  brand_id UUID REFERENCES public.brands(id),
  control_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_id UUID REFERENCES public.banks(id),
  receiver_name TEXT,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create receiving coins line table
CREATE TABLE public.receiving_coins_line (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES public.receiving_coins_header(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  coins NUMERIC(15,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,4) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) GENERATED ALWAYS AS (coins * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create receiving coins attachments table
CREATE TABLE public.receiving_coins_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES public.receiving_coins_header(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receiving_coins_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_coins_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_coins_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users
CREATE POLICY "Authenticated users can view receiving coins headers"
ON public.receiving_coins_header FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert receiving coins headers"
ON public.receiving_coins_header FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update receiving coins headers"
ON public.receiving_coins_header FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete receiving coins headers"
ON public.receiving_coins_header FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view receiving coins lines"
ON public.receiving_coins_line FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert receiving coins lines"
ON public.receiving_coins_line FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update receiving coins lines"
ON public.receiving_coins_line FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete receiving coins lines"
ON public.receiving_coins_line FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view receiving coins attachments"
ON public.receiving_coins_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert receiving coins attachments"
ON public.receiving_coins_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete receiving coins attachments"
ON public.receiving_coins_attachments FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_receiving_coins_header_updated_at
BEFORE UPDATE ON public.receiving_coins_header
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receiving_coins_line_updated_at
BEFORE UPDATE ON public.receiving_coins_line
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
