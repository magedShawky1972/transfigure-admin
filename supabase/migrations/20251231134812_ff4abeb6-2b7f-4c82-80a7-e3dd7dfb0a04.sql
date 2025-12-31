-- Create enum for shift types
CREATE TYPE public.shift_type AS ENUM ('fixed', 'rotating');

-- Create enum for employment status
CREATE TYPE public.employment_status AS ENUM ('active', 'on_leave', 'terminated', 'suspended');

-- Create vacation codes table
CREATE TABLE public.vacation_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  description TEXT,
  default_days INTEGER NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medical insurance plans table
CREATE TABLE public.medical_insurance_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name VARCHAR(100) NOT NULL,
  plan_name_ar VARCHAR(100),
  provider VARCHAR(100),
  coverage_type VARCHAR(50),
  max_coverage_amount DECIMAL(12, 2),
  employee_contribution DECIMAL(12, 2) DEFAULT 0,
  employer_contribution DECIMAL(12, 2) DEFAULT 0,
  includes_family BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift plans table
CREATE TABLE public.shift_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name VARCHAR(100) NOT NULL,
  plan_name_ar VARCHAR(100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift plan details table (for rotating shifts)
CREATE TABLE public.shift_plan_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_plan_id UUID NOT NULL REFERENCES public.shift_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INTEGER DEFAULT 0,
  is_off_day BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number VARCHAR(20) NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  first_name_ar VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  last_name_ar VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  mobile VARCHAR(20),
  photo_url TEXT,
  date_of_birth DATE,
  gender VARCHAR(10),
  nationality VARCHAR(50),
  national_id VARCHAR(50),
  passport_number VARCHAR(50),
  marital_status VARCHAR(20),
  
  -- Job information
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  job_position_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL,
  job_start_date DATE NOT NULL,
  termination_date DATE,
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  
  -- Shift configuration
  shift_type public.shift_type NOT NULL DEFAULT 'fixed',
  fixed_shift_start TIME,
  fixed_shift_end TIME,
  shift_plan_id UUID REFERENCES public.shift_plans(id) ON DELETE SET NULL,
  
  -- Vacation & Insurance
  vacation_code_id UUID REFERENCES public.vacation_codes(id) ON DELETE SET NULL,
  vacation_balance DECIMAL(5, 2) DEFAULT 0,
  medical_insurance_plan_id UUID REFERENCES public.medical_insurance_plans(id) ON DELETE SET NULL,
  insurance_start_date DATE,
  insurance_end_date DATE,
  
  -- Salary information
  basic_salary DECIMAL(12, 2),
  currency VARCHAR(10) DEFAULT 'SAR',
  
  -- Manager
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create employee job history table
CREATE TABLE public.employee_job_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  job_position_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  salary DECIMAL(12, 2),
  change_reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create deduction rules table
CREATE TABLE public.deduction_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name VARCHAR(100) NOT NULL,
  rule_name_ar VARCHAR(100),
  rule_type VARCHAR(30) NOT NULL CHECK (rule_type IN ('late_arrival', 'early_departure', 'absence', 'overtime')),
  min_minutes INTEGER,
  max_minutes INTEGER,
  deduction_type VARCHAR(20) NOT NULL CHECK (deduction_type IN ('fixed', 'percentage', 'hourly')),
  deduction_value DECIMAL(10, 4) NOT NULL,
  is_overtime BOOLEAN DEFAULT false,
  overtime_multiplier DECIMAL(4, 2) DEFAULT 1.5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timesheet table
CREATE TABLE public.timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  scheduled_start TIME,
  scheduled_end TIME,
  actual_start TIME,
  actual_end TIME,
  break_duration_minutes INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_absent BOOLEAN DEFAULT false,
  absence_reason TEXT,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  deduction_amount DECIMAL(10, 2) DEFAULT 0,
  overtime_amount DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, work_date)
);

-- Create vacation requests table
CREATE TABLE public.vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  vacation_code_id UUID NOT NULL REFERENCES public.vacation_codes(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason TEXT,
  rejection_reason TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.vacation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_insurance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_plan_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_job_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vacation_codes (viewable by all authenticated, editable by admins)
CREATE POLICY "Authenticated users can view vacation codes" ON public.vacation_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage vacation codes" ON public.vacation_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for medical_insurance_plans
CREATE POLICY "Authenticated users can view insurance plans" ON public.medical_insurance_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage insurance plans" ON public.medical_insurance_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for shift_plans
CREATE POLICY "Authenticated users can view shift plans" ON public.shift_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage shift plans" ON public.shift_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for shift_plan_details
CREATE POLICY "Authenticated users can view shift plan details" ON public.shift_plan_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage shift plan details" ON public.shift_plan_details FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for employees
CREATE POLICY "Authenticated users can view employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage employees" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for employee_job_history
CREATE POLICY "Authenticated users can view job history" ON public.employee_job_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage job history" ON public.employee_job_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for deduction_rules
CREATE POLICY "Authenticated users can view deduction rules" ON public.deduction_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage deduction rules" ON public.deduction_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for timesheets
CREATE POLICY "Authenticated users can view timesheets" ON public.timesheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage timesheets" ON public.timesheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for vacation_requests
CREATE POLICY "Authenticated users can view vacation requests" ON public.vacation_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage vacation requests" ON public.vacation_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_vacation_codes_updated_at BEFORE UPDATE ON public.vacation_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_medical_insurance_plans_updated_at BEFORE UPDATE ON public.medical_insurance_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shift_plans_updated_at BEFORE UPDATE ON public.shift_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deduction_rules_updated_at BEFORE UPDATE ON public.deduction_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_timesheets_updated_at BEFORE UPDATE ON public.timesheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vacation_requests_updated_at BEFORE UPDATE ON public.vacation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default vacation codes
INSERT INTO public.vacation_codes (code, name_en, name_ar, default_days, is_paid) VALUES
('ANNUAL', 'Annual Leave', 'إجازة سنوية', 21, true),
('SICK', 'Sick Leave', 'إجازة مرضية', 30, true),
('UNPAID', 'Unpaid Leave', 'إجازة بدون راتب', 0, false),
('MATERNITY', 'Maternity Leave', 'إجازة أمومة', 70, true),
('PATERNITY', 'Paternity Leave', 'إجازة أبوة', 3, true);

-- Insert default deduction rules
INSERT INTO public.deduction_rules (rule_name, rule_name_ar, rule_type, min_minutes, max_minutes, deduction_type, deduction_value) VALUES
('Late 1-15 minutes', 'تأخير 1-15 دقيقة', 'late_arrival', 1, 15, 'fixed', 0),
('Late 16-30 minutes', 'تأخير 16-30 دقيقة', 'late_arrival', 16, 30, 'percentage', 0.25),
('Late 31-60 minutes', 'تأخير 31-60 دقيقة', 'late_arrival', 31, 60, 'percentage', 0.50),
('Late over 60 minutes', 'تأخير أكثر من 60 دقيقة', 'late_arrival', 61, NULL, 'percentage', 1.00),
('Absence', 'غياب', 'absence', NULL, NULL, 'percentage', 1.00);

-- Insert overtime rule
INSERT INTO public.deduction_rules (rule_name, rule_name_ar, rule_type, deduction_type, deduction_value, is_overtime, overtime_multiplier) VALUES
('Standard Overtime', 'العمل الإضافي', 'overtime', 'hourly', 1, true, 1.5);