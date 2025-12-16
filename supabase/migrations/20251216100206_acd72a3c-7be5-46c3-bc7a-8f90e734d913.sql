-- Make config_id nullable since we no longer use user_email_configs
ALTER TABLE public.emails ALTER COLUMN config_id DROP NOT NULL;