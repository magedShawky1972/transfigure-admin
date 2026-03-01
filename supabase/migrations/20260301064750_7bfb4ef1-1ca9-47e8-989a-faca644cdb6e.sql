
-- Create supplier advance payments table
CREATE TABLE public.supplier_advance_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency_id UUID REFERENCES public.currencies(id),
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  transaction_amount NUMERIC NOT NULL DEFAULT 0,
  bank_fee NUMERIC NOT NULL DEFAULT 0,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  bank_transfer_image TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_advance_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can CRUD
CREATE POLICY "Authenticated users can view supplier advance payments"
ON public.supplier_advance_payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create supplier advance payments"
ON public.supplier_advance_payments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update supplier advance payments"
ON public.supplier_advance_payments FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete supplier advance payments"
ON public.supplier_advance_payments FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_supplier_advance_payments_updated_at
BEFORE UPDATE ON public.supplier_advance_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create attachments table for multiple documents
CREATE TABLE public.supplier_advance_payment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.supplier_advance_payments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_advance_payment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier advance payment attachments"
ON public.supplier_advance_payment_attachments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create supplier advance payment attachments"
ON public.supplier_advance_payment_attachments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete supplier advance payment attachments"
ON public.supplier_advance_payment_attachments FOR DELETE
TO authenticated
USING (true);
