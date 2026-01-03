
-- Add remaining SELECT policies for authenticated users

-- 1. ordertotals - Allow authenticated to view (correct table name)
CREATE POLICY "Authenticated users can view ordertotals"
ON public.ordertotals
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 2. payment_methods - Allow authenticated to view
CREATE POLICY "Authenticated users can view payment methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. products - Allow authenticated to view
CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 4. suppliers - Allow authenticated to view
CREATE POLICY "Authenticated users can view suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 5. shift_brand_balances - Allow all authenticated to view for reports
CREATE POLICY "Authenticated users can view shift brand balances"
ON public.shift_brand_balances
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 6. ludo_transactions - Allow all authenticated to view for reports
CREATE POLICY "Authenticated users can view ludo transactions"
ON public.ludo_transactions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 7. shift_sessions - For shift calendar and reports
CREATE POLICY "Authenticated users can view shift sessions"
ON public.shift_sessions
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 8. order_payment - For reports
CREATE POLICY "Authenticated users can view order payments"
ON public.order_payment
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 9. profiles - Allow authenticated to view basic profiles (for dropdowns, user selection)
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 10. shift_plans - Allow authenticated to view
CREATE POLICY "Authenticated users can view shift plans"
ON public.shift_plans
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 11. shift_plan_details - Allow authenticated to view
CREATE POLICY "Authenticated users can view shift plan details"
ON public.shift_plan_details
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- 12. shift_types - Allow authenticated to view
CREATE POLICY "Authenticated users can view shift types"
ON public.shift_types
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
