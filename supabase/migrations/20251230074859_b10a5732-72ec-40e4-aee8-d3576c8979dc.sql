-- First drop the existing function completely
DROP FUNCTION IF EXISTS public.get_user_defined_types_info();

-- Then recreate with new return type including base_type
CREATE OR REPLACE FUNCTION public.get_user_defined_types_info()
RETURNS TABLE(type_name text, type_schema text, type_type text, enum_values text[], base_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.typname::text as type_name,
    n.nspname::text as type_schema,
    CASE 
      WHEN t.typtype = 'e' THEN 'enum'
      WHEN t.typtype = 'd' THEN 'domain'
      WHEN t.typname LIKE '\_%' AND t.typelem != 0 THEN 'array'
      ELSE t.typtype::text
    END as type_type,
    CASE 
      WHEN t.typtype = 'e' THEN 
        ARRAY(
          SELECT e.enumlabel::text 
          FROM pg_enum e 
          WHERE e.enumtypid = t.oid 
          ORDER BY e.enumsortorder
        )
      ELSE NULL
    END as enum_values,
    CASE 
      WHEN t.typtype = 'd' THEN (SELECT bt.typname::text FROM pg_type bt WHERE bt.oid = t.typbasetype)
      WHEN t.typname LIKE '\_%' AND t.typelem != 0 THEN (SELECT et.typname::text FROM pg_type et WHERE et.oid = t.typelem)
      ELSE NULL
    END as base_type
  FROM pg_type t
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.typtype IN ('e', 'd', 'c')
    OR (n.nspname = 'public' AND t.typname LIKE '\_%' AND t.typelem != 0);
END;
$$;