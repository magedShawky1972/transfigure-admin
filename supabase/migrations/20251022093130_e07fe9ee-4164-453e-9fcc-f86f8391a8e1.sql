-- Update function to use COALESCE(t.bank_fee,0)=0 per user request
CREATE OR REPLACE FUNCTION public.update_bank_fees_from_payment_brand()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.purpletransaction t
  SET bank_fee =
      COALESCE(t.total, 0) * COALESCE((SELECT m.gateway_fee/100 FROM public.payment_methods m WHERE lower(t.payment_brand) = lower(m.payment_method) LIMIT 1), 0)
    + COALESCE((SELECT m.fixed_value FROM public.payment_methods m WHERE lower(t.payment_brand) = lower(m.payment_method) LIMIT 1), 0)
    + COALESCE(t.total, 0) * COALESCE((SELECT m.gateway_fee/100 FROM public.payment_methods m WHERE lower(t.payment_brand) = lower(m.payment_method) LIMIT 1), 0) * 0.15
    + COALESCE((SELECT m.fixed_value FROM public.payment_methods m WHERE lower(t.payment_brand) = lower(m.payment_method) LIMIT 1), 0) * 0.15
  WHERE COALESCE(t.payment_method, '') <> 'point'
    AND COALESCE(t.bank_fee, 0) = 0;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;