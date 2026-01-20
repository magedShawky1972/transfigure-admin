-- Create test tables for all APIs

-- Test table for Sales Order Header
CREATE TABLE IF NOT EXISTS public.testsalesheader (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE,
  customer_phone TEXT,
  order_date TIMESTAMP WITH TIME ZONE,
  payment_term TEXT,
  sales_person TEXT,
  transaction_type TEXT,
  media TEXT,
  profit_center TEXT,
  company TEXT,
  status INTEGER,
  status_description TEXT,
  customer_ip TEXT,
  device_fingerprint TEXT,
  transaction_location TEXT,
  register_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.testsalesheader ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testsalesheader" ON public.testsalesheader FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testsalesheader_updated_at BEFORE UPDATE ON public.testsalesheader FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Test table for Sales Order Line
CREATE TABLE IF NOT EXISTS public.testsalesline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT,
  line_number INTEGER,
  line_status INTEGER,
  product_sku TEXT,
  product_id BIGINT,
  quantity DECIMAL,
  unit_price DECIMAL,
  total DECIMAL,
  coins_number DECIMAL,
  cost_price DECIMAL,
  total_cost DECIMAL,
  point DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_number, line_number)
);

ALTER TABLE public.testsalesline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testsalesline" ON public.testsalesline FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testsalesline_updated_at BEFORE UPDATE ON public.testsalesline FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Test table for Payment
CREATE TABLE IF NOT EXISTS public.testpayment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT,
  payment_method TEXT,
  payment_brand TEXT,
  payment_amount DECIMAL,
  payment_reference TEXT,
  payment_card_number TEXT,
  bank_transaction_id TEXT,
  redemption_ip TEXT,
  payment_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.testpayment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testpayment" ON public.testpayment FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testpayment_updated_at BEFORE UPDATE ON public.testpayment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Test table for Customer
CREATE TABLE IF NOT EXISTS public.testcustomers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_phone TEXT UNIQUE,
  customer_name TEXT,
  email TEXT,
  customer_group TEXT,
  status TEXT,
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  register_date TIMESTAMP WITH TIME ZONE,
  last_transaction TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.testcustomers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testcustomers" ON public.testcustomers FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testcustomers_updated_at BEFORE UPDATE ON public.testcustomers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Test table for Supplier Product
CREATE TABLE IF NOT EXISTS public.testsupplierproducts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_code TEXT,
  sku TEXT,
  date_from DATE,
  date_to DATE,
  price DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(supplier_code, sku, date_from)
);

ALTER TABLE public.testsupplierproducts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testsupplierproducts" ON public.testsupplierproducts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testsupplierproducts_updated_at BEFORE UPDATE ON public.testsupplierproducts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Test table for Brand
CREATE TABLE IF NOT EXISTS public.testbrands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_code TEXT UNIQUE,
  brand_name TEXT,
  brand_parent TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.testbrands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testbrands" ON public.testbrands FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testbrands_updated_at BEFORE UPDATE ON public.testbrands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Test table for Product
CREATE TABLE IF NOT EXISTS public.testproducts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT,
  sku TEXT UNIQUE,
  product_name TEXT,
  uom TEXT,
  brand_code TEXT,
  reorder_point DECIMAL,
  minimum_order_quantity DECIMAL,
  maximum_order_quantity DECIMAL,
  product_cost TEXT,
  product_price TEXT,
  meta_title_ar TEXT,
  meta_keywords_ar TEXT,
  meta_description_ar TEXT,
  meta_title_en TEXT,
  meta_keywords_en TEXT,
  meta_description_en TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.testproducts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to testproducts" ON public.testproducts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_testproducts_updated_at BEFORE UPDATE ON public.testproducts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();