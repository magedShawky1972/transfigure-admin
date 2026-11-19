DO $migration$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.prepare_koon_backfill(UUID)'::regprocedure) INTO function_definition;
  function_definition := REPLACE(function_definition, 'p.product_id = l.product_id', 'p.product_id = l.product_id::text');
  EXECUTE function_definition;
END
$migration$;