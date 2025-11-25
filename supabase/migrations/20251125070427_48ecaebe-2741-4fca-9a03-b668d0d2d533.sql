-- Create table to store API field configurations
CREATE TABLE IF NOT EXISTS public.api_field_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_endpoint TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  field_note TEXT,
  field_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(api_endpoint, field_name)
);

-- Enable RLS
ALTER TABLE public.api_field_configs ENABLE ROW LEVEL SECURITY;

-- Admins can manage API field configs
CREATE POLICY "Admins can manage API field configs"
  ON public.api_field_configs
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view API field configs
CREATE POLICY "Authenticated users can view API field configs"
  ON public.api_field_configs
  FOR SELECT
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_api_field_configs_updated_at
  BEFORE UPDATE ON public.api_field_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial configuration for all APIs
INSERT INTO public.api_field_configs (api_endpoint, field_name, field_type, is_required, field_note, field_order) VALUES
  -- Sales Order Header
  ('/api/salesheader', 'Order_Number', 'Text', true, 'Primary Key', 1),
  ('/api/salesheader', 'Customer_Phone', 'Text', true, 'Foreign Key', 2),
  ('/api/salesheader', 'Order_date', 'DateTime', true, '', 3),
  ('/api/salesheader', 'Payment_Term', 'Text', false, 'immediate/15/30/60', 4),
  ('/api/salesheader', 'Sales_person', 'Text', false, 'Can be null', 5),
  ('/api/salesheader', 'Transaction_Type', 'Text', false, 'automatic/Manual', 6),
  ('/api/salesheader', 'Media', 'Text', false, 'Snap Chat/Google/Direct/LinkedIn', 7),
  ('/api/salesheader', 'Profit_Center', 'Text', false, 'WebApp/Salla/MobApp', 8),
  ('/api/salesheader', 'Company', 'Text', true, 'Asus/Purple/Ish7an', 9),
  ('/api/salesheader', 'Status', 'Int', false, '', 10),
  ('/api/salesheader', 'Status_Description', 'Text', false, '', 11),
  ('/api/salesheader', 'Customer_IP', 'Text', false, '', 12),
  ('/api/salesheader', 'Device_Fingerprint', 'Text', false, 'Chrome/119 | Windows 10 or IOS', 13),
  ('/api/salesheader', 'Transaction_Location', 'Text', false, 'KSA, CAIRO', 14),
  ('/api/salesheader', 'Register_User_ID', 'Text', false, '', 15),
  
  -- Sales Order Line
  ('/api/salesline', 'Order_Number', 'Text', true, 'Primary Key', 1),
  ('/api/salesline', 'Line_Number', 'Int', true, 'Primary Key', 2),
  ('/api/salesline', 'Line_Status', 'Int', true, '0 For Cancel/ 1 Confirm', 3),
  ('/api/salesline', 'Product_SKU', 'Text', false, '', 4),
  ('/api/salesline', 'Product_Id', 'BigInt', false, '', 5),
  ('/api/salesline', 'Quantity', 'Decimal', false, '', 6),
  ('/api/salesline', 'Unit_price', 'Decimal', false, '', 7),
  ('/api/salesline', 'Total', 'Decimal', false, '', 8),
  ('/api/salesline', 'Coins_Number', 'Decimal', false, '', 9),
  ('/api/salesline', 'Cost_Price', 'Decimal', false, '', 10),
  ('/api/salesline', 'Total_Cost', 'Decimal', false, '', 11),
  ('/api/salesline', 'Point', 'Decimal', false, '', 12),
  
  -- Payment
  ('/api/payment', 'Order_number', 'Text', true, 'Primary Key', 1),
  ('/api/payment', 'Payment_method', 'Text', true, 'hyperpay/ecom_payment/salla', 2),
  ('/api/payment', 'Payment_brand', 'Text', true, 'APPLEPAY-MADA/MASTER/VISA/KNET/MADA/MASTER/STC_PAY/URPAY/VISA', 3),
  ('/api/payment', 'Payment_Amount', 'Decimal', false, '', 4),
  ('/api/payment', 'Payment_reference', 'Text', false, '', 5),
  ('/api/payment', 'Payment_Card_Number', 'Text', false, 'Last 4 digits', 6),
  ('/api/payment', 'Bank_Transaction_Id', 'Text', false, '', 7),
  ('/api/payment', 'Redemption_IP', 'Text', false, '', 8),
  ('/api/payment', 'Payment_Location', 'Text', false, '', 9),
  
  -- Customer
  ('/api/customer', 'Customer_Phone', 'Text', true, 'Primary Key', 1),
  ('/api/customer', 'Customer_name', 'Text', true, '', 2),
  ('/api/customer', 'Customer_email', 'Text', false, '', 3),
  ('/api/customer', 'Customer_group', 'Text', false, 'Can be null', 4),
  ('/api/customer', 'Status', 'Bit', false, 'Active/Suspended', 5),
  ('/api/customer', 'Is_blocked', 'Bit', false, '0/1', 6),
  ('/api/customer', 'Block_reason', 'Text', false, '', 7),
  ('/api/customer', 'Register_date', 'DateTime', false, '', 8),
  ('/api/customer', 'Last_transaction', 'DateTime', false, '', 9),
  
  -- Supplier
  ('/api/supplier', 'Supplier_code', 'Text', true, 'Primary Key', 1),
  ('/api/supplier', 'Supplier_name', 'Text', true, '', 2),
  ('/api/supplier', 'Supplier_email', 'Text', false, '', 3),
  ('/api/supplier', 'Supplier_phone', 'Text', false, '', 4),
  ('/api/supplier', 'Status', 'Bit', false, 'Active/Suspended', 5),
  
  -- Supplier Product
  ('/api/supplierproduct', 'Supplier_code', 'Text', true, 'Primary Key', 1),
  ('/api/supplierproduct', 'SKU', 'Text', true, 'Foreign Key', 2),
  ('/api/supplierproduct', 'Date_From', 'Date', false, '', 3),
  ('/api/supplierproduct', 'Date_To', 'Date', false, '', 4),
  ('/api/supplierproduct', 'Price', 'Decimal', false, '', 5),
  
  -- Brand
  ('/api/brand', 'Brand_Code', 'Text', true, 'Primary Key', 1),
  ('/api/brand', 'Brand_Name', 'Text', true, '', 2),
  ('/api/brand', 'Brand_Parent', 'Text', false, '', 3),
  ('/api/brand', 'Status', 'Bit', false, 'Active/Suspended', 4),
  
  -- Product
  ('/api/product', 'Product_id', 'BigInt', true, 'Primary Key', 1),
  ('/api/product', 'SKU', 'Text', true, 'Primary Key', 2),
  ('/api/product', 'Name', 'Text', true, '', 3),
  ('/api/product', 'UOM', 'Text', false, '', 4),
  ('/api/product', 'Brand_Code', 'Text', false, 'Foreign Key', 5),
  ('/api/product', 'Reorder_Point', 'Decimal', false, '', 6),
  ('/api/product', 'Minimum_order', 'Decimal', false, '', 7),
  ('/api/product', 'Maximum_order', 'Decimal', false, '', 8),
  ('/api/product', 'Cost_price', 'Decimal', false, '', 9),
  ('/api/product', 'Sales_Price', 'Decimal', false, '', 10),
  ('/api/product', 'AR_Meta_Title', 'Text', false, '', 11),
  ('/api/product', 'AR_Meta_Keywords', 'Text', false, '', 12),
  ('/api/product', 'AR_Meta_Description', 'Text', false, '', 13),
  ('/api/product', 'ENG_Meta_Title', 'Text', false, '', 14),
  ('/api/product', 'ENG_Meta_Keywords', 'Text', false, '', 15),
  ('/api/product', 'ENG_Meta_Description', 'Text', false, '', 16)
ON CONFLICT (api_endpoint, field_name) DO NOTHING;