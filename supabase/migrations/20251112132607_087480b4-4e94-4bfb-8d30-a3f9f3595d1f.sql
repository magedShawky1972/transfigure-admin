-- Add new fields to products table

-- Mobile and status fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mobile_enabled boolean DEFAULT true;

-- Coins fields
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS coins_number numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_coins numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_coins numeric DEFAULT 0;

-- Max order quantity (we already have minimum_order_quantity)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS maximum_order_quantity numeric DEFAULT 10;

-- Tax type
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'tax_included';

-- Free coins as JSON array
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS free_coins jsonb DEFAULT '[]'::jsonb;

-- Options as JSON array
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]'::jsonb;

-- Customer group prices as JSON array
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS customer_group_prices jsonb DEFAULT '[]'::jsonb;

-- Discounts as JSON array
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discounts jsonb DEFAULT '[]'::jsonb;

-- SEO fields - Arabic
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_title_ar text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_keywords_ar text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_description_ar text;

-- SEO fields - English
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_title_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_keywords_en text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_description_en text;

-- Add comments for documentation
COMMENT ON COLUMN public.products.mobile_enabled IS 'Whether the product is enabled for mobile';
COMMENT ON COLUMN public.products.coins_number IS 'Number of coins given for this product';
COMMENT ON COLUMN public.products.min_coins IS 'Minimum coins required';
COMMENT ON COLUMN public.products.max_coins IS 'Maximum coins allowed';
COMMENT ON COLUMN public.products.maximum_order_quantity IS 'Maximum order quantity allowed';
COMMENT ON COLUMN public.products.tax_type IS 'Tax type: tax_included or tax_excluded';
COMMENT ON COLUMN public.products.free_coins IS 'Free coins configuration as JSON array';
COMMENT ON COLUMN public.products.options IS 'Product options as JSON array';
COMMENT ON COLUMN public.products.customer_group_prices IS 'Customer group prices as JSON array';
COMMENT ON COLUMN public.products.discounts IS 'Product discounts as JSON array';
COMMENT ON COLUMN public.products.meta_title_ar IS 'SEO meta title in Arabic';
COMMENT ON COLUMN public.products.meta_keywords_ar IS 'SEO meta keywords in Arabic';
COMMENT ON COLUMN public.products.meta_description_ar IS 'SEO meta description in Arabic';
COMMENT ON COLUMN public.products.meta_title_en IS 'SEO meta title in English';
COMMENT ON COLUMN public.products.meta_keywords_en IS 'SEO meta keywords in English';
COMMENT ON COLUMN public.products.meta_description_en IS 'SEO meta description in English';