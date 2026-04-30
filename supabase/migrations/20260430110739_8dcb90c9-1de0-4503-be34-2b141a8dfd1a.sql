CREATE OR REPLACE FUNCTION public.exec_select_json(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'SELECT to_jsonb(data) FROM (' || p_sql || ') s' INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.exec_select_json(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_select_json(text) FROM anon, authenticated;
-- Only callable by service_role (edge function uses service role)
GRANT EXECUTE ON FUNCTION public.exec_select_json(text) TO service_role;