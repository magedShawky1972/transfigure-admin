
-- Coins Sheet Orders (header)
CREATE TABLE public.coins_sheet_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  current_phase TEXT NOT NULL DEFAULT 'creation',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  notes TEXT,
  bank_transfer_image TEXT,
  accounting_approved_by TEXT,
  accounting_approved_name TEXT,
  accounting_approved_at TIMESTAMPTZ,
  accounting_notes TEXT,
  creator_confirmed BOOLEAN DEFAULT false,
  creator_confirmed_at TIMESTAMPTZ,
  phase_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coins Sheet Order Lines
CREATE TABLE public.coins_sheet_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_order_id UUID NOT NULL REFERENCES public.coins_sheet_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL DEFAULT 1,
  seller_name TEXT NOT NULL,
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  coins NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC NOT NULL DEFAULT 0,
  currency_id UUID REFERENCES public.currencies(id),
  sar_rate NUMERIC NOT NULL DEFAULT 1,
  total_sar NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coins Sheet Workflow Assignments
CREATE TABLE public.coins_sheet_workflow_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(phase, user_id)
);

-- Enable RLS
ALTER TABLE public.coins_sheet_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_sheet_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_sheet_workflow_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can manage sheet orders" ON public.coins_sheet_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sheet order lines" ON public.coins_sheet_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sheet workflow assignments" ON public.coins_sheet_workflow_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_coins_sheet_orders_updated_at BEFORE UPDATE ON public.coins_sheet_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coins_sheet_order_lines_updated_at BEFORE UPDATE ON public.coins_sheet_order_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coins_sheet_workflow_assignments_updated_at BEFORE UPDATE ON public.coins_sheet_workflow_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for sheet bank transfer files
INSERT INTO storage.buckets (id, name, public) VALUES ('sheet-transfer-files', 'sheet-transfer-files', true);
CREATE POLICY "Authenticated users can upload sheet transfer files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sheet-transfer-files');
CREATE POLICY "Anyone can view sheet transfer files" ON storage.objects FOR SELECT USING (bucket_id = 'sheet-transfer-files');
CREATE POLICY "Authenticated users can delete sheet transfer files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sheet-transfer-files');

-- Auto-generate order number function
CREATE OR REPLACE FUNCTION public.generate_sheet_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  counter := (SELECT COUNT(*) FROM public.coins_sheet_orders) + 1;
  new_number := 'SHT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.coins_sheet_orders WHERE order_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'SHT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_sheet_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_sheet_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_sheet_order_number_trigger BEFORE INSERT ON public.coins_sheet_orders FOR EACH ROW EXECUTE FUNCTION public.set_sheet_order_number();
