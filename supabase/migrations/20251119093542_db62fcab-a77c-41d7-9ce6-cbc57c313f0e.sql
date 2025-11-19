-- Fix Security Issues: Restrict access to sensitive tables
-- Drop overly permissive policies and create role-based access control

-- Fix customers table
DROP POLICY IF EXISTS "Allow all operations on customers" ON public.customers;

CREATE POLICY "Authenticated users can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix purpletransaction table
DROP POLICY IF EXISTS "Allow all operations on PurpleTransaction" ON public.purpletransaction;

CREATE POLICY "Authenticated users can view transactions"
ON public.purpletransaction FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert transactions"
ON public.purpletransaction FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update transactions"
ON public.purpletransaction FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete transactions"
ON public.purpletransaction FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix products table
DROP POLICY IF EXISTS "Allow all operations on products" ON public.products;

CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix ordertotals table
DROP POLICY IF EXISTS "Allow all operations on ordertotals" ON public.ordertotals;

CREATE POLICY "Authenticated users can view ordertotals"
ON public.ordertotals FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert ordertotals"
ON public.ordertotals FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update ordertotals"
ON public.ordertotals FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete ordertotals"
ON public.ordertotals FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix brands table
DROP POLICY IF EXISTS "Allow all operations on brands" ON public.brands;

CREATE POLICY "Authenticated users can view brands"
ON public.brands FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert brands"
ON public.brands FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update brands"
ON public.brands FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete brands"
ON public.brands FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix payment_methods table
DROP POLICY IF EXISTS "Allow all operations on payment_methods" ON public.payment_methods;

CREATE POLICY "Authenticated users can view payment_methods"
ON public.payment_methods FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage payment_methods"
ON public.payment_methods FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix other sensitive tables
DROP POLICY IF EXISTS "Allow all operations on brand_type" ON public.brand_type;
DROP POLICY IF EXISTS "Allow all operations on excel_sheets" ON public.excel_sheets;
DROP POLICY IF EXISTS "Allow all operations on excel_column_mappings" ON public.excel_column_mappings;
DROP POLICY IF EXISTS "Allow all operations on generated_tables" ON public.generated_tables;
DROP POLICY IF EXISTS "Allow all operations on upload_logs" ON public.upload_logs;
DROP POLICY IF EXISTS "Allow all operations on odoo_api_config" ON public.odoo_api_config;
DROP POLICY IF EXISTS "Allow all operations on query_cache" ON public.query_cache;

CREATE POLICY "Authenticated users can view brand_type"
ON public.brand_type FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage brand_type"
ON public.brand_type FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view excel_sheets"
ON public.excel_sheets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage excel_sheets"
ON public.excel_sheets FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view excel_column_mappings"
ON public.excel_column_mappings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage excel_column_mappings"
ON public.excel_column_mappings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage generated_tables"
ON public.generated_tables FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view upload_logs"
ON public.upload_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage upload_logs"
ON public.upload_logs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage odoo_api_config"
ON public.odoo_api_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view query_cache"
ON public.query_cache FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage query_cache"
ON public.query_cache FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);