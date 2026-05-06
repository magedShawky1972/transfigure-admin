ALTER TABLE public.supplier_advance_payments ADD COLUMN IF NOT EXISTS ref_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_supplier_advance_ref_number()
RETURNS TRIGGER AS $$
DECLARE
  v_date TEXT;
  v_seq INT;
  v_ref TEXT;
BEGIN
  IF NEW.ref_number IS NOT NULL AND NEW.ref_number <> '' THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('supplier_advance_ref_number'));
  v_date := to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD');
  SELECT COALESCE(MAX((regexp_replace(ref_number, '^SAP-' || v_date || '-', ''))::INT), 0) + 1
    INTO v_seq
    FROM public.supplier_advance_payments
   WHERE ref_number LIKE 'SAP-' || v_date || '-%';
  v_ref := 'SAP-' || v_date || '-' || lpad(v_seq::TEXT, 4, '0');
  NEW.ref_number := v_ref;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_generate_supplier_advance_ref_number ON public.supplier_advance_payments;
CREATE TRIGGER trg_generate_supplier_advance_ref_number
BEFORE INSERT ON public.supplier_advance_payments
FOR EACH ROW EXECUTE FUNCTION public.generate_supplier_advance_ref_number();

-- Backfill existing rows
DO $$
DECLARE
  r RECORD;
  v_date TEXT;
  v_seq INT;
BEGIN
  FOR r IN SELECT id, created_at FROM public.supplier_advance_payments WHERE ref_number IS NULL ORDER BY created_at LOOP
    v_date := to_char(r.created_at AT TIME ZONE 'Asia/Riyadh', 'YYYYMMDD');
    SELECT COALESCE(MAX((regexp_replace(ref_number, '^SAP-' || v_date || '-', ''))::INT), 0) + 1
      INTO v_seq
      FROM public.supplier_advance_payments
     WHERE ref_number LIKE 'SAP-' || v_date || '-%';
    UPDATE public.supplier_advance_payments
       SET ref_number = 'SAP-' || v_date || '-' || lpad(v_seq::TEXT, 4, '0')
     WHERE id = r.id;
  END LOOP;
END $$;