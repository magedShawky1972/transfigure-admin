-- Add bank_id column to payment_methods table to link each payment method to a bank
ALTER TABLE public.payment_methods 
ADD COLUMN bank_id UUID REFERENCES public.banks(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_payment_methods_bank_id ON public.payment_methods(bank_id);

-- Add comment for documentation
COMMENT ON COLUMN public.payment_methods.bank_id IS 'Links the payment method to a bank where payments will be deposited after deducting fees';