-- Create storage bucket for employee request attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- Create storage policy for public read access
CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments');

-- Create function to create expense_request after employee_request full approval
CREATE OR REPLACE FUNCTION public.create_expense_request_from_employee_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_currency_rate RECORD;
  v_base_amount NUMERIC;
BEGIN
  -- Only trigger when request_type is expense_refund and status changes to approved
  IF NEW.request_type = 'expense_refund' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN
    
    -- Get employee info
    SELECT e.*, p.user_name
    INTO v_employee
    FROM employees e
    LEFT JOIN profiles p ON e.user_id = p.user_id
    WHERE e.id = NEW.employee_id;
    
    -- Get currency rate for conversion to SAR
    SELECT cr.rate_to_base, cr.conversion_operator
    INTO v_currency_rate
    FROM currency_rates cr
    WHERE cr.currency_id = NEW.expense_currency_id
    ORDER BY cr.effective_date DESC
    LIMIT 1;
    
    -- Calculate base currency amount (SAR)
    IF v_currency_rate IS NOT NULL THEN
      IF v_currency_rate.conversion_operator = 'multiply' THEN
        v_base_amount := NEW.expense_amount * v_currency_rate.rate_to_base;
      ELSE
        v_base_amount := NEW.expense_amount / v_currency_rate.rate_to_base;
      END IF;
    ELSE
      v_base_amount := NEW.expense_amount;
    END IF;
    
    -- Create expense request
    INSERT INTO expense_requests (
      amount,
      currency_id,
      exchange_rate,
      base_currency_amount,
      description,
      status,
      department_id,
      employee_request_id,
      created_at,
      updated_at
    ) VALUES (
      NEW.expense_amount,
      NEW.expense_currency_id,
      COALESCE(v_currency_rate.rate_to_base, 1),
      v_base_amount,
      COALESCE(NEW.expense_description, 'Employee Expense Refund Request #' || NEW.request_number),
      'pending',
      NEW.department_id,
      NEW.id,
      NOW(),
      NOW()
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire after employee_request is updated
DROP TRIGGER IF EXISTS trigger_create_expense_request_on_approval ON employee_requests;
CREATE TRIGGER trigger_create_expense_request_on_approval
  AFTER UPDATE ON employee_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.create_expense_request_from_employee_request();

-- Add employee_request_id column to expense_requests if it doesn't exist
ALTER TABLE public.expense_requests 
ADD COLUMN IF NOT EXISTS employee_request_id UUID REFERENCES public.employee_requests(id);

-- Add comment
COMMENT ON COLUMN public.expense_requests.employee_request_id IS 'Reference to the originating employee expense refund request';