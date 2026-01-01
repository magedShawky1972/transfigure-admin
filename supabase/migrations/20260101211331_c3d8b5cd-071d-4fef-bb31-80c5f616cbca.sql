-- =====================================================
-- CLEANUP ALL REMAINING OLD PERMISSIVE POLICIES
-- =====================================================

-- MEDICAL_INSURANCE_PLANS
DROP POLICY IF EXISTS "Authenticated users can manage insurance plans" ON public.medical_insurance_plans;
DROP POLICY IF EXISTS "Authenticated users can view insurance plans" ON public.medical_insurance_plans;

-- ORDER_PAYMENT
DROP POLICY IF EXISTS "Allow all operations on Order_Payment" ON public.order_payment;

-- ORDERTOTALS
DROP POLICY IF EXISTS "Authenticated users can view ordertotals" ON public.ordertotals;

-- PAYMENT_METHODS
DROP POLICY IF EXISTS "Authenticated users can view payment_methods" ON public.payment_methods;

-- PRODUCTS
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;

-- PROFILES
DROP POLICY IF EXISTS "Allow counting profiles for system check" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;

-- PURPLETRANSACTION
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.purpletransaction;

-- QUERY_CACHE
DROP POLICY IF EXISTS "Authenticated users can view query_cache" ON public.query_cache;
DROP POLICY IF EXISTS "System can manage query_cache" ON public.query_cache;

-- RIYADBANKSTATEMENT
DROP POLICY IF EXISTS "Allow all operations on riyadbankstatement" ON public.riyadbankstatement;

-- SHIFT_ADMINS
DROP POLICY IF EXISTS "Authenticated users can view shift admins" ON public.shift_admins;

-- SHIFT_ASSIGNMENTS
DROP POLICY IF EXISTS "Authenticated users can view shift assignments" ON public.shift_assignments;

-- SHIFT_JOB_POSITIONS
DROP POLICY IF EXISTS "Authenticated users can view shift job positions" ON public.shift_job_positions;

-- SHIFT_PLAN_DETAILS
DROP POLICY IF EXISTS "Authenticated users can manage shift plan details" ON public.shift_plan_details;
DROP POLICY IF EXISTS "Authenticated users can view shift plan details" ON public.shift_plan_details;

-- SHIFT_PLANS
DROP POLICY IF EXISTS "Authenticated users can manage shift plans" ON public.shift_plans;
DROP POLICY IF EXISTS "Authenticated users can view shift plans" ON public.shift_plans;

-- SHIFT_TYPES
DROP POLICY IF EXISTS "Authenticated users can view shift types" ON public.shift_types;

-- SHIFTS
DROP POLICY IF EXISTS "Authenticated users can view shifts" ON public.shifts;

-- SOFTWARE_LICENSES
DROP POLICY IF EXISTS "Authenticated users can view software licenses" ON public.software_licenses;

-- SUPPLIERS
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;

-- SYSTEM_BACKUPS
DROP POLICY IF EXISTS "Authenticated users can delete backups" ON public.system_backups;
DROP POLICY IF EXISTS "Authenticated users can update backups" ON public.system_backups;
DROP POLICY IF EXISTS "Authenticated users can view backups" ON public.system_backups;

-- TIMESHEETS
DROP POLICY IF EXISTS "Authenticated users can manage timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Authenticated users can view timesheets" ON public.timesheets;

-- UOM
DROP POLICY IF EXISTS "Authenticated users can view UOM" ON public.uom;

-- UPLOAD_LOGS
DROP POLICY IF EXISTS "Authenticated users can view upload_logs" ON public.upload_logs;

-- USER_GROUP_MEMBERS
DROP POLICY IF EXISTS "Authenticated users can view group members" ON public.user_group_members;

-- USER_GROUPS
DROP POLICY IF EXISTS "Authenticated users can view user groups" ON public.user_groups;

-- VACATION_CODES
DROP POLICY IF EXISTS "Authenticated users can manage vacation codes" ON public.vacation_codes;
DROP POLICY IF EXISTS "Authenticated users can view vacation codes" ON public.vacation_codes;

-- VACATION_REQUESTS
DROP POLICY IF EXISTS "Authenticated users can manage vacation requests" ON public.vacation_requests;
DROP POLICY IF EXISTS "Authenticated users can view vacation requests" ON public.vacation_requests;

-- WHATSAPP_CONVERSATIONS
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON public.whatsapp_conversations;

-- WHATSAPP_MESSAGES
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.whatsapp_messages;

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Admins can insert all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;