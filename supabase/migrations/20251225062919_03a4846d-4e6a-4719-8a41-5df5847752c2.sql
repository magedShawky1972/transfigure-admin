-- Function to get table columns info for backup
CREATE OR REPLACE FUNCTION public.get_table_columns_info()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  column_default text,
  is_nullable text,
  udt_name text,
  character_maximum_length integer,
  numeric_precision integer,
  numeric_scale integer,
  ordinal_position integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.column_default::text,
    c.is_nullable::text,
    c.udt_name::text,
    c.character_maximum_length::integer,
    c.numeric_precision::integer,
    c.numeric_scale::integer,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position;
$$;

-- Function to get primary keys
CREATE OR REPLACE FUNCTION public.get_primary_keys_info()
RETURNS TABLE (
  table_name text,
  column_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tc.table_name::text,
    kcu.column_name::text
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public';
$$;

-- Function to get foreign keys
CREATE OR REPLACE FUNCTION public.get_foreign_keys_info()
RETURNS TABLE (
  table_name text,
  column_name text,
  foreign_table_name text,
  foreign_column_name text,
  constraint_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tc.table_name::text,
    kcu.column_name::text,
    ccu.table_name::text AS foreign_table_name,
    ccu.column_name::text AS foreign_column_name,
    tc.constraint_name::text
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
$$;

-- Function to get indexes
CREATE OR REPLACE FUNCTION public.get_indexes_info()
RETURNS TABLE (
  indexname text,
  tablename text,
  indexdef text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    indexname::text,
    tablename::text,
    indexdef::text
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
$$;

-- Function to get RLS policies
CREATE OR REPLACE FUNCTION public.get_rls_policies_info()
RETURNS TABLE (
  tablename text,
  policyname text,
  permissive text,
  roles text,
  cmd text,
  qual text,
  with_check text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tablename::text,
    policyname::text,
    permissive::text,
    roles::text,
    cmd::text,
    qual::text,
    with_check::text
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$$;

-- Function to get database functions
CREATE OR REPLACE FUNCTION public.get_db_functions_info()
RETURNS TABLE (
  function_name text,
  function_definition text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.proname::text AS function_name,
    pg_get_functiondef(p.oid)::text AS function_definition
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
  ORDER BY p.proname;
$$;

-- Function to get triggers
CREATE OR REPLACE FUNCTION public.get_triggers_info()
RETURNS TABLE (
  trigger_name text,
  event_manipulation text,
  event_object_table text,
  action_statement text,
  action_timing text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    trigger_name::text,
    event_manipulation::text,
    event_object_table::text,
    action_statement::text,
    action_timing::text
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  ORDER BY event_object_table, trigger_name;
$$;