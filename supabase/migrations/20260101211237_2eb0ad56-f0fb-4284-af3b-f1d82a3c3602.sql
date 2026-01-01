-- =====================================================
-- FIX REMAINING RLS POLICIES (Part 4 - Final Fixed)
-- =====================================================

-- 49. VACATION_CODES
DROP POLICY IF EXISTS "Authenticated can view vacation_codes" ON public.vacation_codes;
DROP POLICY IF EXISTS "Admins can manage vacation_codes" ON public.vacation_codes;
CREATE POLICY "Authenticated can view vacation_codes" ON public.vacation_codes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage vacation_codes" ON public.vacation_codes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 50. VACATION_REQUESTS - Admin only (uses employee_id, not user_id)
DROP POLICY IF EXISTS "Users view own vacation_requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Admins can manage vacation_requests" ON public.vacation_requests;
CREATE POLICY "Admins can view vacation_requests" ON public.vacation_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage vacation_requests" ON public.vacation_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 51. WHATSAPP_CONVERSATIONS
DROP POLICY IF EXISTS "Admins can view whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Admins can manage whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Admins can view whatsapp_conversations" ON public.whatsapp_conversations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage whatsapp_conversations" ON public.whatsapp_conversations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 52. WHATSAPP_MESSAGES
DROP POLICY IF EXISTS "Admins can view whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admins can manage whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Admins can view whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage whatsapp_messages" ON public.whatsapp_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));