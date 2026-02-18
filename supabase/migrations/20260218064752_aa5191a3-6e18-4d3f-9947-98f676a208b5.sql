
CREATE OR REPLACE FUNCTION public.get_schema_migrations()
RETURNS TABLE(version text, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    version::text,
    COALESCE(name, version)::text as name
  FROM supabase_migrations.schema_migrations
  ORDER BY version ASC;
$$;
