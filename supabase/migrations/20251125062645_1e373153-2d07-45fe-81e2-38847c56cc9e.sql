-- Create API keys table for managing external API access
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- API endpoint permissions
  allow_sales_header BOOLEAN NOT NULL DEFAULT false,
  allow_sales_line BOOLEAN NOT NULL DEFAULT false,
  allow_payment BOOLEAN NOT NULL DEFAULT false,
  allow_customer BOOLEAN NOT NULL DEFAULT false,
  allow_supplier BOOLEAN NOT NULL DEFAULT false,
  allow_supplier_product BOOLEAN NOT NULL DEFAULT false,
  allow_brand BOOLEAN NOT NULL DEFAULT false,
  allow_product BOOLEAN NOT NULL DEFAULT false
);

-- Create sales order header table
CREATE TABLE IF NOT EXISTS public.sales_order_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_phone TEXT NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL,
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

-- Create sales order line table
CREATE TABLE IF NOT EXISTS public.sales_order_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  line_status INTEGER NOT NULL DEFAULT 1,
  product_sku TEXT,
  product_id BIGINT,
  quantity NUMERIC,
  unit_price NUMERIC,
  total NUMERIC,
  coins_number NUMERIC,
  cost_price NUMERIC,
  total_cost NUMERIC,
  point NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_number, line_number)
);

-- Create payment transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  payment_method TEXT,
  payment_brand TEXT,
  payment_amount NUMERIC,
  payment_reference TEXT,
  payment_card_number TEXT,
  bank_transaction_id TEXT,
  redemption_ip TEXT,
  payment_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code TEXT NOT NULL UNIQUE,
  supplier_name TEXT NOT NULL,
  supplier_email TEXT,
  supplier_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create supplier products table
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code TEXT NOT NULL,
  sku TEXT NOT NULL,
  date_from DATE,
  date_to DATE,
  price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(supplier_code, sku, date_from)
);

-- Enable RLS on all tables
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_header ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys (admin only)
CREATE POLICY "Admins can manage API keys"
ON public.api_keys
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for sales_order_header (admin only for now)
CREATE POLICY "Admins can manage sales orders"
ON public.sales_order_header
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for sales_order_line (admin only)
CREATE POLICY "Admins can manage sales order lines"
ON public.sales_order_line
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for payment_transactions (admin only)
CREATE POLICY "Admins can manage payment transactions"
ON public.payment_transactions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for suppliers (admin only)
CREATE POLICY "Admins can manage suppliers"
ON public.suppliers
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for supplier_products (admin only)
CREATE POLICY "Admins can manage supplier products"
ON public.supplier_products
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_sales_order_header_order_number ON public.sales_order_header(order_number);
CREATE INDEX idx_sales_order_header_customer_phone ON public.sales_order_header(customer_phone);
CREATE INDEX idx_sales_order_line_order_number ON public.sales_order_line(order_number);
CREATE INDEX idx_payment_transactions_order_number ON public.payment_transactions(order_number);
CREATE INDEX idx_supplier_products_supplier_code ON public.supplier_products(supplier_code);
CREATE INDEX idx_supplier_products_sku ON public.supplier_products(sku);

-- Create trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_header_updated_at
BEFORE UPDATE ON public.sales_order_header
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_order_line_updated_at
BEFORE UPDATE ON public.sales_order_line
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();