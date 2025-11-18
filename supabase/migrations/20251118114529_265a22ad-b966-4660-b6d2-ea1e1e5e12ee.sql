-- Update existing purpletransaction records that have NULL brand_code
-- by looking up the brand_code from brands table using brand_name
UPDATE purpletransaction t
SET brand_code = b.brand_code
FROM brands b
WHERE t.brand_name = b.brand_name
  AND t.brand_code IS NULL
  AND b.brand_code IS NOT NULL;