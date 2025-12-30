-- Create function to get user-defined types (enums)
CREATE OR REPLACE FUNCTION public.get_user_defined_types_info()
 RETURNS TABLE(type_name text, type_schema text, type_type text, enum_values text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    t.typname::text AS type_name,
    n.nspname::text AS type_schema,
    CASE t.typtype
      WHEN 'e' THEN 'enum'
      WHEN 'c' THEN 'composite'
      WHEN 'd' THEN 'domain'
      WHEN 'r' THEN 'range'
      ELSE 'other'
    END::text AS type_type,
    CASE 
      WHEN t.typtype = 'e' THEN 
        ARRAY(SELECT e.enumlabel::text FROM pg_enum e WHERE e.enumtypid = t.oid ORDER BY e.enumsortorder)
      ELSE NULL
    END AS enum_values
  FROM pg_type t
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.typtype IN ('e', 'c', 'd', 'r')
  ORDER BY t.typname;
$function$;