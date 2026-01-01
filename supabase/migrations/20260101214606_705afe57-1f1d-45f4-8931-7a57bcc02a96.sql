-- Create trigger to encrypt passwords on insert/update
DROP TRIGGER IF EXISTS encrypt_email_config_password ON user_email_configs;

CREATE TRIGGER encrypt_email_config_password
BEFORE INSERT OR UPDATE OF email_password ON user_email_configs
FOR EACH ROW
EXECUTE FUNCTION encrypt_email_password_trigger();

-- Create function to get decrypted password for current user's email config
CREATE OR REPLACE FUNCTION public.get_email_config_password(config_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stored_pwd text;
  config_user_id uuid;
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get the config and verify ownership
  SELECT user_id, email_password INTO config_user_id, stored_pwd
  FROM public.user_email_configs
  WHERE id = config_id;
  
  -- Only return if user owns this config
  IF config_user_id != auth.uid() THEN
    RETURN NULL;
  END IF;
  
  -- Try to decrypt
  RETURN public.decrypt_email_password(stored_pwd);
END;
$$;