
-- Main workflow table for coins purchase orders
CREATE TABLE public.coins_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  bank_id UUID REFERENCES public.banks(id),
  currency_id UUID REFERENCES public.currencies(id),
  exchange_rate NUMERIC DEFAULT 1,
  amount_in_currency NUMERIC DEFAULT 0,
  base_amount_sar NUMERIC DEFAULT 0,
  bank_transfer_image TEXT,
  current_phase TEXT NOT NULL DEFAULT 'creation',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receiving records (multi-receiving support)
CREATE TABLE public.coins_purchase_receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.coins_purchase_orders(id) ON DELETE CASCADE,
  receiving_image TEXT,
  received_by TEXT NOT NULL,
  received_by_name TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  is_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  confirmed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflow assignment per brand per phase
CREATE TABLE public.coins_workflow_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  phase TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, phase, user_id)
);

-- Phase history / audit trail
CREATE TABLE public.coins_purchase_phase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.coins_purchase_orders(id) ON DELETE CASCADE,
  from_phase TEXT,
  to_phase TEXT NOT NULL,
  action TEXT NOT NULL,
  action_by TEXT NOT NULL,
  action_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sending confirmation fields on main order
ALTER TABLE public.coins_purchase_orders
  ADD COLUMN sending_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN sending_confirmed_by TEXT,
  ADD COLUMN sending_confirmed_at TIMESTAMPTZ,
  ADD COLUMN sending_confirmed_name TEXT;

-- Enable RLS
ALTER TABLE public.coins_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_purchase_receiving ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_workflow_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coins_purchase_phase_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can access
CREATE POLICY "Authenticated users can view coins_purchase_orders"
  ON public.coins_purchase_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert coins_purchase_orders"
  ON public.coins_purchase_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update coins_purchase_orders"
  ON public.coins_purchase_orders FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view coins_purchase_receiving"
  ON public.coins_purchase_receiving FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert coins_purchase_receiving"
  ON public.coins_purchase_receiving FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update coins_purchase_receiving"
  ON public.coins_purchase_receiving FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view coins_workflow_assignments"
  ON public.coins_workflow_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert coins_workflow_assignments"
  ON public.coins_workflow_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update coins_workflow_assignments"
  ON public.coins_workflow_assignments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete coins_workflow_assignments"
  ON public.coins_workflow_assignments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view coins_purchase_phase_history"
  ON public.coins_purchase_phase_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert coins_purchase_phase_history"
  ON public.coins_purchase_phase_history FOR INSERT TO authenticated WITH CHECK (true);

-- Sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS coins_purchase_order_seq START 1;

-- Trigger for updated_at
CREATE TRIGGER update_coins_purchase_orders_updated_at
  BEFORE UPDATE ON public.coins_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coins_workflow_assignments_updated_at
  BEFORE UPDATE ON public.coins_workflow_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
