-- Step 2: Create AES-256 Encryption Function
CREATE OR REPLACE FUNCTION public.encrypt_email_password_aes(plain_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  encryption_key BYTEA;
  iv BYTEA;
  encrypted BYTEA;
BEGIN
  IF plain_password IS NULL OR plain_password = '' THEN
    RETURN NULL;
  END IF;
  
  -- Get key from secure table
  SELECT decode(key_value, 'base64') INTO encryption_key
  FROM public.encryption_keys
  WHERE key_name = 'email_encryption_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Generate random IV (16 bytes for AES) using pgcrypto
  iv := extensions.gen_random_bytes(16);
  
  -- Encrypt using AES-256-CBC with pgcrypto
  encrypted := extensions.encrypt_iv(
    convert_to(plain_password, 'UTF8'),
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  -- Return IV + encrypted data as base64 with prefix
  RETURN 'AES256:' || encode(iv || encrypted, 'base64');
END;
$$;

-- Step 3: Create AES-256 Decryption Function
CREATE OR REPLACE FUNCTION public.decrypt_email_password_aes(encrypted_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  encryption_key BYTEA;
  raw_data BYTEA;
  iv BYTEA;
  encrypted BYTEA;
  decrypted BYTEA;
BEGIN
  IF encrypted_password IS NULL OR encrypted_password = '' THEN
    RETURN NULL;
  END IF;
  
  -- Check if this is AES-256 encrypted (has prefix)
  IF NOT encrypted_password LIKE 'AES256:%' THEN
    -- Try old decryption method for backwards compatibility
    RETURN public.decrypt_email_password(encrypted_password);
  END IF;
  
  -- Get key from secure table
  SELECT decode(key_value, 'base64') INTO encryption_key
  FROM public.encryption_keys
  WHERE key_name = 'email_encryption_key'
  LIMIT 1;
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  -- Remove prefix and decode
  raw_data := decode(substring(encrypted_password FROM 8), 'base64');
  
  -- Extract IV (first 16 bytes) and encrypted data
  iv := substring(raw_data FROM 1 FOR 16);
  encrypted := substring(raw_data FROM 17);
  
  -- Decrypt using pgcrypto
  decrypted := extensions.decrypt_iv(
    encrypted,
    encryption_key,
    iv,
    'aes-cbc/pad:pkcs'
  );
  
  RETURN convert_from(decrypted, 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Step 4: Update trigger function to use AES-256
CREATE OR REPLACE FUNCTION public.encrypt_email_password_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_password IS NOT NULL AND NEW.email_password != '' THEN
    IF NEW.email_password LIKE 'AES256:%' THEN
      RETURN NEW;
    END IF;
    NEW.email_password := public.encrypt_email_password_aes(NEW.email_password);
  END IF;
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger function for user_emails
CREATE OR REPLACE FUNCTION public.encrypt_user_emails_password_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND NEW.password != '' THEN
    IF NEW.password LIKE 'AES256:%' THEN
      RETURN NEW;
    END IF;
    NEW.password := public.encrypt_email_password_aes(NEW.password);
  END IF;
  RETURN NEW;
END;
$$;

-- Step 6: Create trigger for user_emails table
DROP TRIGGER IF EXISTS encrypt_user_emails_password ON public.user_emails;
CREATE TRIGGER encrypt_user_emails_password
  BEFORE INSERT OR UPDATE OF password ON public.user_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_user_emails_password_trigger();

-- Step 7: Update get_my_email_password to use AES-256
CREATE OR REPLACE FUNCTION public.get_my_email_password()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stored_pwd TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT email_password INTO stored_pwd
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  RETURN public.decrypt_email_password_aes(stored_pwd);
END;
$$;

-- Step 8: Update get_email_config_password to use AES-256
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
  
  RETURN public.decrypt_email_password_aes(stored_pwd);
END;
$$;

-- Step 9: Create get_user_email_password function
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
  
  RETURN public.decrypt_email_password_aes(stored_pwd);
END;
$$;

-- Step 10: Enable RLS on user_emails
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;

-- Step 11: Add RLS policies for user_emails
DROP POLICY IF EXISTS "Users can view emails they own" ON public.user_emails;
CREATE POLICY "Users can view emails they own" ON public.user_emails
  FOR SELECT USING (
    owner = (SELECT user_name FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users can insert their own emails" ON public.user_emails;
CREATE POLICY "Users can insert their own emails" ON public.user_emails
  FOR INSERT WITH CHECK (
    owner = (SELECT user_name FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users can update their own emails" ON public.user_emails;
CREATE POLICY "Users can update their own emails" ON public.user_emails
  FOR UPDATE USING (
    owner = (SELECT user_name FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users can delete their own emails" ON public.user_emails;
CREATE POLICY "Users can delete their own emails" ON public.user_emails
  FOR DELETE USING (
    owner = (SELECT user_name FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );