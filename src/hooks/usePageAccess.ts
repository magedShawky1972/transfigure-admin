import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { URL_TO_PERMISSION } from "@/lib/menuPermissions";

interface UsePageAccessResult {
  hasAccess: boolean | null;
  isLoading: boolean;
  userId: string | null;
}

export const usePageAccess = (pageUrl?: string): UsePageAccessResult => {
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }

        setUserId(user.id);

        // Get the current path if not provided
        const currentPath = pageUrl || window.location.pathname;
        const permissionKey = URL_TO_PERMISSION[currentPath];

        // If no permission key is defined for this URL, allow access (public page)
        if (!permissionKey) {
          setHasAccess(true);
          setIsLoading(false);
          return;
        }

        // Check most recent permission record for this page
        const { data: permissions, error: permError } = await supabase
          .from('user_permissions')
          .select('has_access, created_at')
          .eq('user_id', user.id)
          .eq('menu_item', permissionKey)
          .order('created_at', { ascending: false })
          .limit(1);

        if (permError) {
          console.error('Error checking permission:', permError);
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        if (permissions && permissions.length > 0 && permissions[0].has_access) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [navigate, pageUrl]);

  return { hasAccess, isLoading, userId };
};

export { URL_TO_PERMISSION };
