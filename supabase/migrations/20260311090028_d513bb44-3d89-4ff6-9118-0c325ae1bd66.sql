
-- Add current_phase to supplier_advance_payments
ALTER TABLE public.supplier_advance_payments 
ADD COLUMN IF NOT EXISTS current_phase text NOT NULL DEFAULT 'entry';

-- Update existing records based on boolean flags
UPDATE public.supplier_advance_payments SET current_phase = 'accounting' WHERE accounting_recorded = true;
UPDATE public.supplier_advance_payments SET current_phase = 'receiving' WHERE sent_for_receiving = true AND accounting_recorded = false;

-- Create workflow assignments table for advance payments
CREATE TABLE public.advance_payment_workflow_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL,
  user_id text NOT NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phase, user_id)
);

ALTER TABLE public.advance_payment_workflow_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view advance payment workflow assignments"
ON public.advance_payment_workflow_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert advance payment workflow assignments"
ON public.advance_payment_workflow_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete advance payment workflow assignments"
ON public.advance_payment_workflow_assignments FOR DELETE TO authenticated USING (true);
