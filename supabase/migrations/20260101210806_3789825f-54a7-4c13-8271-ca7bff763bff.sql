-- =====================================================
-- FIX ALL OVERLY PERMISSIVE RLS POLICIES
-- Change from "true" to proper authentication checks
-- =====================================================

-- 1. API_FIELD_CONFIGS - Admin only
DROP POLICY IF EXISTS "Authenticated users can view API field configs" ON public.api_field_configs;
CREATE POLICY "Admins can view API field configs" ON public.api_field_configs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 2. ATTENDANCE_TYPES - Admin only for management
DROP POLICY IF EXISTS "Authenticated users can view attendance_types" ON public.attendance_types;
DROP POLICY IF EXISTS "Authenticated users can insert attendance_types" ON public.attendance_types;
DROP POLICY IF EXISTS "Authenticated users can update attendance_types" ON public.attendance_types;
DROP POLICY IF EXISTS "Authenticated users can delete attendance_types" ON public.attendance_types;
CREATE POLICY "Authenticated can view attendance_types" ON public.attendance_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert attendance_types" ON public.attendance_types FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update attendance_types" ON public.attendance_types FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete attendance_types" ON public.attendance_types FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 3. BACKGROUND_SYNC_JOBS - Admin only
DROP POLICY IF EXISTS "Service role can manage all jobs" ON public.background_sync_jobs;
CREATE POLICY "Admins can manage sync jobs" ON public.background_sync_jobs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4. BRAND_CLOSING_TRAINING - Admin only for management, authenticated can view
DROP POLICY IF EXISTS "Authenticated users can view closing training" ON public.brand_closing_training;
DROP POLICY IF EXISTS "Authenticated users can insert closing training" ON public.brand_closing_training;
DROP POLICY IF EXISTS "Authenticated users can update closing training" ON public.brand_closing_training;
DROP POLICY IF EXISTS "Authenticated users can delete closing training" ON public.brand_closing_training;
CREATE POLICY "Authenticated can view closing training" ON public.brand_closing_training FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert closing training" ON public.brand_closing_training FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update closing training" ON public.brand_closing_training FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete closing training" ON public.brand_closing_training FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 5. BRAND_TYPE - Authenticated can view, admin can manage
DROP POLICY IF EXISTS "Authenticated users can view brand_type" ON public.brand_type;
CREATE POLICY "Authenticated can view brand_type" ON public.brand_type FOR SELECT USING (auth.uid() IS NOT NULL);

-- 6. BRANDS - Authenticated can view, admin can manage
DROP POLICY IF EXISTS "Authenticated users can view brands" ON public.brands;
CREATE POLICY "Authenticated can view brands" ON public.brands FOR SELECT USING (auth.uid() IS NOT NULL);

-- 7. CRM_CUSTOMER_FOLLOWUP - Admin only
DROP POLICY IF EXISTS "Users can view all CRM follow-ups" ON public.crm_customer_followup;
DROP POLICY IF EXISTS "Users can update CRM follow-ups" ON public.crm_customer_followup;
CREATE POLICY "Admins can view CRM follow-ups" ON public.crm_customer_followup FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update CRM follow-ups" ON public.crm_customer_followup FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- 8. CURRENCIES - Authenticated can view, admin can manage
DROP POLICY IF EXISTS "Authenticated users can view currencies" ON public.currencies;
CREATE POLICY "Authenticated can view currencies" ON public.currencies FOR SELECT USING (auth.uid() IS NOT NULL);

-- 9. CURRENCY_RATES - Authenticated can view
DROP POLICY IF EXISTS "Authenticated users can view currency rates" ON public.currency_rates;
CREATE POLICY "Authenticated can view currency rates" ON public.currency_rates FOR SELECT USING (auth.uid() IS NOT NULL);

-- 10. CUSTOMERS - Admin only (contains PII)
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
CREATE POLICY "Admins can view customers" ON public.customers FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 11. DEDUCTION_RULES - Admin only
DROP POLICY IF EXISTS "Authenticated users can view deduction rules" ON public.deduction_rules;
DROP POLICY IF EXISTS "Authenticated users can manage deduction rules" ON public.deduction_rules;
CREATE POLICY "Admins can view deduction rules" ON public.deduction_rules FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage deduction rules" ON public.deduction_rules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 12. DEPARTMENT_ADMINS - Authenticated can view
DROP POLICY IF EXISTS "Authenticated users can view department admins" ON public.department_admins;
CREATE POLICY "Authenticated can view department admins" ON public.department_admins FOR SELECT USING (auth.uid() IS NOT NULL);

-- 13. DEPARTMENT_MEMBERS - Authenticated can view
DROP POLICY IF EXISTS "Users can view department members" ON public.department_members;
CREATE POLICY "Authenticated can view department members" ON public.department_members FOR SELECT USING (auth.uid() IS NOT NULL);

-- 14. DEPARTMENT_TASK_PHASES - Authenticated can view
DROP POLICY IF EXISTS "Authenticated users can view task phases" ON public.department_task_phases;
CREATE POLICY "Authenticated can view task phases" ON public.department_task_phases FOR SELECT USING (auth.uid() IS NOT NULL);

-- 15. DOCUMENT_TYPES - Admin only for management
DROP POLICY IF EXISTS "Allow authenticated users to read document_types" ON public.document_types;
DROP POLICY IF EXISTS "Allow authenticated users to insert document_types" ON public.document_types;
DROP POLICY IF EXISTS "Allow authenticated users to update document_types" ON public.document_types;
DROP POLICY IF EXISTS "Allow authenticated users to delete document_types" ON public.document_types;
CREATE POLICY "Authenticated can view document_types" ON public.document_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert document_types" ON public.document_types FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update document_types" ON public.document_types FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete document_types" ON public.document_types FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 16. EMPLOYEE_DOCUMENTS - Admin only (sensitive)
DROP POLICY IF EXISTS "Allow authenticated users to read employee_documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Allow authenticated users to insert employee_documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Allow authenticated users to update employee_documents" ON public.employee_documents;
DROP POLICY IF EXISTS "Allow authenticated users to delete employee_documents" ON public.employee_documents;
CREATE POLICY "Admins can view employee_documents" ON public.employee_documents FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert employee_documents" ON public.employee_documents FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update employee_documents" ON public.employee_documents FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete employee_documents" ON public.employee_documents FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 17. EMPLOYEE_JOB_HISTORY - Admin only
DROP POLICY IF EXISTS "Authenticated users can view job history" ON public.employee_job_history;
DROP POLICY IF EXISTS "Authenticated users can manage job history" ON public.employee_job_history;
CREATE POLICY "Admins can view job history" ON public.employee_job_history FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage job history" ON public.employee_job_history FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 18. EMPLOYEES - Admin only (contains PII)
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON public.employees;
CREATE POLICY "Admins can view employees" ON public.employees FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage employees" ON public.employees FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 19. EXCEL_COLUMN_MAPPINGS - Admin only
DROP POLICY IF EXISTS "Authenticated users can view excel_column_mappings" ON public.excel_column_mappings;
CREATE POLICY "Admins can view excel_column_mappings" ON public.excel_column_mappings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 20. EXCEL_SHEETS - Admin only
DROP POLICY IF EXISTS "Authenticated users can view excel_sheets" ON public.excel_sheets;
CREATE POLICY "Admins can view excel_sheets" ON public.excel_sheets FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 21. HYBERPAYSTATEMENT - Admin/Finance only (financial data)
DROP POLICY IF EXISTS "Allow all operations on hyberpaystatement" ON public.hyberpaystatement;
CREATE POLICY "Admins can manage hyberpaystatement" ON public.hyberpaystatement FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 22. JOB_POSITIONS - Authenticated can view
DROP POLICY IF EXISTS "Authenticated users can view job positions" ON public.job_positions;
CREATE POLICY "Authenticated can view job positions" ON public.job_positions FOR SELECT USING (auth.uid() IS NOT NULL);

-- 23. MAIL_TYPES - Authenticated can view
DROP POLICY IF EXISTS "Authenticated users can view mail types" ON public.mail_types;
CREATE POLICY "Authenticated can view mail types" ON public.mail_types FOR SELECT USING (auth.uid() IS NOT NULL);

-- 24. MEDICAL_INSURANCE_PLANS - Admin only
DROP POLICY IF EXISTS "Authenticated users can manage medical insurance plans" ON public.medical_insurance_plans;
DROP POLICY IF EXISTS "Authenticated users can view medical insurance plans" ON public.medical_insurance_plans;
CREATE POLICY "Admins can view medical insurance plans" ON public.medical_insurance_plans FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage medical insurance plans" ON public.medical_insurance_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));