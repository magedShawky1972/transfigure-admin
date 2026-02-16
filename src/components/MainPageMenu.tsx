import { NavLink } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, TicketCheck, Clock, FolderKanban, Users, Key, FileBarChart, FileText, Table2, Grid3x3,
  FileSpreadsheet, Database, MessageCircle, Calendar, Mail, Settings, UserCheck, TrendingUp, CreditCard,
  DollarSign, Building2, Truck, UserCircle, Palmtree, ClipboardList, Calculator, HeartPulse, Briefcase,
  KeyRound, Shield, Cloud, GraduationCap, Link2, HardDrive, RotateCcw, ClipboardCheck, FileKey, Receipt, ScrollText, BarChart3, Target, FileSignature, ImageIcon, Undo2
} from "lucide-react";

const URL_TO_PERMISSION: Record<string, string> = {
  "/": "dashboard",
  "/dashboard": "dashboard",
  "/ticket-dashboard": "ticket_dashboard",
  "/shift-dashboard": "shift_dashboard",
  "/task-dashboard": "task_dashboard",
  "/user-dashboard": "user_dashboard",
  "/reports": "reports",
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
  "/my-shifts": "myShifts",
  "/tawasoul": "tawasoul",
  "/closing-training": "closingTraining",
  "/currency-setup": "currencySetup",
  "/user-group-setup": "userGroupSetup",
  "/projects-tasks": "projectsTasks",
  "/task-list": "taskList",
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
  "/job-setup": "jobSetup",
  "/zk-attendance-logs": "zkAttendanceLogs",
  "/hr-vacation-calendar": "hrVacationCalendar",
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
  "/acknowledgment-documents": "acknowledgmentDocuments",
  "/receiving-coins": "receivingCoins",
  "/coins-creation": "coinsCreation",
  "/coins-sending": "coinsSending",
  "/coins-receiving-phase": "coinsReceivingPhase",
  "/coins-workflow-setup": "coinsWorkflowSetup",
  "/shift-attendance-report": "shiftAttendanceReport",
  "/missing-shift-images": "missingShiftImages",
  "/project-setup": "projectSetup",
  "/employee-self-requests": "employeeRequests",
  "/employee-request-approvals": "employeeRequestApprovals",
  "/hr-manager-setup": "hrManagerSetup",
  "/void-payment": "voidPayment",
};

interface MenuItem {
  title: string;
  titleAr: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  label: string;
  labelAr: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Reports",
    labelAr: "التقارير",
    items: [
      { title: "Dashboard", titleAr: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
      { title: "Ticket Dashboard", titleAr: "لوحة التذاكر", url: "/ticket-dashboard", icon: TicketCheck },
      { title: "Shift Dashboard", titleAr: "لوحة الورديات", url: "/shift-dashboard", icon: Clock },
      { title: "Task Dashboard", titleAr: "لوحة المهام", url: "/task-dashboard", icon: FolderKanban },
      { title: "User Dashboard", titleAr: "لوحة المستخدم", url: "/user-dashboard", icon: Users },
      { title: "Software & Subscription", titleAr: "البرامج والاشتراكات", url: "/software-licenses", icon: Key },
      { title: "Reports", titleAr: "التقارير", url: "/reports", icon: FileBarChart },
      { title: "API Documentation", titleAr: "توثيق API", url: "/api-documentation", icon: FileText },
      { title: "Transactions", titleAr: "المعاملات", url: "/transactions", icon: Table2 },
      { title: "Pivot Table", titleAr: "الجدول المحوري", url: "/pivot-table", icon: Grid3x3 },
    ]
  },
  {
    label: "Entry",
    labelAr: "الإدخال",
    items: [
      { title: "Load Data", titleAr: "تحميل البيانات", url: "/load-data", icon: FileSpreadsheet },
      { title: "Upload Log", titleAr: "سجل التحميل", url: "/upload-log", icon: Database },
      { title: "Clear Data", titleAr: "مسح البيانات", url: "/clear-data", icon: Database },
      { title: "My Tickets", titleAr: "تذاكري", url: "/tickets", icon: FileText },
      { title: "Department Tickets", titleAr: "تذاكر القسم", url: "/admin-tickets", icon: Users },
      { title: "License Entry", titleAr: "إدخال الترخيص", url: "/software-license-setup", icon: Key },
      { title: "Shift Session", titleAr: "جلسة الوردية", url: "/shift-session", icon: Clock },
      { title: "My Shifts Calendar", titleAr: "تقويم وردياتي", url: "/my-shifts", icon: Calendar },
      { title: "Shift Follow-Up", titleAr: "متابعة الورديات", url: "/shift-follow-up", icon: BarChart3 },
      { title: "Missing Images", titleAr: "صور ناقصة", url: "/missing-shift-images", icon: ImageIcon },
      { title: "Shift Attendance Report", titleAr: "سجل حضور الورديات", url: "/shift-attendance-report", icon: ClipboardCheck },
      { title: "Tawasoul", titleAr: "تواصل", url: "/tawasoul", icon: MessageCircle },
      { title: "Asus Tawasoul", titleAr: "أسس تواصل", url: "/asus-tawasoul", icon: Users },
      { title: "Email Manager", titleAr: "مدير البريد", url: "/email-manager", icon: Mail },
      { title: "Projects & Tasks", titleAr: "المشاريع والمهام", url: "/projects-tasks", icon: FolderKanban },
    ]
  },
  {
    label: "Setup",
    labelAr: "الإعداد",
    items: [
      { title: "Reports Setup", titleAr: "إعداد التقارير", url: "/reports-setup", icon: Settings },
      { title: "Customer Setup", titleAr: "إعداد العملاء", url: "/customer-setup", icon: UserCheck },
      { title: "Customer Profile", titleAr: "ملف العميل", url: "/customer-profile", icon: Users },
      { title: "Customer Totals", titleAr: "إجمالي العملاء", url: "/customer-totals", icon: TrendingUp },
      { title: "Brand Setup", titleAr: "إعداد العلامات", url: "/brand-setup", icon: Settings },
      { title: "Brand Type", titleAr: "نوع العلامة", url: "/brand-type", icon: Settings },
      { title: "Product Setup", titleAr: "إعداد المنتجات", url: "/product-setup", icon: Database },
      { title: "Payment Method Setup", titleAr: "إعداد طرق الدفع", url: "/payment-method-setup", icon: CreditCard },
      { title: "Department Management", titleAr: "إدارة الأقسام", url: "/department-management", icon: Settings },
      { title: "Shift Setup", titleAr: "إعداد الورديات", url: "/shift-setup", icon: Clock },
      { title: "Shift Calendar", titleAr: "تقويم الورديات", url: "/shift-calendar", icon: BarChart3 },
      { title: "Currency Setup", titleAr: "إعداد العملات", url: "/currency-setup", icon: DollarSign },
      { title: "User Groups", titleAr: "مجموعات المستخدمين", url: "/user-group-setup", icon: Users },
      { title: "Supplier Setup", titleAr: "إعداد الموردين", url: "/supplier-setup", icon: Truck },
      { title: "Project Setup", titleAr: "إعداد المشاريع", url: "/project-setup", icon: FolderKanban },
      { title: "Task List", titleAr: "قائمة المهام", url: "/task-list", icon: ClipboardList },
    ]
  },
  {
    label: "HR Management",
    labelAr: "الموارد البشرية",
    items: [
      { title: "Employee Setup", titleAr: "إعداد الموظفين", url: "/employee-setup", icon: UserCircle },
      { title: "Employee Requests", titleAr: "طلبات الموظفين", url: "/employee-self-requests", icon: ClipboardList },
      { title: "Request Approvals", titleAr: "اعتماد الطلبات", url: "/employee-request-approvals", icon: ClipboardCheck },
      { title: "HR Manager Setup", titleAr: "إعداد مديري HR", url: "/hr-manager-setup", icon: Users },
      { title: "Vacation Setup", titleAr: "إعداد الإجازات", url: "/vacation-setup", icon: Palmtree },
      { title: "Timesheet Management", titleAr: "إدارة الحضور", url: "/timesheet-management", icon: ClipboardList },
      { title: "ZK Attendance Logs", titleAr: "سجلات حضور ZK", url: "/zk-attendance-logs", icon: Clock },
      { title: "Deduction Rules", titleAr: "قواعد الخصم", url: "/deduction-rules-setup", icon: Calculator },
      { title: "Medical Insurance", titleAr: "التأمين الطبي", url: "/medical-insurance-setup", icon: HeartPulse },
      { title: "Document Types", titleAr: "أنواع المستندات", url: "/document-type-setup", icon: FileText },
      { title: "Attendance Types", titleAr: "أنواع الحضور", url: "/attendance-type-setup", icon: Clock },
      { title: "Job Setup", titleAr: "إعداد الوظائف", url: "/job-setup", icon: Briefcase },
      { title: "Vacation Calendar", titleAr: "تقويم الإجازات", url: "/hr-vacation-calendar", icon: Palmtree },
      { title: "Company Hierarchy", titleAr: "الهيكل التنظيمي", url: "/company-hierarchy", icon: Building2 },
      { title: "Company News", titleAr: "أخبار الشركة", url: "/company-news", icon: FileText },
      { title: "Administrative Decisions", titleAr: "القرارات الإدارية", url: "/acknowledgment-documents", icon: ClipboardCheck },
    ]
  },
  {
    label: "Cash Management",
    labelAr: "إدارة النقدية",
    items: [
      { title: "Bank Setup", titleAr: "إعداد البنوك", url: "/bank-setup", icon: Building2 },
      { title: "Treasury Setup", titleAr: "إعداد الخزائن", url: "/treasury-setup", icon: DollarSign },
      { title: "Expense Categories", titleAr: "فئات المصروفات", url: "/expense-category-setup", icon: Settings },
      { title: "Expense Types", titleAr: "أنواع المصروفات", url: "/expense-type-setup", icon: Settings },
      { title: "Cost Centers", titleAr: "مراكز التكلفة", url: "/cost-center-setup", icon: Target },
      { title: "Treasury Opening Balance", titleAr: "رصيد الخزينة الافتتاحي", url: "/treasury-opening-balance", icon: DollarSign },
      { title: "Treasury Entry", titleAr: "قيد الخزينة", url: "/treasury-entry", icon: FileText },
      { title: "Bank Entry", titleAr: "قيد البنك", url: "/bank-entry", icon: FileText },
      { title: "Expense Entry", titleAr: "قيد المصروفات", url: "/expense-entry", icon: Receipt },
      { title: "Expense Requests", titleAr: "طلبات المصروفات", url: "/expense-requests", icon: ClipboardList },
      { title: "Void Payment", titleAr: "إلغاء الدفع", url: "/void-payment", icon: Undo2 },
      { title: "Payment Bank Link", titleAr: "ربط طرق الدفع بالبنوك", url: "/payment-bank-link", icon: Link2 },
    ]
  },
  {
    label: "Coins Transaction",
    labelAr: "معاملات العملات",
    items: [
      { title: "Coins Purchase Creation", titleAr: "إنشاء طلب شراء", url: "/coins-creation", icon: DollarSign },
      { title: "Sending Transfers", titleAr: "توجيه التحويلات", url: "/coins-sending", icon: DollarSign },
      { title: "Receiving Phase", titleAr: "استلام من المورد", url: "/coins-receiving-phase", icon: DollarSign },
      { title: "Receiving Coins", titleAr: "استلام العملات", url: "/receiving-coins", icon: DollarSign },
      { title: "Workflow Setup", titleAr: "إعداد سير العمل", url: "/coins-workflow-setup", icon: Settings },
    ]
  },
  {
    label: "Admin",
    labelAr: "الإدارة",
    items: [
      { title: "User Setup", titleAr: "إعداد المستخدمين", url: "/user-setup", icon: Users },
      { title: "Users Logins", titleAr: "بيانات تسجيل الدخول", url: "/user-logins", icon: KeyRound },
      { title: "Users & Mails", titleAr: "المستخدمين والبريد", url: "/user-emails", icon: Mail },
      { title: "Mail Setup", titleAr: "إعداد البريد", url: "/mail-setup", icon: Mail },
      { title: "System Configuration", titleAr: "إعدادات النظام", url: "/system-config", icon: Shield },
      { title: "API Integration Status", titleAr: "حالة تكامل API", url: "/api-integration-status", icon: Cloud },
      { title: "Closing Training", titleAr: "تدريب الإغلاق", url: "/closing-training", icon: GraduationCap },
      { title: "Odoo Setup", titleAr: "إعداد Odoo", url: "/odoo-setup", icon: Link2 },
      { title: "Excel Setup", titleAr: "إعداد Excel", url: "/excel-sheets", icon: FileSpreadsheet },
      { title: "Table Config", titleAr: "إعداد الجداول", url: "/table-generator", icon: Database },
      { title: "PDF to Excel", titleAr: "تحويل PDF إلى Excel", url: "/pdf-to-excel", icon: FileSpreadsheet },
      { title: "System Backup", titleAr: "نسخ احتياطي", url: "/system-backup", icon: HardDrive },
      { title: "System Restore", titleAr: "استعادة النظام", url: "/system-restore", icon: RotateCcw },
      { title: "Audit Logs", titleAr: "سجلات التدقيق", url: "/audit-logs", icon: ClipboardCheck },
      { title: "Certificate Management", titleAr: "إدارة الشهادات", url: "/certificate-management", icon: FileKey },
      { title: "Security Dashboard", titleAr: "لوحة الأمان", url: "/security-dashboard", icon: Shield },
      { title: "API Consumption Logs", titleAr: "سجلات استهلاك API", url: "/api-consumption-logs", icon: ScrollText },
      { title: "Update Bank Ledger", titleAr: "تحديث سجل البنك", url: "/update-bank-ledger", icon: Database },
    ]
  }
];

export function MainPageMenu() {
  const { language } = useLanguage();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserPermissions();
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

  return (
    <div className="space-y-8 p-4" dir={language === "ar" ? "rtl" : "ltr"}>
      {menuGroups.map((group) => {
        const accessibleItems = group.items.filter(item => hasAccess(item.url));
        
        if (accessibleItems.length === 0) return null;

        return (
          <div key={group.label} className="space-y-4">
            <h2 className="text-lg font-semibold text-primary border-b border-border pb-2">
              {language === "ar" ? group.labelAr : group.label}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {accessibleItems.map((item) => {
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
                      {language === "ar" ? item.titleAr : item.title}
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
