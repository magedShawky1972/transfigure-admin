

## One-time SQL: Populate `sku_start_with` from existing product SKUs

**Goal**: Run a single SQL UPDATE to set `brands.sku_start_with` for all brands where it's currently NULL, using the alphabetic prefix detected from existing product SKUs.

### SQL Logic

For each brand with `sku_start_with IS NULL`:
1. Find products matching that brand's `brand_code`
2. Extract the leading alphabetic characters from their SKU (e.g., "B" from "B001")
3. Pick the most common prefix
4. Update `brands.sku_start_with` with that value

### SQL Query

```sql
UPDATE brands b
SET sku_start_with = sub.detected_prefix
FROM (
  SELECT 
    p.brand_code,
    UPPER(
      (regexp_match(p.sku, '^[A-Za-z]+'))[1]
    ) AS detected_prefix,
    COUNT(*) AS cnt
  FROM products p
  WHERE p.sku IS NOT NULL
    AND p.brand_code IS NOT NULL
    AND (regexp_match(p.sku, '^[A-Za-z]+'))[1] IS NOT NULL
  GROUP BY p.brand_code, UPPER((regexp_match(p.sku, '^[A-Za-z]+'))[1])
) sub
WHERE b.brand_code = sub.brand_code
  AND b.sku_start_with IS NULL;
```

If multiple prefixes exist for a brand, we take the most common one using `DISTINCT ON`:

```sql
UPDATE brands b
SET sku_start_with = sub.detected_prefix
FROM (
  SELECT DISTINCT ON (brand_code) 
    brand_code,
    UPPER((regexp_match(sku, '^[A-Za-z]+'))[1]) AS detected_prefix,
    COUNT(*) AS cnt
  FROM products
  WHERE sku IS NOT NULL
    AND brand_code IS NOT NULL
    AND (regexp_match(sku, '^[A-Za-z]+'))[1] IS NOT NULL
  GROUP BY brand_code, UPPER((regexp_match(sku, '^[A-Za-z]+'))[1])
  ORDER BY brand_code, cnt DESC
) sub
WHERE b.brand_code = sub.brand_code
  AND b.sku_start_with IS NULL;
```

### Implementation
- Run this as a data UPDATE via the insert tool (not a migration, since it's a data change)
- No code changes needed — the existing SKU generation logic already reads `sku_start_with` correctly
- After this runs, all brands like Binmo will have `sku_start_with = 'B'` saved in the database

