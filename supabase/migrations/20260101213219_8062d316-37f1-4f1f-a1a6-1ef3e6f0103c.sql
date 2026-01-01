-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  user_id UUID,
  user_email TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- No updates or deletes allowed (audit logs are immutable)

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_record_id TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = v_user_id;

  -- Determine record ID and data based on operation
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::TEXT;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id::TEXT;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    -- Mask sensitive fields
    IF v_old_data ? 'password' THEN v_old_data := v_old_data - 'password'; END IF;
    IF v_new_data ? 'password' THEN v_new_data := v_new_data - 'password'; END IF;
    IF v_old_data ? 'email_password' THEN v_old_data := v_old_data - 'email_password'; END IF;
    IF v_new_data ? 'email_password' THEN v_new_data := v_new_data - 'email_password'; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id::TEXT;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    -- Mask sensitive fields
    IF v_new_data ? 'password' THEN v_new_data := v_new_data - 'password'; END IF;
    IF v_new_data ? 'email_password' THEN v_new_data := v_new_data - 'email_password'; END IF;
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    user_email,
    old_data,
    new_data
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_user_id,
    v_user_email,
    v_old_data,
    v_new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers for sensitive tables

-- Audit user_email_configs
CREATE TRIGGER audit_user_email_configs
AFTER INSERT OR UPDATE OR DELETE ON public.user_email_configs
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Audit profiles (contains user data)
CREATE TRIGGER audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Audit user_roles (permission changes)
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Audit customers (PII)
CREATE TRIGGER audit_customers
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Audit employees (PII)
CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Audit api_keys (sensitive credentials)
CREATE TRIGGER audit_api_keys
AFTER INSERT OR UPDATE OR DELETE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Create function to query audit logs with filters
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_table_name TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_from_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_to_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  user_id UUID,
  user_email TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.user_id,
    al.user_email,
    al.old_data,
    al.new_data,
    al.created_at
  FROM public.audit_logs al
  WHERE 
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_from_date IS NULL OR al.created_at >= p_from_date)
    AND (p_to_date IS NULL OR al.created_at <= p_to_date)
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY al.created_at DESC
  LIMIT p_limit;
$$;