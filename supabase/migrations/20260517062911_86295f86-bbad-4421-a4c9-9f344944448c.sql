INSERT INTO public.user_permissions (user_id, parent_menu, menu_item, has_access)
SELECT DISTINCT user_id, 'Reports', 'income-statement', true
FROM public.user_permissions
WHERE parent_menu = 'Reports' AND has_access = true
ON CONFLICT DO NOTHING;