INSERT INTO public.user_permissions (user_id, menu_item, has_access)
SELECT DISTINCT up.user_id, 'projectPresentation', true
FROM public.user_permissions up
WHERE up.menu_item = 'taskList' AND up.has_access = true AND up.parent_menu IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.user_permissions x
  WHERE x.user_id = up.user_id AND x.menu_item = 'projectPresentation'
);