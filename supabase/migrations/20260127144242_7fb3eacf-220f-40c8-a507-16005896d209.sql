-- Allow Shift Admins to update AI reads for any brand balance
-- (Fixes manual edits not persisting for Shift Admin users)

ALTER TABLE public.shift_brand_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- If policy exists, drop it (idempotent)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='shift_brand_balances' AND policyname='Shift admins can update brand balances'
  ) THEN
    DROP POLICY "Shift admins can update brand balances" ON public.shift_brand_balances;
  END IF;
END$$;

CREATE POLICY "Shift admins can update brand balances"
ON public.shift_brand_balances
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shift_admins sa
    WHERE sa.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.shift_admins sa
    WHERE sa.user_id = auth.uid()
  )
);
