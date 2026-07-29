UPDATE public.system_settings
SET setting_value = jsonb_build_object('enabled', true, 'timeout_minutes', 180),
    updated_at = now()
WHERE setting_key = 'idle_timeout';

INSERT INTO public.system_settings (setting_key, setting_value)
SELECT 'idle_timeout', jsonb_build_object('enabled', true, 'timeout_minutes', 180)
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE setting_key = 'idle_timeout'
);