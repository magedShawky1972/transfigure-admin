
-- Create purpletransaction_temp table with same structure as purpletransaction
CREATE TABLE public.purpletransaction_temp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at_date TIMESTAMP WITHOUT TIME ZONE,
  order_number TEXT,
  user_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  brand_name TEXT,
  product_name TEXT,
  coins_number NUMERIC,
  unit_price NUMERIC,
  cost_price NUMERIC,
  qty NUMERIC,
  cost_sold NUMERIC,
  total NUMERIC,
  profit NUMERIC,
  payment_method TEXT,
  payment_type TEXT,
  payment_brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  vendor_name TEXT,
  product_id TEXT,
  order_status TEXT,
  bank_fee NUMERIC DEFAULT 0,
  trans_type TEXT,
  brand_code TEXT,
  created_at_date_int BIGINT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  company TEXT DEFAULT 'Purple'::text,
  sendodoo BOOLEAN DEFAULT false,
  customer_ip TEXT,
  device_fingerprint TEXT,
  transaction_location TEXT,
  ordernumber TEXT,
  payment_term TEXT,
  transaction_type TEXT,
  media TEXT,
  profit_center TEXT,
  status INTEGER,
  status_description TEXT,
  register_user_id INTEGER,
  player_id TEXT,
  is_point BOOLEAN DEFAULT false,
  point_value NUMERIC,
  is_api_reviewed BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.purpletransaction_temp ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for authenticated users
CREATE POLICY "Allow all operations on purpletransaction_temp"
ON public.purpletransaction_temp
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_purpletransaction_temp_updated_at
BEFORE UPDATE ON public.purpletransaction_temp
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add allow_salla_transaction permission column to api_keys
ALTER TABLE public.api_keys ADD COLUMN allow_salla_transaction BOOLEAN DEFAULT false;

-- Seed api_field_configs for the new Salla Transaction API
INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, is_required, field_note, field_order) VALUES
('/api/salla-transaction', 'Order_Number', 'Text', true, 'Primary Key (Upsert Key)', 1),
('/api/salla-transaction', 'Customer_Phone', 'Text', true, 'Customer phone number', 2),
('/api/salla-transaction', 'Customer_Name', 'Text', false, 'Customer name', 3),
('/api/salla-transaction', 'Order_Date', 'DateTime', true, 'Order date', 4),
('/api/salla-transaction', 'Brand_Name', 'Text', false, 'Brand name', 5),
('/api/salla-transaction', 'Brand_Code', 'Text', false, 'Brand code', 6),
('/api/salla-transaction', 'Product_Name', 'Text', false, 'Product name', 7),
('/api/salla-transaction', 'Product_Id', 'Text', false, 'Product identifier', 8),
('/api/salla-transaction', 'Coins_Number', 'Decimal', false, 'Number of coins', 9),
('/api/salla-transaction', 'Unit_Price', 'Decimal', false, 'Unit price', 10),
('/api/salla-transaction', 'Cost_Price', 'Decimal', false, 'Cost price', 11),
('/api/salla-transaction', 'Quantity', 'Decimal', false, 'Quantity', 12),
('/api/salla-transaction', 'Cost_Sold', 'Decimal', false, 'Total cost sold', 13),
('/api/salla-transaction', 'Total', 'Decimal', false, 'Total amount', 14),
('/api/salla-transaction', 'Profit', 'Decimal', false, 'Profit amount', 15),
('/api/salla-transaction', 'Payment_Method', 'Text', false, 'Payment method', 16),
('/api/salla-transaction', 'Payment_Type', 'Text', false, 'Payment type', 17),
('/api/salla-transaction', 'Payment_Brand', 'Text', false, 'Payment brand', 18),
('/api/salla-transaction', 'Company', 'Text', true, 'Company name', 19),
('/api/salla-transaction', 'Status', 'Int', false, 'Order status code', 20),
('/api/salla-transaction', 'Status_Description', 'Text', false, 'Status description', 21),
('/api/salla-transaction', 'Sales_Person', 'Text', false, 'Sales person name', 22),
('/api/salla-transaction', 'Transaction_Type', 'Text', false, 'automatic/Manual', 23),
('/api/salla-transaction', 'Media', 'Text', false, 'Marketing media source', 24),
('/api/salla-transaction', 'Profit_Center', 'Text', false, 'Salla/WebApp/MobApp', 25),
('/api/salla-transaction', 'Customer_IP', 'Text', false, 'Customer IP address', 26),
('/api/salla-transaction', 'Device_Fingerprint', 'Text', false, 'Device info', 27),
('/api/salla-transaction', 'Transaction_Location', 'Text', false, 'KSA, CAIRO etc', 28),
('/api/salla-transaction', 'Payment_Term', 'Text', false, 'immediate/15/30/60', 29),
('/api/salla-transaction', 'Player_Id', 'Text', false, 'Player identifier', 30),
('/api/salla-transaction', 'Point_Value', 'Decimal', false, 'Point value', 31),
('/api/salla-transaction', 'Point', 'Bit', false, 'Point flag (0=No, 1=Yes)', 32),
('/api/salla-transaction', 'Vendor_Name', 'Text', false, 'Vendor name', 33),
('/api/salla-transaction', 'Order_Status', 'Text', false, 'Order status text', 34);
