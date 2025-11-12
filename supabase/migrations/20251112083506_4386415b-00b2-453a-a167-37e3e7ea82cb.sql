-- Update transaction_group_by column to jsonb to support multi-level grouping
ALTER TABLE public.profiles 
ALTER COLUMN transaction_group_by TYPE jsonb USING 
  CASE 
    WHEN transaction_group_by IS NULL THEN NULL
    WHEN transaction_group_by = '' THEN NULL
    ELSE jsonb_build_array(jsonb_build_object(
      'columnId', transaction_group_by,
      'label', transaction_group_by,
      'sortDirection', 'asc'
    ))
  END;

-- Update comment
COMMENT ON COLUMN public.profiles.transaction_group_by IS 'User-specific multi-level group by configuration for transactions grid (array of GroupLevel objects)';