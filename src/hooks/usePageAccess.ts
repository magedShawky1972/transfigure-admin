import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface UsePageAccessResult {
  hasAccess: boolean | null;
  isLoading: boolean;
  userId: string | null;
}

// Map of URLs to permission keys (same as AppSidebar)
const URL_TO_PERMISSION: Record<string, string> = {
  "/dashboard": "dashboard",
  "/ticket-dashboard": "ticket_dashboard",
  "/shift-dashboard": "shift_dashboard",
  "/task-dashboard": "task_dashboard",
  "/user-dashboard": "user_dashboard",
  "/api-documentation": "api_documentation",
  "/api-integration-status": "apiIntegrationStatus",
  "/api-consumption-logs": "apiConsumptionLogs",
  "/software-licenses": "softwareLicenses",
  "/software-license-setup": "softwareLicenseSetup",
  "/reports": "reports",
  "/transactions": "transactions",
  "/transaction-statistics": "transactionStatistics",
  "/pivot-table": "pivotTable",
  "/load-data": "loadData",
  "/upload-log": "uploadLog",
  "/clear-data": "clearData",
  "/tickets": "tickets",
  "/admin-tickets": "admin_tickets",
  "/shift-session": "shiftSession",
  "/my-shifts-calendar": "myShifts",
  "/shift-follow-up": "shiftFollowUp",
  "/tawasoul": "tawasoul",
  "/asus-tawasoul": "asusTawasoul",
  "/company-news": "companyNews",
  "/notifications": "notifications",
  "/reports-setup": "reportsSetup",
  "/customer-setup": "customerSetup",
  "/customer-profile": "customerProfile",
  "/customer-totals": "customerTotals",
  "/brand-setup": "brandSetup",
  "/brand-type": "brandType",
  "/product-setup": "productSetup",
  "/payment-method-setup": "paymentMethodSetup",
  "/department-management": "department_management",
  "/user-setup": "userSetup",
  "/shift-setup": "shiftSetup",
  "/shift-calendar": "shiftCalendar",
  "/currency-setup": "currencySetup",
  "/user-group-setup": "userGroupSetup",
  "/projects-tasks": "projectsTasks",
  "/project-gantt": "projectGantt",
  "/task-list": "taskList",
  "/company-hierarchy": "companyHierarchy",
  "/bank-setup": "bankSetup",
  "/supplier-setup": "supplierSetup",
  "/treasury-setup": "treasurySetup",
  "/vacation-setup": "vacationSetup",
  "/hr-vacation-calendar": "hrVacationCalendar",
  "/employee-self-requests": "employeeRequests",
  "/employee-request-approvals": "employeeRequestApprovals",
  "/hr-manager-setup": "hrManagerSetup",
  "/shift-plan-report": "shiftPlanReport",
  "/shift-report": "shiftReport",
  "/shift-plans-setup": "shiftPlansSetup",
  "/employee-setup": "employeeSetup",
  "/employee-profile": "employeeProfile",
  "/job-setup": "jobSetup",
  "/attendance-type-setup": "attendanceTypeSetup",
  "/deduction-rules-setup": "deductionRulesSetup",
  "/zk-attendance-logs": "zkAttendanceLogs",
  "/saved-attendance": "savedAttendance",
  "/timesheet-management": "timesheetManagement",
  "/medical-insurance-setup": "medicalInsuranceSetup",
  "/document-type-setup": "documentTypeSetup",
  "/odoo-sync-all": "odooSyncAll",
  "/odoo-sync-batch": "odooSyncBatch",
  "/odoo-sync-status-report": "odooSyncStatusReport",
  "/aggregated-order-report": "aggregatedOrderReport",
  "/order-payment-report": "orderPaymentReport",
  "/bank-statement-report": "bankStatementReport",
  "/bank-balance-by-date-report": "bankBalanceByDateReport",
  "/bank-statement-as-of": "bankStatementAsOf",
  "/bank-statement-by-bank-report": "bankStatementByBankReport",
  "/brand-balance-report": "brandBalanceReport",
  "/revenue-by-brand-type": "revenueByBrandType",
  "/cost-by-brand-type": "costByBrandType",
  "/coins-ledger-report": "coinsLedgerReport",
  "/sold-product-report": "soldProductReport",
  "/tickets-report": "ticketsReport",
  "/software-licenses-report": "softwareLicensesReport",
  "/expense-category-setup": "expenseCategorySetup",
  "/expense-type-setup": "expenseTypeSetup",
  "/treasury-opening-balance": "treasuryOpeningBalance",
  "/treasury-entry": "treasuryEntry",
  "/bank-entry": "bankEntry",
  "/expense-entry": "expenseEntry",
  "/expense-requests": "expenseRequests",
  "/payment-bank-link": "paymentBankLink",
  "/closing-training": "closingTraining",
  "/odoo-setup": "odooSetup",
  "/excel-setup": "excelSetup",
  "/table-configuration": "tableConfiguration",
  "/pdf-to-excel": "pdfToExcel",
  "/system-backup": "systemBackup",
  "/system-restore": "systemRestore",
  "/audit-logs": "auditLogs",
  "/certificate-management": "certificateManagement",
  "/security-dashboard": "securityDashboard",
  "/user-logins": "usersLogins",
  "/user-emails": "usersEmails",
  "/mail-setup": "mailSetup",
  "/system-config": "systemConfiguration",
  "/data-loading-status": "dataLoadingStatus",
  "/expense-reports": "expenseReports",
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
  "/acknowledgment-documents": "acknowledgmentDocuments",
  "/missing-shift-images": "missingShiftImages",
  "/sales-order-entry": "salesOrderEntry",
  "/auto-upload": "autoUpload",
};

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
