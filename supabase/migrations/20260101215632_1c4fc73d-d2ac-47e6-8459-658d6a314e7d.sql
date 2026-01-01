-- Step 1: Create a secure table to store the encryption key
CREATE TABLE IF NOT EXISTS public.encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Restrict access - only SECURITY DEFINER functions can read
ALTER TABLE public.encryption_keys ENABLE ROW LEVEL SECURITY;

-- No policies = no direct access via API, only via SECURITY DEFINER functions

-- Insert the encryption key using pgcrypto
INSERT INTO public.encryption_keys (key_name, key_value)
VALUES ('email_encryption_key', encode(extensions.gen_random_bytes(32), 'base64'))
ON CONFLICT (key_name) DO NOTHING;