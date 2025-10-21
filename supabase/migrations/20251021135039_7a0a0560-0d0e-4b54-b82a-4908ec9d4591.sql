-- Add bank_fee column to purpletransaction table
ALTER TABLE public.purpletransaction 
ADD COLUMN IF NOT EXISTS bank_fee NUMERIC DEFAULT 0;

-- Update existing records with calculated bank_fee
UPDATE public.purpletransaction pt
SET bank_fee = CASE 
  WHEN pt.payment_method IS NOT NULL AND pm.payment_method IS NOT NULL THEN
    -- gateway_fee_amount = (gateway_fee / 100) * total
    -- vat_on_gateway = gateway_fee_amount * 0.15
    -- bank_fee = gateway_fee_amount + fixed_value + vat_on_gateway
    COALESCE(
      ((pm.gateway_fee / 100.0) * COALESCE(pt.total, 0)) + 
      pm.fixed_value + 
      (((pm.gateway_fee / 100.0) * COALESCE(pt.total, 0)) * 0.15),
      0
    )
  ELSE 0
END
FROM public.payment_methods pm
WHERE pt.payment_method = pm.payment_method 
  AND pm.is_active = true;