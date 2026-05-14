import { NavLink } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Search, X, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchMenuCustomizations, groupKey, itemKey, type CustomMap } from "@/lib/menuCustomizations";
import { DEFAULT_MENU } from "@/lib/menuRegistry";
import { URL_TO_PERMISSION } from "@/lib/menuPermissions";

const COLLAPSED_GROUPS_KEY = "sidebar-collapsed-groups";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, language } = useLanguage();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [asusTawasoulUnread, setAsusTawasoulUnread] = useState(0);
  const [customizations, setCustomizations] = useState<CustomMap>({});
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const allGroups = new Set(DEFAULT_MENU.map((g) => g.defaultEn));
    try {
      const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      return stored ? new Set(JSON.parse(stored)) : allGroups;
    } catch {
      return allGroups;
    }
  });

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const setAllGroups = (collapseAll: boolean) => {
    const next = collapseAll ? new Set(DEFAULT_MENU.map((g) => g.defaultEn)) : new Set<string>();
    setCollapsedGroups(next);
    try {
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next)));
    } catch {}
  };

  useEffect(() => {
    fetchUserPermissions();
    fetchAsusTawasoulUnread();
    fetchMenuCustomizations().then(setCustomizations);

    const customChannel = supabase
      .channel('menu-customizations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_customizations' }, () => {
        fetchMenuCustomizations().then(setCustomizations);
      })
      .subscribe();

    // Set up real-time subscription for permission changes
    const permChannel = supabase
      .channel('user-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_permissions',
        },
        (payload) => {
          console.log('Permission change detected:', payload);
          fetchUserPermissions();
        }
      )
      .subscribe();

    // Set up real-time subscription for internal messages (INSERT and UPDATE for read status)
    const msgChannel = supabase
      .channel('sidebar-internal-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages',
        },
        () => {
          fetchAsusTawasoulUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(permChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(customChannel);
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

      // Get only the most recent permission for each menu item
      const permissionsMap = new Map<string, boolean>();
      data?.forEach(p => {
        if (!permissionsMap.has(p.menu_item)) {
          permissionsMap.set(p.menu_item, p.has_access);
        }
      });

      // Only include items where has_access is true
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

  const fetchAsusTawasoulUnread = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's conversation IDs
      const { data: participations } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!participations || participations.length === 0) {
        setAsusTawasoulUnread(0);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);

      // Count unread messages not sent by current user
      const { count } = await supabase
        .from('internal_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      setAsusTawasoulUnread(count || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const hasAccess = (url: string): boolean => {
    const permissionKey = URL_TO_PERMISSION[url];
    return userPermissions.has(permissionKey);
  };

  if (loading) {
    return null;
  }

  const isRTL = language === "ar";
  const searchQ = search.trim().toLowerCase();
  const isSearching = searchQ.length > 0;
  const allCollapsed = collapsedGroups.size === DEFAULT_MENU.length;

  // Build a mapping: groupKey -> override item list (urls moved into this group from elsewhere)
  const itemOverrideTargets: Record<string, { url: string; icon: any; defaultEn: string; defaultAr: string; originalIdx: number }[]> = {};
  DEFAULT_MENU.forEach((g) => {
    g.items.forEach((it, ii) => {
      const ic = customizations[itemKey(it.url)];
      if (ic?.parent_group) {
        if (!itemOverrideTargets[ic.parent_group]) itemOverrideTargets[ic.parent_group] = [];
        itemOverrideTargets[ic.parent_group].push({
          url: it.url,
          icon: it.icon,
          defaultEn: it.defaultEn,
          defaultAr: it.defaultAr,
          originalIdx: ii,
        });
      }
    });
  });

  // Pre-compute visible groups + filtered items
  const visibleGroups = DEFAULT_MENU
    .map((group, gi) => {
      const gKey = groupKey(group.defaultEn);
      const gc = customizations[gKey];
      const groupLabel =
        gc && (isRTL ? gc.name_ar : gc.name_en)
          ? (isRTL ? gc.name_ar! : gc.name_en!)
          : (isRTL ? group.defaultAr : group.defaultEn);
      return {
        group,
        gKey,
        groupLabel,
        groupOrder: gc?.sort_order ?? gi,
        groupHidden: gc?.hidden ?? false,
      };
    })
    .filter((g) => !g.groupHidden)
    .sort((a, b) => a.groupOrder - b.groupOrder)
    .map(({ group, gKey, groupLabel }) => {
      // Items that natively belong here, MINUS any moved out
      const native = group.items
        .filter((it) => {
          const ic = customizations[itemKey(it.url)];
          return !ic?.parent_group || ic.parent_group === gKey;
        })
        .map((item, ii) => ({ item, ii }));

      // Items moved INTO this group from other groups
      const incoming = (itemOverrideTargets[gKey] || []).map((o) => ({
        item: { url: o.url, icon: o.icon, defaultEn: o.defaultEn, defaultAr: o.defaultAr },
        ii: o.originalIdx,
      }));

      const items = [...native, ...incoming]
        .map(({ item, ii }) => {
          const ic = customizations[itemKey(item.url)];
          const title =
            ic && (isRTL ? ic.name_ar : ic.name_en)
              ? (isRTL ? ic.name_ar! : ic.name_en!)
              : (isRTL ? item.defaultAr : item.defaultEn);
          return {
            url: item.url,
            icon: item.icon,
            title,
            _order: ic?.sort_order ?? ii,
            _hidden: ic?.hidden ?? false,
          };
        })
        .filter((item) => !item._hidden && hasAccess(item.url))
        .filter((item) => !isSearching || item.title.toLowerCase().includes(searchQ))
        .sort((a, b) => a._order - b._order);
      return { group, groupLabel, items };
    })
    .filter((g) => g.items.length > 0);


  return (
    <Sidebar
      side={isRTL ? "right" : "left"}
      className={`${isRTL ? "border-l" : "border-r"} border-sidebar-border bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] min-w-56`}
    >
      <SidebarHeader className="gap-2 border-b border-sidebar-border/60 px-3 py-3 sticky top-0 z-10 bg-[hsl(var(--sidebar-background))]/95 backdrop-blur-sm">
        <div className="relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-foreground/50 ${isRTL ? "right-2.5" : "left-2.5"}`} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? "بحث في القائمة..." : "Search menu..."}
            className={`h-8 ${isRTL ? "pr-8 pl-7 text-right" : "pl-8 pr-7"} bg-sidebar-accent/40 border-sidebar-border/60 text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-1 focus-visible:ring-sidebar-ring`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "left-2" : "right-2"} text-sidebar-foreground/50 hover:text-sidebar-foreground`}
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/60">
          <span>
            {visibleGroups.length} {isRTL ? "مجموعات" : "groups"}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAllGroups(!allCollapsed)}
                className="h-6 px-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
              >
                {allCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {allCollapsed ? (isRTL ? "توسيع الكل" : "Expand all") : (isRTL ? "طي الكل" : "Collapse all")}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1 py-2 gap-0.5">
        {visibleGroups.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-sidebar-foreground/50">
            {isRTL ? "لا توجد نتائج" : "No results found"}
          </div>
        )}
        {visibleGroups.map(({ group, groupLabel, items }) => {
          const isCollapsed = !isSearching && collapsedGroups.has(group.defaultEn);
          return (
            <SidebarGroup key={group.defaultEn} className="px-1 py-1">
              <SidebarGroupLabel
                asChild
                className="text-sidebar-foreground/80 px-2 text-[15px] font-semibold tracking-normal normal-case"
              >
                <button
                  type="button"
                  onClick={() => !isSearching && toggleGroup(group.defaultEn)}
                  className="flex w-full items-center justify-between gap-2 hover:text-sidebar-foreground transition-colors rounded-md py-1"
                  aria-expanded={!isCollapsed}
                  disabled={isSearching}
                >
                  <span className="truncate">{groupLabel}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] font-normal text-sidebar-foreground/40 tabular-nums">
                      {items.length}
                    </span>
                    {!isSearching && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                          isCollapsed ? (isRTL ? "rotate-90" : "-rotate-90") : ""
                        }`}
                      />
                    )}
                  </span>
                </button>
              </SidebarGroupLabel>
              {!isCollapsed && (
                <SidebarGroupContent className="mt-1">
                  <SidebarMenu className="gap-0.5">
                    {items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild className="h-auto p-0">
                          <NavLink
                            to={item.url}
                            end
                            className={({ isActive }) =>
                              `group/link relative flex items-center gap-3 px-3 py-1.5 rounded-md transition-all duration-150 text-[13px] leading-tight ${
                                isActive
                                  ? "bg-sidebar-primary/15 text-sidebar-primary-foreground font-semibold"
                                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5"
                              }`
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={`absolute ${isRTL ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-sidebar-primary transition-all duration-200 ${
                                    isActive ? "opacity-100 scale-100" : "opacity-0 scale-50"
                                  }`}
                                />
                                <item.icon
                                  className="h-4 w-4 shrink-0 transition-colors text-sidebar-foreground/60 group-hover/link:text-sidebar-foreground"
                                />
                                <span className="truncate">{item.title}</span>
                                {item.url === "/asus-tawasoul" && asusTawasoulUnread > 0 && (
                                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                                    {asusTawasoulUnread}
                                  </span>
                                )}
                              </>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
