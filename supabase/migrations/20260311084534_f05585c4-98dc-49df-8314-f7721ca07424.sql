
-- Sales Sheet Orders table
CREATE TABLE public.sales_sheet_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL DEFAULT '',
  brand_id UUID REFERENCES public.brands(id),
  coins_rate NUMERIC DEFAULT 0,
  extra_coins_rate NUMERIC DEFAULT 0,
  notes TEXT,
  current_phase TEXT NOT NULL DEFAULT 'entry',
  status TEXT NOT NULL DEFAULT 'active',
  phase_updated_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  accounting_approved_by UUID,
  accounting_approved_name TEXT,
  accounting_approved_at TIMESTAMPTZ,
  accounting_notes TEXT,
  bank_transfer_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Sheet Order Lines table
CREATE TABLE public.sales_sheet_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_order_id UUID NOT NULL REFERENCES public.sales_sheet_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL DEFAULT 1,
  seller_name TEXT NOT NULL DEFAULT '',
  brand_id UUID REFERENCES public.brands(id),
  usd_payment_amount NUMERIC DEFAULT 0,
  coins NUMERIC DEFAULT 0,
  extra_coins NUMERIC DEFAULT 0,
  rate NUMERIC DEFAULT 0,
  currency_id UUID,
  sar_rate NUMERIC DEFAULT 1,
  total_sar NUMERIC DEFAULT 0,
  notes TEXT,
  receiving_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Sheet Line Attachments
CREATE TABLE public.sales_sheet_line_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES public.sales_sheet_order_lines(id) ON DELETE CASCADE,
  sheet_order_id UUID NOT NULL REFERENCES public.sales_sheet_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INT,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales Sheet Workflow Assignments
CREATE TABLE public.sales_sheet_workflow_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(phase, user_id)
);

-- Auto-generate order number function
CREATE OR REPLACE FUNCTION public.generate_sales_sheet_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  counter := (SELECT COUNT(*) FROM public.sales_sheet_orders) + 1;
  new_number := 'SSHT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  WHILE EXISTS (SELECT 1 FROM public.sales_sheet_orders WHERE order_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'SSHT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  END LOOP;
  RETURN new_number;
END;
$$;

-- Trigger to set order number
CREATE OR REPLACE FUNCTION public.set_sales_sheet_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_sales_sheet_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_sales_sheet_order_number
  BEFORE INSERT ON public.sales_sheet_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sales_sheet_order_number();

-- Enable RLS
ALTER TABLE public.sales_sheet_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sheet_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sheet_line_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_sheet_workflow_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can manage sales_sheet_orders" ON public.sales_sheet_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sales_sheet_order_lines" ON public.sales_sheet_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sales_sheet_line_attachments" ON public.sales_sheet_line_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage sales_sheet_workflow_assignments" ON public.sales_sheet_workflow_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
