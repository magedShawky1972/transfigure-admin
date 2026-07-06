
INSERT INTO public.user_permissions (user_id, menu_item, has_access, parent_menu)
SELECT ur.user_id, 'sajelErpSetup', true, NULL
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = ur.user_id
      AND up.menu_item = 'sajelErpSetup'
      AND up.parent_menu IS NULL
  );
