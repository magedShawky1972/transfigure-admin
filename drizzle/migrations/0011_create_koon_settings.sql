CREATE TABLE public.koon_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  api_key TEXT NOT NULL CHECK (char_length(api_key) >= 20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT ALL ON public.koon_settings TO service_role;

ALTER TABLE public.koon_settings ENABLE ROW LEVEL SECURITY;