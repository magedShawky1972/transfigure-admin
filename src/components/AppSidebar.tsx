import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchMenuCustomizations, groupKey, itemKey, type CustomMap } from "@/lib/menuCustomizations";
import { DEFAULT_MENU } from "@/lib/menuRegistry";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, language } = useLanguage();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [asusTawasoulUnread, setAsusTawasoulUnread] = useState(0);
  const [customizations, setCustomizations] = useState<CustomMap>({});

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

  return (
    <Sidebar
      side={language === "ar" ? "right" : "left"}
      className={`${language === "ar" ? "border-l" : "border-r"} border-sidebar-border bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] min-w-56`}
    >
      <SidebarContent>
        {DEFAULT_MENU
          .map((group, gi) => {
            const gKey = groupKey(group.defaultEn);
            const gc = customizations[gKey];
            const groupLabel =
              gc && (language === "ar" ? gc.name_ar : gc.name_en)
                ? (language === "ar" ? gc.name_ar! : gc.name_en!)
                : (language === "ar" ? group.defaultAr : group.defaultEn);
            const groupOrder = gc?.sort_order ?? gi;
            const groupHidden = gc?.hidden ?? false;
            return { group, groupLabel, groupOrder, groupHidden };
          })
          .filter((g) => !g.groupHidden)
          .sort((a, b) => a.groupOrder - b.groupOrder)
          .map(({ group, groupLabel }) => {
            const filteredItems = group.items
              .map((item, ii) => {
                const ic = customizations[itemKey(item.url)];
                const title =
                  ic && (language === "ar" ? ic.name_ar : ic.name_en)
                    ? (language === "ar" ? ic.name_ar! : ic.name_en!)
                    : (language === "ar" ? item.defaultAr : item.defaultEn);
                return {
                  url: item.url,
                  icon: item.icon,
                  title,
                  _order: ic?.sort_order ?? ii,
                  _hidden: ic?.hidden ?? false,
                };
              })
              .filter((item) => !item._hidden && hasAccess(item.url))
              .sort((a, b) => a._order - b._order);

            if (filteredItems.length === 0) return null;

            return (
              <SidebarGroup key={group.defaultEn}>
                <SidebarGroupLabel className="text-sidebar-foreground/70 mb-2 px-3 text-sm font-semibold">
                  {groupLabel}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-base ${
                                isActive
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`
                            }
                          >
                            <item.icon className="h-5 w-5 shrink-0" />
                            <span>{item.title}</span>
                            {item.url === "/asus-tawasoul" && asusTawasoulUnread > 0 && (
                              <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                                {asusTawasoulUnread}
                              </span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
      </SidebarContent>
    </Sidebar>
  );
}
