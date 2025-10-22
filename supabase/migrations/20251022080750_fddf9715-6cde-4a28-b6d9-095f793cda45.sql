-- Create function to update bank fees based on payment_brand matching payment_methods.payment_method
-- Applies 15% VAT to both gateway fee and fixed value, only for rows where payment_method <> 'point' and bank_fee IS NULL
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
    AND t.bank_fee IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;