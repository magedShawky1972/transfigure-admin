CREATE OR REPLACE FUNCTION public.get_customers_without_orders(p_from_date date, p_to_date date, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000)
 RETURNS TABLE(id uuid, customer_name text, customer_phone text, email text, customer_group text, creation_date timestamp with time zone, last_order_date timestamp without time zone, status text, is_blocked boolean)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Select a valid From Date and To Date.' USING ERRCODE = '22023';
  END IF;
  IF p_offset < 0 OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Invalid pagination.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT c.id, c.customer_name, c.customer_phone, c.email, c.customer_group, c.creation_date,
    (SELECT t.created_at_date FROM public.purpletransaction t
      WHERE t.customer_phone = c.customer_phone AND t.is_deleted = false
        AND COALESCE(t.order_number, t.ordernumber, '') <> ''
      ORDER BY t.created_at_date_int DESC NULLS LAST, t.created_at_date DESC NULLS LAST LIMIT 1),
    c.status, c.is_blocked
  FROM public.customers c
  WHERE c.creation_date IS NOT NULL
    AND (c.creation_date AT TIME ZONE 'Asia/Riyadh')::date <= p_to_date
    AND (c.creation_date AT TIME ZONE 'Asia/Riyadh')::date >= p_from_date
    AND NOT EXISTS (
      SELECT 1 FROM public.purpletransaction t
      WHERE t.customer_phone = c.customer_phone AND t.is_deleted = false
        AND COALESCE(t.order_number, t.ordernumber, '') <> ''
        AND t.created_at_date_int >= to_char(p_from_date, 'YYYYMMDD')::bigint
        AND t.created_at_date_int <= to_char(p_to_date, 'YYYYMMDD')::bigint
    )
  ORDER BY c.customer_name NULLS LAST, c.id
  OFFSET p_offset LIMIT p_limit;
END;
$function$;