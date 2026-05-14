import { NavLink } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { fetchMenuCustomizations, groupKey, itemKey, type CustomMap } from "@/lib/menuCustomizations";
import { DEFAULT_MENU } from "@/lib/menuRegistry";
import { URL_TO_PERMISSION } from "@/lib/menuPermissions";

export function MainPageMenu() {
  const { language } = useLanguage();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [customizations, setCustomizations] = useState<CustomMap>({});
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    fetchUserPermissions();
    fetchMenuCustomizations().then(setCustomizations);

    const channel = supabase
      .channel('main-page-menu-customizations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_customizations' }, () => {
        fetchMenuCustomizations().then(setCustomizations);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_permissions")
        .select("menu_item, has_access, created_at")
        .eq("user_id", user.id)
        .is("parent_menu", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const permissionsMap = new Map<string, boolean>();
      data?.forEach(p => {
        if (!permissionsMap.has(p.menu_item)) {
          permissionsMap.set(p.menu_item, p.has_access);
        }
      });

      const permissions = new Set(
        Array.from(permissionsMap.entries())
          .filter(([_, hasAccess]) => hasAccess)
          .map(([menuItem]) => menuItem)
      );

      setUserPermissions(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (url: string): boolean => {
    const permissionKey = URL_TO_PERMISSION[url];
    return userPermissions.has(permissionKey);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const itemOverrideTargets: Record<
    string,
    { url: string; icon: any; defaultEn: string; defaultAr: string; originalIdx: number }[]
  > = {};

  DEFAULT_MENU.forEach((group) => {
    group.items.forEach((item, ii) => {
      const ic = customizations[itemKey(item.url)];
      if (ic?.parent_group) {
        if (!itemOverrideTargets[ic.parent_group]) itemOverrideTargets[ic.parent_group] = [];
        itemOverrideTargets[ic.parent_group].push({
          url: item.url,
          icon: item.icon,
          defaultEn: item.defaultEn,
          defaultAr: item.defaultAr,
          originalIdx: ii,
        });
      }
    });
  });

  const orderedGroups = DEFAULT_MENU
    .map((group, gi) => {
      const gc = customizations[groupKey(group.defaultEn)];
      const labelOverride =
        gc && (language === "ar" ? gc.name_ar : gc.name_en)
          ? (language === "ar" ? gc.name_ar! : gc.name_en!)
          : (language === "ar" ? group.defaultAr : group.defaultEn);
      return {
        group,
        displayLabel: labelOverride,
        _order: gc?.sort_order ?? gi,
        _hidden: gc?.hidden ?? false,
      };
    })
    .filter((g) => !g._hidden)
    .sort((a, b) => a._order - b._order);

  return (
    <div className="space-y-8 p-4" dir={language === "ar" ? "rtl" : "ltr"}>
      {orderedGroups.map(({ group, displayLabel }) => {
        const gKey = groupKey(group.defaultEn);

        const nativeItems = group.items
          .filter((item) => {
            const ic = customizations[itemKey(item.url)];
            return !ic?.parent_group || ic.parent_group === gKey;
          })
          .map((item, ii) => ({ item, ii }));

        const incomingItems = (itemOverrideTargets[gKey] || []).map((item) => ({
          item: {
            url: item.url,
            icon: item.icon,
            defaultEn: item.defaultEn,
            defaultAr: item.defaultAr,
          },
          ii: item.originalIdx,
        }));

        const items = [...nativeItems, ...incomingItems]
          .map(({ item, ii }) => {
            const ic = customizations[itemKey(item.url)];
            const title =
              ic && (language === "ar" ? ic.name_ar : ic.name_en)
                ? (language === "ar" ? ic.name_ar! : ic.name_en!)
                : (language === "ar" ? item.defaultAr : item.defaultEn);
            return {
              url: item.url,
              icon: item.icon,
              displayTitle: title,
              _order: ic?.sort_order ?? ii,
              _hidden: ic?.hidden ?? false,
            };
          })
          .filter((item) => !item._hidden && hasAccess(item.url))
          .sort((a, b) => a._order - b._order);

        if (items.length === 0) return null;

        const isOpen = openGroups.has(group.defaultEn);
        return (
          <div key={group.defaultEn} className="space-y-4">
            <button
              type="button"
              onClick={() => toggleGroup(group.defaultEn)}
              className="w-full flex items-center justify-between text-lg font-semibold text-primary border-b border-border pb-2 hover:text-primary/80 transition-colors"
            >
              <span>{displayLabel}</span>
              {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            {isOpen && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-card hover:bg-muted hover:border-primary/50 transition-all group"
                    >
                      <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-xs text-center font-medium text-muted-foreground group-hover:text-foreground line-clamp-2">
                        {item.displayTitle}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
