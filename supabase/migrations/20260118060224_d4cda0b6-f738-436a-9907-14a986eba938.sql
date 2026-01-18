-- Create treasury ledger table to track all treasury transactions
CREATE TABLE public.treasury_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treasury_id UUID REFERENCES public.treasuries(id),
  bank_id UUID REFERENCES public.banks(id),
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_type TEXT NOT NULL, -- 'expense_entry', 'bank_entry', 'treasury_entry', etc.
  reference_id UUID NOT NULL,
  reference_number TEXT,
  description TEXT,
  debit_amount NUMERIC(15,2) DEFAULT 0,
  credit_amount NUMERIC(15,2) DEFAULT 0,
  balance_after NUMERIC(15,2),
  currency_id UUID REFERENCES public.currencies(id),
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT chk_treasury_or_bank CHECK (
    (treasury_id IS NOT NULL AND bank_id IS NULL) OR 
    (treasury_id IS NULL AND bank_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;

-- Create policies for treasury ledger
CREATE POLICY "Users can view treasury ledger" 
ON public.treasury_ledger 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert treasury ledger entries" 
ON public.treasury_ledger 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_treasury_ledger_treasury_id ON public.treasury_ledger(treasury_id);
CREATE INDEX idx_treasury_ledger_bank_id ON public.treasury_ledger(bank_id);
CREATE INDEX idx_treasury_ledger_entry_date ON public.treasury_ledger(entry_date);
CREATE INDEX idx_treasury_ledger_reference ON public.treasury_ledger(reference_type, reference_id);

-- Add trigger for updated_at if needed
CREATE TRIGGER update_treasury_ledger_updated_at
BEFORE UPDATE ON public.treasury_ledger
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();