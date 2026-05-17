ALTER TABLE public.purpletransaction
ADD COLUMN IF NOT EXISTS revenue_source text GENERATED ALWAYS AS (
  CASE
    WHEN company = 'Purple' AND payment_method = 'hyperpay' THEN 'Purple'
    WHEN company = 'Purple' AND payment_method = 'salla'    THEN 'Salla'
    WHEN company = 'Asus'                                    THEN 'Asus'
    ELSE NULL
  END
) STORED;

CREATE INDEX IF NOT EXISTS idx_purpletransaction_revenue_source
  ON public.purpletransaction (revenue_source);
