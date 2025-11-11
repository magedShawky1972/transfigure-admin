
-- Add unique constraint to prevent duplicate permission records
ALTER TABLE user_permissions 
ADD CONSTRAINT user_permissions_unique_key 
UNIQUE (user_id, menu_item, parent_menu);
