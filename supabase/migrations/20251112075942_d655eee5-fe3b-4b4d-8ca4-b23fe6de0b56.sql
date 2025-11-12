-- Add column preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS transaction_column_order jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transaction_column_visibility jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS transaction_group_by text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.transaction_column_order IS 'User-specific column order for transactions grid';
COMMENT ON COLUMN public.profiles.transaction_column_visibility IS 'User-specific column visibility settings for transactions grid';
COMMENT ON COLUMN public.profiles.transaction_group_by IS 'User-specific group by column for transactions grid';