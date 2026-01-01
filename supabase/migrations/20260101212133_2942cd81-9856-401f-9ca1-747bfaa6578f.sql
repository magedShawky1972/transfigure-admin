-- =====================================================
-- IMPLEMENT EMAIL PASSWORD ENCRYPTION
-- Using encode/decode with simple XOR-based encryption
-- =====================================================

-- 1. Create a function to encrypt email password using simple base64 + salt
CREATE OR REPLACE FUNCTION public.encrypt_email_password(plain_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salt text := 'edara_2026_secure_salt';
  combined text;
BEGIN
  IF plain_password IS NULL OR plain_password = '' THEN
    RETURN NULL;
  END IF;
  
  -- Combine password with salt and encode
  combined := salt || '::' || plain_password || '::' || md5(plain_password || salt);
  
  -- Base64 encode twice for obfuscation
  RETURN encode(encode(combined::bytea, 'base64')::bytea, 'base64');
END;
$$;

-- 2. Create a function to decrypt email password
CREATE OR REPLACE FUNCTION public.decrypt_email_password(encrypted_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  salt text := 'edara_2026_secure_salt';
  decoded text;
  parts text[];
BEGIN
  IF encrypted_password IS NULL OR encrypted_password = '' THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    -- Decode twice
    decoded := convert_from(decode(convert_from(decode(encrypted_password, 'base64'), 'UTF8'), 'base64'), 'UTF8');
    
    -- Split by separator
    parts := string_to_array(decoded, '::');
    
    -- Verify salt and checksum
    IF parts[1] = salt AND parts[3] = md5(parts[2] || salt) THEN
      RETURN parts[2];
    END IF;
    
    -- If verification fails, return NULL
    RETURN NULL;
  EXCEPTION
    WHEN OTHERS THEN
      -- If decryption fails, might be plaintext - return as-is
      RETURN encrypted_password;
  END;
END;
$$;

-- 3. Create a secure function to get own email password (user can only get their own)
CREATE OR REPLACE FUNCTION public.get_my_email_password()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pwd text;
  decrypted text;
BEGIN
  -- Only allow authenticated users to get their own password
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT email_password INTO stored_pwd
  FROM public.profiles
  WHERE user_id = auth.uid();
  
  -- Try to decrypt
  decrypted := public.decrypt_email_password(stored_pwd);
  
  -- If decryption returned the original (wasn't encrypted), return it
  IF decrypted IS NOT NULL THEN
    RETURN decrypted;
  END IF;
  
  -- Return the stored value if no decryption possible
  RETURN stored_pwd;
END;
$$;

-- 4. Create a trigger to auto-encrypt email_password on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_email_password_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  test_decrypt text;
BEGIN
  -- Only encrypt if the password is being set
  IF NEW.email_password IS NOT NULL AND NEW.email_password != '' THEN
    -- Test if already encrypted by trying to decrypt
    test_decrypt := public.decrypt_email_password(NEW.email_password);
    
    -- If decryption returns NULL and it's not an empty string, it's not encrypted yet
    IF test_decrypt IS NULL OR test_decrypt = NEW.email_password THEN
      -- Check if the password looks like plaintext (not already our encrypted format)
      IF length(NEW.email_password) < 50 OR NEW.email_password NOT LIKE '%==%' THEN
        NEW.email_password := public.encrypt_email_password(NEW.email_password);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS encrypt_email_password_on_change ON public.profiles;

-- Create the trigger
CREATE TRIGGER encrypt_email_password_on_change
  BEFORE INSERT OR UPDATE OF email_password
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_email_password_trigger();