-- Step 12: Migrate existing passwords to AES-256

-- Migrate profiles.email_password
UPDATE public.profiles
SET email_password = public.encrypt_email_password_aes(
  public.decrypt_email_password(email_password)
)
WHERE email_password IS NOT NULL 
  AND email_password != ''
  AND email_password NOT LIKE 'AES256:%';

-- Migrate user_email_configs.email_password  
UPDATE public.user_email_configs
SET email_password = public.encrypt_email_password_aes(
  public.decrypt_email_password(email_password)
)
WHERE email_password IS NOT NULL 
  AND email_password != ''
  AND email_password NOT LIKE 'AES256:%';

-- Migrate user_emails.password (may be plaintext or old format)
UPDATE public.user_emails
SET password = public.encrypt_email_password_aes(
  CASE 
    WHEN password LIKE '%==%' THEN public.decrypt_email_password(password)
    ELSE password
  END
)
WHERE password IS NOT NULL 
  AND password != ''
  AND password NOT LIKE 'AES256:%';