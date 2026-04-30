import { NavLink } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { fetchMenuCustomizations, groupKey, itemKey, type CustomMap } from "@/lib/menuCustomizations";
import { DEFAULT_MENU } from "@/lib/menuRegistry";

// URL → permission key map (kept in sync with usePageAccess / AppSidebar)
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

export function MainPageMenu() {
  const { language } = useLanguage();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [customizations, setCustomizations] = useState<CustomMap>({});

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
        const items = group.items
          .map((item, ii) => {
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

        return (
          <div key={group.defaultEn} className="space-y-4">
            <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
              {displayLabel}
            </h2>
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
          </div>
        );
      })}
    </div>
  );
}
