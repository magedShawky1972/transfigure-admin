-- Create manual sales orders tables to support draft (Save) + confirmed flow
CREATE TABLE IF NOT EXISTS public.manual_sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text,
  customer_phone text,
  payment_method text,
  sales_reference text,
  sales_person text,
  notes text,
  status text NOT NULL DEFAULT 'draft', -- 'draft' or 'confirmed'
  total_amount numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  total_coins numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manual_sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.manual_sales_orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  brand_id uuid,
  brand_code text,
  brand_name text,
  product_name text,
  coins_number numeric NOT NULL DEFAULT 0,
  qty numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_sales_order_lines_order_id ON public.manual_sales_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_manual_sales_orders_status ON public.manual_sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_manual_sales_orders_order_date ON public.manual_sales_orders(order_date);

ALTER TABLE public.manual_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_sales_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view manual sales orders"
ON public.manual_sales_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert manual sales orders"
ON public.manual_sales_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update manual sales orders"
ON public.manual_sales_orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Only drafts can be deleted"
ON public.manual_sales_orders FOR DELETE TO authenticated USING (status = 'draft');

CREATE POLICY "Authenticated users can view manual sales order lines"
ON public.manual_sales_order_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert manual sales order lines"
ON public.manual_sales_order_lines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update manual sales order lines"
ON public.manual_sales_order_lines FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete manual sales order lines"
ON public.manual_sales_order_lines FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_manual_sales_orders_updated_at
BEFORE UPDATE ON public.manual_sales_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_manual_sales_order_lines_updated_at
BEFORE UPDATE ON public.manual_sales_order_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();