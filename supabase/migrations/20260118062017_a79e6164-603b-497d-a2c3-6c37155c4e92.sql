-- Create bank_ledger table for tracking all bank transactions
CREATE TABLE public.bank_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_type TEXT NOT NULL, -- 'sales_in', 'bank_fee', 'bank_entry', 'expense_entry', 'transfer'
  reference_id UUID,
  reference_number TEXT,
  description TEXT,
  in_amount NUMERIC DEFAULT 0,
  out_amount NUMERIC DEFAULT 0,
  balance_after NUMERIC DEFAULT 0,
  currency_id UUID REFERENCES public.currencies(id),
  exchange_rate NUMERIC DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.bank_ledger ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view bank ledger entries"
  ON public.bank_ledger
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert bank ledger entries"
  ON public.bank_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update bank ledger entries"
  ON public.bank_ledger
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete bank ledger entries"
  ON public.bank_ledger
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_bank_ledger_bank_id ON public.bank_ledger(bank_id);
CREATE INDEX idx_bank_ledger_entry_date ON public.bank_ledger(entry_date);
CREATE INDEX idx_bank_ledger_reference_type ON public.bank_ledger(reference_type);
CREATE INDEX idx_bank_ledger_reference_id ON public.bank_ledger(reference_id);