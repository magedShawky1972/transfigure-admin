-- Add new columns to department_admins table
ALTER TABLE public.department_admins 
ADD COLUMN IF NOT EXISTS is_department_manager BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approve_employee_request BOOLEAN NOT NULL DEFAULT false;

-- Create hr_managers table for global HR approvers
CREATE TABLE IF NOT EXISTS public.hr_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.hr_managers ENABLE ROW LEVEL SECURITY;

-- RLS policies for hr_managers
CREATE POLICY "Authenticated users can read HR managers"
ON public.hr_managers FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins can insert HR managers"
ON public.hr_managers FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update HR managers"
ON public.hr_managers FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can delete HR managers"
ON public.hr_managers FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create employee_requests table
CREATE TABLE IF NOT EXISTS public.employee_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number VARCHAR(50) NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
    'sick_leave', 'vacation', 'delay', 'expense_refund', 'experience_certificate'
  )),
  
  -- Common fields
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'manager_approved', 'hr_pending', 'approved', 'rejected', 'cancelled'
  )),
  request_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reason TEXT,
  
  -- Leave-specific fields (sick_leave, vacation)
  vacation_code_id UUID REFERENCES vacation_codes(id),
  start_date DATE,
  end_date DATE,
  total_days DECIMAL(5,2),
  
  -- Delay-specific fields
  delay_date DATE,
  delay_minutes INTEGER,
  actual_arrival_time TIME,
  
  -- Expense refund fields
  expense_amount DECIMAL(15,2),
  expense_currency_id UUID REFERENCES currencies(id),
  expense_description TEXT,
  expense_receipt_url TEXT,
  
  -- Workflow tracking
  department_id UUID REFERENCES departments(id),
  current_phase VARCHAR(20) DEFAULT 'manager' CHECK (current_phase IN ('manager', 'hr')),
  current_approval_level INTEGER DEFAULT 0,
  
  -- Manager phase tracking
  manager_approved_at TIMESTAMP WITH TIME ZONE,
  manager_approved_by UUID REFERENCES auth.users(id),
  
  -- HR phase tracking
  hr_approved_at TIMESTAMP WITH TIME ZONE,
  hr_approved_by UUID REFERENCES auth.users(id),
  
  -- Rejection
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_requests ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_requests_employee ON employee_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_department ON employee_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_phase_level ON employee_requests(current_phase, current_approval_level);
CREATE INDEX IF NOT EXISTS idx_employee_requests_type ON employee_requests(request_type);

-- RLS Policies for employee_requests

-- Employees can view their own requests
CREATE POLICY "Employees can view own requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);

-- Employees can insert their own requests
CREATE POLICY "Employees can create own requests"
ON employee_requests FOR INSERT
TO authenticated
WITH CHECK (
  employee_id IN (
    SELECT id FROM employees WHERE user_id = auth.uid()
  )
);

-- Department managers can view requests in their department
CREATE POLICY "Dept managers can view department requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  department_id IN (
    SELECT department_id FROM department_admins 
    WHERE user_id = auth.uid() 
    AND approve_employee_request = true
  )
);

-- HR managers can view all requests
CREATE POLICY "HR managers can view all requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hr_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Admins can view all requests
CREATE POLICY "Admins can view all employee requests"
ON employee_requests FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Department managers can update requests they can approve
CREATE POLICY "Dept managers can update department requests"
ON employee_requests FOR UPDATE
TO authenticated
USING (
  department_id IN (
    SELECT department_id FROM department_admins 
    WHERE user_id = auth.uid() 
    AND approve_employee_request = true
  )
);

-- HR managers can update all requests
CREATE POLICY "HR managers can update all requests"
ON employee_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM hr_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Admins can update all requests
CREATE POLICY "Admins can update all employee requests"
ON employee_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_employee_requests_updated_at
BEFORE UPDATE ON public.employee_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate request number
CREATE OR REPLACE FUNCTION generate_employee_request_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.request_number := 'ER-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(COALESCE(
      (SELECT COUNT(*) + 1 FROM employee_requests 
       WHERE DATE(created_at) = CURRENT_DATE)::TEXT, 
      '1'
    ), 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate request number
CREATE TRIGGER set_employee_request_number
BEFORE INSERT ON public.employee_requests
FOR EACH ROW
WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
EXECUTE FUNCTION generate_employee_request_number();