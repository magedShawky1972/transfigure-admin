INSERT INTO public.user_permissions (user_id, menu_item, has_access, parent_menu)
SELECT user_id, 'sqlQueryRunner', true, NULL
FROM public.user_permissions
WHERE menu_item = 'integrations' AND has_access = true
ON CONFLICT DO NOTHING;