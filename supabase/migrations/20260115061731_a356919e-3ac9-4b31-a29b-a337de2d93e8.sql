-- Banks Setup
CREATE TABLE public.banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_code VARCHAR(20) NOT NULL UNIQUE,
  bank_name VARCHAR(100) NOT NULL,
  bank_name_ar VARCHAR(100),
  account_number VARCHAR(50),
  iban VARCHAR(50),
  swift_code VARCHAR(20),
  branch_name VARCHAR(100),
  currency_id UUID REFERENCES public.currencies(id),
  opening_balance NUMERIC(18,2) DEFAULT 0,
  current_balance NUMERIC(18,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Treasuries Setup
CREATE TABLE public.treasuries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treasury_code VARCHAR(20) NOT NULL UNIQUE,
  treasury_name VARCHAR(100) NOT NULL,
  treasury_name_ar VARCHAR(100),
  responsible_user_id UUID,
  department_id UUID REFERENCES public.departments(id),
  currency_id UUID REFERENCES public.currencies(id),
  opening_balance NUMERIC(18,2) DEFAULT 0,
  current_balance NUMERIC(18,2) DEFAULT 0,
  max_balance NUMERIC(18,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Expense Categories
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_code VARCHAR(20) NOT NULL UNIQUE,
  category_name VARCHAR(100) NOT NULL,
  category_name_ar VARCHAR(100),
  parent_category_id UUID REFERENCES public.expense_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses Setup (Types/Items)
CREATE TABLE public.expense_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_code VARCHAR(20) NOT NULL UNIQUE,
  expense_name VARCHAR(100) NOT NULL,
  expense_name_ar VARCHAR(100),
  category_id UUID REFERENCES public.expense_categories(id),
  default_account_code VARCHAR(20),
  is_asset BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expense Requests (Queue for Accounting)
CREATE TABLE public.expense_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number VARCHAR(30) NOT NULL UNIQUE,
  ticket_id UUID REFERENCES public.tickets(id),
  request_date TIMESTAMPTZ DEFAULT now(),
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency_id UUID REFERENCES public.currencies(id),
  expense_type_id UUID REFERENCES public.expense_types(id),
  is_asset BOOLEAN DEFAULT false,
  payment_method VARCHAR(20) CHECK (payment_method IN ('bank', 'treasury')),
  bank_id UUID REFERENCES public.banks(id),
  treasury_id UUID REFERENCES public.treasuries(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'classified', 'approved', 'paid', 'rejected', 'cancelled')),
  classified_by UUID,
  classified_at TIMESTAMPTZ,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_by UUID,
  paid_at TIMESTAMPTZ,
  requester_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Treasury Entries
CREATE TABLE public.treasury_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number VARCHAR(30) NOT NULL UNIQUE,
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id),
  entry_date TIMESTAMPTZ DEFAULT now(),
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('opening', 'receipt', 'payment', 'transfer')),
  amount NUMERIC(18,2) NOT NULL,
  balance_after NUMERIC(18,2),
  expense_request_id UUID REFERENCES public.expense_requests(id),
  reference_type VARCHAR(50),
  reference_id UUID,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected')),
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bank Entries
CREATE TABLE public.bank_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_number VARCHAR(30) NOT NULL UNIQUE,
  bank_id UUID NOT NULL REFERENCES public.banks(id),
  entry_date TIMESTAMPTZ DEFAULT now(),
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('opening', 'deposit', 'withdrawal', 'transfer', 'fee', 'interest')),
  amount NUMERIC(18,2) NOT NULL,
  balance_after NUMERIC(18,2),
  expense_request_id UUID REFERENCES public.expense_requests(id),
  check_number VARCHAR(50),
  reference_type VARCHAR(50),
  reference_id UUID,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'posted', 'rejected')),
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Treasury Opening Balance (separate tracking)
CREATE TABLE public.treasury_opening_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  treasury_id UUID NOT NULL REFERENCES public.treasuries(id),
  fiscal_year INTEGER NOT NULL,
  opening_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  notes TEXT,
  entered_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_opening_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies (authenticated users can read, write based on roles)
CREATE POLICY "Users can read banks" ON public.banks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage banks" ON public.banks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read treasuries" ON public.treasuries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage treasuries" ON public.treasuries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read expense_categories" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage expense_categories" ON public.expense_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read expense_types" ON public.expense_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage expense_types" ON public.expense_types FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read expense_requests" ON public.expense_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert expense_requests" ON public.expense_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update expense_requests" ON public.expense_requests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can read treasury_entries" ON public.treasury_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert treasury_entries" ON public.treasury_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update treasury_entries" ON public.treasury_entries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can read bank_entries" ON public.bank_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert bank_entries" ON public.bank_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update bank_entries" ON public.bank_entries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can read treasury_opening_balances" ON public.treasury_opening_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert treasury_opening_balances" ON public.treasury_opening_balances FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_expense_requests_status ON public.expense_requests(status);
CREATE INDEX idx_expense_requests_ticket ON public.expense_requests(ticket_id);
CREATE INDEX idx_treasury_entries_treasury ON public.treasury_entries(treasury_id);
CREATE INDEX idx_treasury_entries_status ON public.treasury_entries(status);
CREATE INDEX idx_bank_entries_bank ON public.bank_entries(bank_id);
CREATE INDEX idx_bank_entries_status ON public.bank_entries(status);

-- Function to generate expense request number
CREATE OR REPLACE FUNCTION public.generate_expense_request_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  counter := (SELECT COUNT(*) FROM public.expense_requests) + 1;
  new_number := 'EXP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  
  WHILE EXISTS (SELECT 1 FROM public.expense_requests WHERE request_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'EXP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(counter::TEXT, 4, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Trigger to set expense request number
CREATE OR REPLACE FUNCTION public.set_expense_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_expense_request_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_expense_request_number
BEFORE INSERT ON public.expense_requests
FOR EACH ROW EXECUTE FUNCTION set_expense_request_number();

-- Function to generate entry numbers
CREATE OR REPLACE FUNCTION public.generate_treasury_entry_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'TRE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COALESCE(MAX(SUBSTRING(entry_number FROM 14)::INT), 0) + 1 FROM public.treasury_entries WHERE entry_number LIKE 'TRE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%')::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_bank_entry_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'BNK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((SELECT COALESCE(MAX(SUBSTRING(entry_number FROM 14)::INT), 0) + 1 FROM public.bank_entries WHERE entry_number LIKE 'BNK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '%')::TEXT, 4, '0');
END;
$$;

-- Triggers for entry numbers
CREATE OR REPLACE FUNCTION public.set_treasury_entry_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number := generate_treasury_entry_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_treasury_entry_number
BEFORE INSERT ON public.treasury_entries
FOR EACH ROW EXECUTE FUNCTION set_treasury_entry_number();

CREATE OR REPLACE FUNCTION public.set_bank_entry_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_number IS NULL OR NEW.entry_number = '' THEN
    NEW.entry_number := generate_bank_entry_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_bank_entry_number
BEFORE INSERT ON public.bank_entries
FOR EACH ROW EXECUTE FUNCTION set_bank_entry_number();

-- Updated_at triggers
CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON public.banks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_treasuries_updated_at BEFORE UPDATE ON public.treasuries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_types_updated_at BEFORE UPDATE ON public.expense_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_requests_updated_at BEFORE UPDATE ON public.expense_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_treasury_entries_updated_at BEFORE UPDATE ON public.treasury_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_entries_updated_at BEFORE UPDATE ON public.bank_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();