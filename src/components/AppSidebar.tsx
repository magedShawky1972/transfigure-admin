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

  const URL_TO_PERMISSION: Record<string, string> = {
    "/": "dashboard",
    "/dashboard": "dashboard",
    "/ticket-dashboard": "ticket_dashboard",
    "/shift-dashboard": "shift_dashboard",
    "/task-dashboard": "task_dashboard",
    "/user-dashboard": "user_dashboard",
    "/reports": "reports",
    "/reports/riyad-bank": "reports",
    "/transactions": "transactions",
    "/tickets": "tickets",
    "/admin-tickets": "admin_tickets",
    "/department-management": "department_management",
    "/pivot-table": "pivotTable",
    "/load-data": "loadData",
    "/upload-log": "uploadLog",
    "/clear-data": "clearData",
    "/software-licenses": "softwareLicenses",
    "/reports-setup": "reportsSetup",
    "/customer-setup": "customerSetup",
    "/customer-profile": "customerProfile",
    "/customer-totals": "customerTotals",
    "/brand-setup": "brandSetup",
    "/brand-type": "brandType",
    "/product-setup": "productSetup",
    "/payment-method-setup": "paymentMethodSetup",
    "/user-setup": "userSetup",
    "/excel-sheets": "excelSetup",
    "/table-generator": "tableConfig",
    "/odoo-setup": "odooSetup",
    "/software-license-setup": "softwareLicenseSetup",
    "/system-config": "systemConfig",
    "/api-documentation": "api_documentation",
    "/api-integration-status": "apiIntegrationStatus",
    "/shift-setup": "shiftSetup",
    "/shift-calendar": "shiftCalendar",
    "/shift-session": "shiftSession",
    "/shift-follow-up": "shiftFollowUp",
    "/shift-attendance-report": "shiftAttendanceReport",
    "/my-shifts": "myShifts",
    "/tawasoul": "tawasoul",
    "/closing-training": "closingTraining",
    "/currency-setup": "currencySetup",
    "/user-group-setup": "userGroupSetup",
    "/projects-tasks": "projectsTasks",
    "/task-list": "taskList",
    "/project-setup": "projectSetup",
    "/company-hierarchy": "companyHierarchy",
    "/user-logins": "userLogins",
    "/supplier-setup": "supplierSetup",
    "/user-emails": "userEmails",
    "/asus-tawasoul": "asusTawasoul",
    "/email-manager": "emailManager",
    "/mail-setup": "mailSetup",
    "/company-news": "companyNews",
    "/pdf-to-excel": "pdfToExcel",
    "/system-backup": "systemBackup",
    "/system-restore": "systemRestore",
    "/employee-setup": "employeeSetup",
    "/vacation-setup": "vacationSetup",
    "/timesheet-management": "timesheetManagement",
    "/deduction-rules-setup": "deductionRulesSetup",
    "/medical-insurance-setup": "medicalInsuranceSetup",
    "/shift-plans-setup": "shiftPlansSetup",
    "/document-type-setup": "documentTypeSetup",
    "/attendance-type-setup": "attendanceTypeSetup",
    "/audit-logs": "auditLogs",
    "/certificate-management": "certificateManagement",
    "/security-dashboard": "securityDashboard",
    "/integration-access-control": "integrationAccessControl",
    "/job-setup": "jobSetup",
    "/zk-attendance-logs": "zkAttendanceLogs",
    "/hr-vacation-calendar": "hrVacationCalendar",
    "/company-wfh-calendar": "companyWfhCalendar",
    "/bank-setup": "bankSetup",
    "/treasury-setup": "treasurySetup",
    "/expense-category-setup": "expenseCategorySetup",
    "/expense-type-setup": "expenseTypeSetup",
    "/treasury-opening-balance": "treasuryOpeningBalance",
    "/treasury-entry": "treasuryEntry",
    "/bank-entry": "bankEntry",
    "/expense-requests": "expenseRequests",
    "/expense-entry": "expenseEntry",
    "/payment-bank-link": "paymentBankLink",
    "/api-consumption-logs": "apiConsumptionLogs",
    "/update-bank-ledger": "updateBankLedger",
    "/cost-center-setup": "costCenterSetup",
    "/void-payment": "voidPayment",
    "/receiving-coins": "receivingCoins",
    "/coins-creation": "coinsCreation",
    "/coins-sending": "coinsSending",
    "/coins-receiving-phase": "coinsReceivingPhase",
    "/coins-workflow-setup": "coinsWorkflowSetup",
    "/coins-purchase-followup": "coinsPurchaseFollowUp",
    "/coins-transaction-guide": "coinsTransactionGuide",
    "/supplier-advance-payment": "supplierAdvancePayment",
    "/coins-sheets": "coinsSheets",
    "/sales-sheets": "salesSheets",
    "/pricing-scenario": "pricingScenario",
    "/missing-shift-images": "missingShiftImages",
    "/employee-self-requests": "employeeRequests",
    "/employee-request-approvals": "employeeRequestApprovals",
    "/hr-manager-setup": "hrManagerSetup",
    "/acknowledgment-documents": "acknowledgmentDocuments",
    "/sales-order-entry": "salesOrderEntry",
    "/auto-upload": "autoUpload",
    "/wfh-checkin": "wfhCheckin",
    "/crm": "crmAccess",
    "/crm-setup": "crmSetup",
    "/knowledge-base": "knowledgeBase",
    "/api-transaction-mapping": "apiTransactionMapping",
    "/reports/payment-whatif": "paymentWhatIf",
    "/reports/payment-gateway-consolidation": "paymentGatewayConsolidation",
    "/cancelled-orders": "cancelledOrders",
    "/cancelled-orders-management": "cancelledOrdersManagement",
    "/menu-customization": "menuCustomization",
    "/integrations": "integrations",
    "/shift-generator": "shiftGenerator",
    "/sql-query-runner": "sqlQueryRunner",
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
        groupLabel,
        groupOrder: gc?.sort_order ?? gi,
        groupHidden: gc?.hidden ?? false,
      };
    })
    .filter((g) => !g.groupHidden)
    .sort((a, b) => a.groupOrder - b.groupOrder)
    .map(({ group, groupLabel }) => {
      const items = group.items
        .map((item, ii) => {
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
                className="text-sidebar-foreground/70 px-2 text-[12px] font-medium tracking-normal normal-case"
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
                              `group/link relative flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 text-sm ${
                                isActive
                                  ? "bg-sidebar-primary/15 text-sidebar-primary-foreground font-medium"
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
                                  className={`h-4 w-4 shrink-0 transition-colors ${
                                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover/link:text-sidebar-foreground"
                                  }`}
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
