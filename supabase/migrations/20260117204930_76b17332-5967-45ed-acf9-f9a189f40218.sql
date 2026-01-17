-- Create expense_entries table (header)
CREATE TABLE public.expense_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number VARCHAR(30) NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_reference VARCHAR(100),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('bank', 'treasury')),
  bank_id UUID REFERENCES public.banks(id),
  treasury_id UUID REFERENCES public.treasuries(id),
  currency_id UUID REFERENCES public.currencies(id),
  exchange_rate NUMERIC(18,6) DEFAULT 1,
  subtotal NUMERIC(18,2) DEFAULT 0,
  total_vat NUMERIC(18,2) DEFAULT 0,
  grand_total NUMERIC(18,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'paid', 'rejected', 'cancelled')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_by UUID,
  paid_at TIMESTAMPTZ
);

-- Create expense_entry_lines table
CREATE TABLE public.expense_entry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_entry_id UUID NOT NULL REFERENCES public.expense_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  expense_type_id UUID REFERENCES public.expense_types(id),
  description TEXT,
  quantity NUMERIC(18,3) DEFAULT 1,
  unit_price NUMERIC(18,2) DEFAULT 0,
  total NUMERIC(18,2) DEFAULT 0,
  vat_percent NUMERIC(5,2) DEFAULT 0,
  vat_amount NUMERIC(18,2) DEFAULT 0,
  line_total NUMERIC(18,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense_entries
CREATE POLICY "Users can view all expense entries" 
ON public.expense_entries FOR SELECT USING (true);

CREATE POLICY "Users can insert expense entries" 
ON public.expense_entries FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update expense entries" 
ON public.expense_entries FOR UPDATE USING (true);

CREATE POLICY "Users can delete draft expense entries" 
ON public.expense_entries FOR DELETE USING (status = 'draft');

-- RLS policies for expense_entry_lines
CREATE POLICY "Users can view all expense entry lines" 
ON public.expense_entry_lines FOR SELECT USING (true);

CREATE POLICY "Users can insert expense entry lines" 
ON public.expense_entry_lines FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update expense entry lines" 
ON public.expense_entry_lines FOR UPDATE USING (true);

CREATE POLICY "Users can delete expense entry lines" 
ON public.expense_entry_lines FOR DELETE USING (true);

-- Create indexes
CREATE INDEX idx_expense_entries_entry_date ON public.expense_entries(entry_date);
CREATE INDEX idx_expense_entries_status ON public.expense_entries(status);
CREATE INDEX idx_expense_entries_bank_id ON public.expense_entries(bank_id);
CREATE INDEX idx_expense_entries_treasury_id ON public.expense_entries(treasury_id);
CREATE INDEX idx_expense_entry_lines_entry_id ON public.expense_entry_lines(expense_entry_id);

-- Add trigger for updated_at
CREATE TRIGGER update_expense_entries_updated_at
BEFORE UPDATE ON public.expense_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();