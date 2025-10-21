-- Update bank_fee for purpletransaction records with corrected formula
-- Formula: bank_fee = gateway_fee_amount + fixed_value + vat_on_gateway + vat_on_fixed
-- where gateway_fee_amount = total * (gateway_fee/100)
-- vat_on_gateway = gateway_fee_amount * 0.15
-- vat_on_fixed = fixed_value * 0.15
-- Only for non-null payment_method and not 'point'

UPDATE public.purpletransaction pt
SET bank_fee = COALESCE(
  (pt.total * (pm.gateway_fee / 100.0)) + 
  pm.fixed_value + 
  ((pt.total * (pm.gateway_fee / 100.0)) * 0.15) +
  (pm.fixed_value * 0.15),
  0
)
FROM public.payment_methods pm
WHERE pt.payment_brand = pm.payment_method 
  AND pm.is_active = true
  AND pt.payment_method IS NOT NULL
  AND pt.payment_method <> 'point';