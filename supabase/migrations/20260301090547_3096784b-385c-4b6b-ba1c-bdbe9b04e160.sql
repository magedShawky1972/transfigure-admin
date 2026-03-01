
CREATE TABLE public.external_db_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  anon_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.external_db_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections"
  ON public.external_db_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
  ON public.external_db_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON public.external_db_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON public.external_db_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_external_db_connections_user_url ON public.external_db_connections (user_id, url);

CREATE TRIGGER update_external_db_connections_updated_at
  BEFORE UPDATE ON public.external_db_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
