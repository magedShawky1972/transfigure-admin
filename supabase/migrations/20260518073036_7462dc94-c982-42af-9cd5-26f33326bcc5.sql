CREATE TABLE IF NOT EXISTS public.expense_requests_archived (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL,
  request_number varchar NOT NULL,
  ticket_id uuid,
  request_date timestamptz,
  description text,
  amount numeric,
  currency_id uuid,
  expense_type_id uuid,
  is_asset boolean,
  payment_method varchar,
  bank_id uuid,
  treasury_id uuid,
  status varchar,
  classified_by uuid,
  classified_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  paid_by uuid,
  paid_at timestamptz,
  requester_id uuid,
  notes text,
  original_created_at timestamptz,
  original_updated_at timestamptz,
  purchase_item_id uuid,
  quantity numeric,
  uom_id uuid,
  unit_price numeric,
  tax_percent numeric,
  net_total numeric,
  exchange_rate numeric,
  base_currency_amount numeric,
  cost_center_id uuid,
  employee_request_id uuid,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  archive_reason text
);

ALTER TABLE public.expense_requests_archived ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expense_requests_archived"
  ON public.expense_requests_archived
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read expense_requests_archived"
  ON public.expense_requests_archived
  FOR SELECT
  TO authenticated
  USING (true);