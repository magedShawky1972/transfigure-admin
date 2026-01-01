-- Encrypt existing plaintext passwords in user_email_configs
UPDATE user_email_configs
SET email_password = public.encrypt_email_password(email_password)
WHERE email_password IS NOT NULL 
  AND email_password != ''
  AND length(email_password) < 50
  AND email_password NOT LIKE '%==%';