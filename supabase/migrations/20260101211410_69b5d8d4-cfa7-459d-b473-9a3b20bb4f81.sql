-- =====================================================
-- ADD POLICIES FOR TABLES THAT LOST THEM
-- =====================================================

-- ORDER_PAYMENT - Admin only (financial)
CREATE POLICY "Admins can view order_payment" ON public.order_payment FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage order_payment" ON public.order_payment FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- QUERY_CACHE - Admin only
CREATE POLICY "Admins can manage query_cache" ON public.query_cache FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RIYADBANKSTATEMENT - Admin only (financial - CRITICAL)
CREATE POLICY "Admins can view riyadbankstatement" ON public.riyadbankstatement FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage riyadbankstatement" ON public.riyadbankstatement FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SHIFT_PLAN_DETAILS - Authenticated can view, admin can manage
CREATE POLICY "Authenticated can view shift_plan_details" ON public.shift_plan_details FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage shift_plan_details" ON public.shift_plan_details FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- SHIFT_PLANS - Authenticated can view, admin can manage
CREATE POLICY "Authenticated can view shift_plans" ON public.shift_plans FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage shift_plans" ON public.shift_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- TIMESHEETS - Admin only
CREATE POLICY "Admins can view timesheets" ON public.timesheets FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage timesheets" ON public.timesheets FOR ALL USING (public.has_role(auth.uid(), 'admin'));