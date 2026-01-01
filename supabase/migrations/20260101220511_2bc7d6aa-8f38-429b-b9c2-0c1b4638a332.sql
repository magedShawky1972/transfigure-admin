-- Step 1: Create password access audit table
CREATE TABLE IF NOT EXISTS public.password_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  accessed_table TEXT NOT NULL,
  accessed_record_id UUID,
  access_type TEXT NOT NULL DEFAULT 'decrypt',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS - only admins can view logs
ALTER TABLE public.password_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view password access logs" ON public.password_access_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Create index for efficient querying
CREATE INDEX idx_password_access_logs_user_id ON public.password_access_logs(user_id);
CREATE INDEX idx_password_access_logs_created_at ON public.password_access_logs(created_at DESC);
CREATE INDEX idx_password_access_logs_table ON public.password_access_logs(accessed_table);

-- Step 2: Create logging function
CREATE OR REPLACE FUNCTION public.log_password_access(
  p_accessed_table TEXT,
  p_accessed_record_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Insert log entry
  INSERT INTO public.password_access_logs (
    user_id,
    user_email,
    accessed_table,
    accessed_record_id,
    access_type
  ) VALUES (
    auth.uid(),
    v_user_email,
    p_accessed_table,
    p_accessed_record_id,
    'decrypt'
  );
END;
$$;

-- Step 3: Update get_my_email_password to log access
CREATE OR REPLACE FUNCTION public.get_my_email_password()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stored_pwd TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT email_password INTO stored_pwd
  FROM public.profiles
  WHERE user_id = v_user_id;
  
  -- Log the access
  PERFORM public.log_password_access('profiles', v_user_id);
  
  RETURN public.decrypt_email_password_aes(stored_pwd);
END;
$$;

-- Step 4: Update get_email_config_password to log access
CREATE OR REPLACE FUNCTION public.get_email_config_password(config_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stored_pwd TEXT;
  config_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT user_id, email_password INTO config_user_id, stored_pwd
  FROM public.user_email_configs
  WHERE id = config_id;
  
  IF config_user_id != auth.uid() THEN
    RETURN NULL;
  END IF;
  
  -- Log the access
  PERFORM public.log_password_access('user_email_configs', config_id);
  
  RETURN public.decrypt_email_password_aes(stored_pwd);
END;
$$;

-- Step 5: Update get_user_email_password to log access
CREATE OR REPLACE FUNCTION public.get_user_email_password(email_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stored_pwd TEXT;
  email_owner TEXT;
  current_user_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT user_name INTO current_user_name
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  SELECT password, owner INTO stored_pwd, email_owner
  FROM public.user_emails
  WHERE id = email_id;
  
  IF email_owner != current_user_name AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN NULL;
  END IF;
  
  -- Log the access
  PERFORM public.log_password_access('user_emails', email_id);
  
  RETURN public.decrypt_email_password_aes(stored_pwd);
END;
$$;

-- Step 6: Create function to query password access logs
CREATE OR REPLACE FUNCTION public.get_password_access_logs(
  p_user_id UUID DEFAULT NULL,
  p_table_name TEXT DEFAULT NULL,
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  accessed_table TEXT,
  accessed_record_id UUID,
  access_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    pal.id,
    pal.user_id,
    pal.user_email,
    pal.accessed_table,
    pal.accessed_record_id,
    pal.access_type,
    pal.created_at
  FROM public.password_access_logs pal
  WHERE 
    public.has_role(auth.uid(), 'admin')
    AND (p_user_id IS NULL OR pal.user_id = p_user_id)
    AND (p_table_name IS NULL OR pal.accessed_table = p_table_name)
    AND (p_from_date IS NULL OR pal.created_at >= p_from_date)
    AND (p_to_date IS NULL OR pal.created_at <= p_to_date)
  ORDER BY pal.created_at DESC
  LIMIT p_limit;
$$;