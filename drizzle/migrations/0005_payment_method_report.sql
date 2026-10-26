CREATE OR REPLACE FUNCTION public.get_payment_method_report(p_from_date date, p_to_date date, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000)
RETURNS TABLE(report_date bigint, payment_method text, payment_brand text, payment_type text, order_count bigint, line_count bigint, total_amount numeric, bank_fee numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR COALESCE((SELECT up.has_access FROM public.user_permissions up WHERE up.user_id = auth.uid() AND up.parent_menu = 'Reports' AND up.menu_item = 'payment-method' ORDER BY up.created_at DESC LIMIT 1), false)) THEN
    RAISE EXCEPTION 'You do not have permission to access the Payment Method report.' USING ERRCODE = '42501';
  END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Select a valid From Date and To Date.' USING ERRCODE = '22023';
  END IF;
  IF p_offset < 0 OR p_limit < 1 OR p_limit > 1000 THEN RAISE EXCEPTION 'Invalid pagination.' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  SELECT t.created_at_date_int, COALESCE(NULLIF(trim(t.payment_method), ''), 'Unknown'), COALESCE(NULLIF(trim(t.payment_brand), ''), 'Unknown'), COALESCE(NULLIF(trim(t.payment_type), ''), 'Unknown'),
    count(DISTINCT COALESCE(NULLIF(t.order_number, ''), NULLIF(t.ordernumber, ''), t.id::text)), count(*), COALESCE(sum(t.total), 0), COALESCE(sum(t.bank_fee), 0)
  FROM public.purpletransaction t
  WHERE t.is_deleted = false AND t.created_at_date_int >= to_char(p_from_date, 'YYYYMMDD')::bigint AND t.created_at_date_int <= to_char(p_to_date, 'YYYYMMDD')::bigint
  GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4 OFFSET p_offset LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.get_payment_method_report(date, date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payment_method_report(date, date, integer, integer) TO authenticated, service_role;