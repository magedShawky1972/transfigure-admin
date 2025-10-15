-- Create cache table for storing query results
CREATE TABLE IF NOT EXISTS public.query_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  cache_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL
);

-- Enable RLS
ALTER TABLE public.query_cache ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since this is internal cache)
CREATE POLICY "Allow all operations on query_cache"
ON public.query_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_query_cache_key ON public.query_cache(cache_key);
CREATE INDEX idx_query_cache_expires ON public.query_cache(expires_at);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.clean_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.query_cache WHERE expires_at < now();
END;
$$;