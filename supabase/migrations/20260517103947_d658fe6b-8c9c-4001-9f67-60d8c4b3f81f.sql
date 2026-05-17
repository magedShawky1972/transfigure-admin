ALTER TABLE public.manual_sales_order_lines
ADD COLUMN IF NOT EXISTS product_id uuid;

CREATE INDEX IF NOT EXISTS idx_manual_sales_order_lines_product_id
ON public.manual_sales_order_lines(product_id);

WITH unique_product_matches AS (
  SELECT
    l.id AS line_id,
    (ARRAY_AGG(p.id ORDER BY p.id))[1] AS matched_product_id
  FROM public.manual_sales_order_lines l
  JOIN public.products p
    ON p.product_name = l.product_name
   AND (
     (l.brand_id IS NOT NULL AND EXISTS (
       SELECT 1
       FROM public.brands b
       WHERE b.id = l.brand_id
         AND (
           (b.brand_code IS NOT NULL AND b.brand_code = p.brand_code)
           OR (b.brand_name IS NOT NULL AND b.brand_name = p.brand_name)
         )
     ))
     OR (l.brand_code IS NOT NULL AND l.brand_code = p.brand_code)
     OR (l.brand_name IS NOT NULL AND l.brand_name = p.brand_name)
     OR (l.brand_id IS NULL AND l.brand_code IS NULL AND l.brand_name IS NULL)
   )
  WHERE l.product_id IS NULL
    AND l.product_name IS NOT NULL
  GROUP BY l.id
  HAVING COUNT(*) = 1
)
UPDATE public.manual_sales_order_lines l
SET product_id = m.matched_product_id
FROM unique_product_matches m
WHERE l.id = m.line_id
  AND l.product_id IS NULL;