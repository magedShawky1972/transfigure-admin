-- Step 1: Delete duplicate order_numbers, keeping only the most recent transaction
DELETE FROM public.purpletransaction
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY order_number ORDER BY created_at DESC) as rn
    FROM public.purpletransaction
    WHERE order_number IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Step 2: Add unique constraint on order_number
ALTER TABLE public.purpletransaction 
ADD CONSTRAINT purpletransaction_order_number_unique UNIQUE (order_number);