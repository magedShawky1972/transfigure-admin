-- Remove duplicate rows for (order_number, product_id) keeping the most recently updated one
DELETE FROM public.purpletransaction
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY order_number, product_id 
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) as rn
    FROM public.purpletransaction
    WHERE product_id IS NOT NULL AND order_number IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Create unique constraint on (order_number, product_id) for non-null values only
CREATE UNIQUE INDEX purpletransaction_order_number_product_id_unique 
ON public.purpletransaction (order_number, product_id) 
WHERE product_id IS NOT NULL AND order_number IS NOT NULL;