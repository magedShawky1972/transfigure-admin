import { 
  Database, 
  FileSpreadsheet, 
  Cloud, 
  BarChart3, 
  Table2,
  LayoutDashboard,
  Settings,
  Users,
  UserCheck,
  TrendingUp,
  Grid3x3,
  CreditCard,
  Link2,
  FileText,
  TicketCheck,
  FileBarChart,
  Key,
  Shield,
  Clock,
  MessageCircle,
  Calendar,
  GraduationCap,
  DollarSign,
  Gamepad2,
  FolderKanban,
  Building2,
  KeyRound,
  Truck,
  Mail,
  HardDrive,
  RotateCcw,
  UserCircle,
  Palmtree,
  ClipboardList,
  Calculator,
  HeartPulse,
  CalendarClock,
  ClipboardCheck,
  FileKey,
  Briefcase,
  Receipt,
  ScrollText,
  Target,
  Undo2,
  Coins,
  ImageIcon
} from "lucide-react";
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, language } = useLanguage();
  const [userPermissions, setUserPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [asusTawasoulUnread, setAsusTawasoulUnread] = useState(0);

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
    "/cost-center-setup": "costCenterSetup",
    "/void-payment": "voidPayment",
    "/receiving-coins": "receivingCoins",
    "/coins-creation": "coinsCreation",
    "/coins-sending": "coinsSending",
    "/coins-receiving-phase": "coinsReceivingPhase",
    "/coins-workflow-setup": "coinsWorkflowSetup",
    "/coins-purchase-followup": "coinsPurchaseFollowUp",
    "/missing-shift-images": "missingShiftImages",
    "/employee-self-requests": "employeeRequests",
    "/employee-request-approvals": "employeeRequestApprovals",
    "/hr-manager-setup": "hrManagerSetup",
    "/acknowledgment-documents": "acknowledgmentDocuments",
    "/sales-order-entry": "salesOrderEntry",
  };

  useEffect(() => {
    fetchUserPermissions();
    fetchAsusTawasoulUnread();

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

  const menuGroups = [
    {
      label: t("sidebar.reports"),
      items: [
        { title: t("menu.dashboard"), url: "/dashboard", icon: LayoutDashboard },
        { title: language === 'ar' ? "لوحة التذاكر" : "Ticket Dashboard", url: "/ticket-dashboard", icon: TicketCheck },
        { title: language === 'ar' ? "لوحة الورديات" : "Shift Dashboard", url: "/shift-dashboard", icon: Clock },
        { title: language === 'ar' ? "لوحة المهام" : "Task Dashboard", url: "/task-dashboard", icon: FolderKanban },
        { title: language === 'ar' ? "لوحة الموظف" : "Employee Dashboard", url: "/user-dashboard", icon: Users },
        { title: language === 'ar' ? "البرامج والاشتراكات" : "Software & Subscription", url: "/software-licenses", icon: Key },
        { title: t("menu.reports"), url: "/reports", icon: FileBarChart },
        { title: language === 'ar' ? "توثيق API" : "API Documentation", url: "/api-documentation", icon: FileText },
        { title: t("menu.transactions"), url: "/transactions", icon: Table2 },
        { title: t("menu.pivotTable"), url: "/pivot-table", icon: Grid3x3 },
      ]
    },
    {
      label: t("sidebar.entry"),
      items: [
        { title: t("menu.loadData"), url: "/load-data", icon: FileSpreadsheet },
        { title: t("uploadLog.title"), url: "/upload-log", icon: Database },
        { title: t("menu.clearData"), url: "/clear-data", icon: Database },
        { title: language === 'ar' ? "تذاكري" : "My Tickets", url: "/tickets", icon: FileText },
        { title: language === 'ar' ? "تذاكر القسم" : "Department Tickets", url: "/admin-tickets", icon: Users },
        { title: language === 'ar' ? "إدخال الترخيص" : "License Entry", url: "/software-license-setup", icon: Key },
        { title: language === 'ar' ? "جلسة الوردية" : "Shift Session", url: "/shift-session", icon: Clock },
        { title: language === 'ar' ? "تقويم وردياتي" : "My Shifts Calendar", url: "/my-shifts", icon: Calendar },
        { title: language === 'ar' ? "متابعة الورديات" : "Shift Follow-Up", url: "/shift-follow-up", icon: BarChart3 },
        { title: language === 'ar' ? "صور ناقصة" : "Missing Images", url: "/missing-shift-images", icon: ImageIcon },
        { title: language === 'ar' ? "سجل حضور الورديات" : "Shift Attendance Report", url: "/shift-attendance-report", icon: ClipboardCheck },
        { title: language === 'ar' ? "تواصل" : "Tawasoul", url: "/tawasoul", icon: MessageCircle },
        { title: language === 'ar' ? "أسس تواصل" : "Asus Tawasoul", url: "/asus-tawasoul", icon: Users },
        { title: language === 'ar' ? "مدير البريد" : "Email Manager", url: "/email-manager", icon: Mail },
        { title: language === 'ar' ? "المشاريع والمهام" : "Projects & Tasks", url: "/projects-tasks", icon: FolderKanban },
        { title: language === 'ar' ? "إدخال أمر البيع" : "Sales Order Entry", url: "/sales-order-entry", icon: Receipt },
      ]
    },
    {
      label: t("sidebar.setup"),
      items: [
        { title: t("menu.reportsSetup"), url: "/reports-setup", icon: Settings },
        { title: t("menu.customerSetup"), url: "/customer-setup", icon: UserCheck },
        { title: t("menu.customerProfile"), url: "/customer-profile", icon: Users },
        { title: t("menu.customerTotals"), url: "/customer-totals", icon: TrendingUp },
        { title: t("menu.brandSetup"), url: "/brand-setup", icon: Settings },
        { title: t("menu.brandType"), url: "/brand-type", icon: Settings },
        { title: t("menu.productSetup"), url: "/product-setup", icon: Database },
        { title: language === 'ar' ? 'إعداد طرق الدفع' : 'Payment Method Setup', url: "/payment-method-setup", icon: CreditCard },
        { title: language === 'ar' ? 'إعداد الورديات' : 'Shift Setup', url: "/shift-setup", icon: Clock },
        { title: language === 'ar' ? 'تقويم الورديات' : 'Shift Calendar', url: "/shift-calendar", icon: BarChart3 },
        { title: language === 'ar' ? 'إعداد العملات' : 'Currency Setup', url: "/currency-setup", icon: DollarSign },
        { title: language === 'ar' ? 'مجموعات المستخدمين' : 'User Groups', url: "/user-group-setup", icon: Users },
        { title: language === 'ar' ? 'إعداد المشاريع' : 'Project Setup', url: "/project-setup", icon: FolderKanban },
        { title: language === 'ar' ? "قائمة المهام" : "Task List", url: "/task-list", icon: ClipboardList },
      ]
    },
    {
      label: language === 'ar' ? 'الموارد البشرية' : 'HR Management',
      items: [
        { title: language === 'ar' ? 'إعداد الموظفين' : 'Employee Setup', url: "/employee-setup", icon: UserCircle },
        { title: language === 'ar' ? 'طلبات الموظفين' : 'Employee Requests', url: "/employee-self-requests", icon: ClipboardList },
        { title: language === 'ar' ? 'اعتماد الطلبات' : 'Request Approvals', url: "/employee-request-approvals", icon: ClipboardCheck },
        { title: language === 'ar' ? 'إعداد مديري HR' : 'HR Manager Setup', url: "/hr-manager-setup", icon: Users },
        { title: language === 'ar' ? 'إعداد الإجازات' : 'Vacation Setup', url: "/vacation-setup", icon: Palmtree },
        { title: language === 'ar' ? 'إدارة الحضور' : 'Timesheet Management', url: "/timesheet-management", icon: ClipboardList },
        { title: language === 'ar' ? 'سجلات حضور ZK' : 'ZK Attendance Logs', url: "/zk-attendance-logs", icon: Clock },
        { title: language === 'ar' ? 'قواعد الخصم' : 'Deduction Rules', url: "/deduction-rules-setup", icon: Calculator },
        { title: language === 'ar' ? 'التأمين الطبي' : 'Medical Insurance', url: "/medical-insurance-setup", icon: HeartPulse },
        { title: language === 'ar' ? 'أنواع المستندات' : 'Document Types', url: "/document-type-setup", icon: FileText },
        { title: language === 'ar' ? 'أنواع الحضور' : 'Attendance Types', url: "/attendance-type-setup", icon: Clock },
        { title: language === 'ar' ? 'إعداد الوظائف' : 'Job Setup', url: "/job-setup", icon: Briefcase },
        { title: language === 'ar' ? 'تقويم الإجازات' : 'Vacation Calendar', url: "/hr-vacation-calendar", icon: Palmtree },
        { title: language === 'ar' ? 'الهيكل التنظيمي' : 'Company Hierarchy', url: "/company-hierarchy", icon: Building2 },
        { title: language === 'ar' ? "أخبار الشركة" : "Company News", url: "/company-news", icon: FileText },
        { title: language === 'ar' ? "إدارة الأقسام" : "Department Management", url: "/department-management", icon: Settings },
        { title: language === 'ar' ? "القرارات الإدارية" : "Administrative Decisions", url: "/acknowledgment-documents", icon: ClipboardCheck },
      ]
    },
    {
      label: language === 'ar' ? 'إدارة النقدية' : 'Cash Management',
      items: [
        { title: language === 'ar' ? 'إعداد البنوك' : 'Bank Setup', url: "/bank-setup", icon: Building2 },
        { title: language === 'ar' ? 'إعداد الخزائن' : 'Treasury Setup', url: "/treasury-setup", icon: DollarSign },
        { title: language === 'ar' ? 'فئات المصروفات' : 'Expense Categories', url: "/expense-category-setup", icon: Settings },
        { title: language === 'ar' ? 'أنواع المصروفات' : 'Expense Types', url: "/expense-type-setup", icon: Settings },
        { title: language === 'ar' ? 'مراكز التكلفة' : 'Cost Centers', url: "/cost-center-setup", icon: Target },
        { title: language === 'ar' ? 'رصيد الخزينة الافتتاحي' : 'Treasury Opening Balance', url: "/treasury-opening-balance", icon: DollarSign },
        { title: language === 'ar' ? 'قيد الخزينة' : 'Treasury Entry', url: "/treasury-entry", icon: FileText },
        { title: language === 'ar' ? 'قيد البنك' : 'Bank Entry', url: "/bank-entry", icon: FileText },
        { title: language === 'ar' ? 'قيد المصروفات' : 'Expense Entry', url: "/expense-entry", icon: Receipt },
        { title: language === 'ar' ? 'طلبات المصروفات' : 'Expense Requests', url: "/expense-requests", icon: ClipboardList },
        { title: language === 'ar' ? 'إلغاء الدفع' : 'Void Payment', url: "/void-payment", icon: Undo2 },
        { title: language === 'ar' ? 'ربط طرق الدفع بالبنوك' : 'Payment Bank Link', url: "/payment-bank-link", icon: Link2 },
      ]
    },
    {
      label: language === 'ar' ? 'معاملات العملات' : 'Coins Transaction',
      items: [
        { title: language === 'ar' ? 'إنشاء طلب شراء' : 'Coins Purchase Creation', url: "/coins-creation", icon: FileText },
        { title: language === 'ar' ? 'توجيه التحويلات' : 'Sending Transfers', url: "/coins-sending", icon: Mail },
        { title: language === 'ar' ? 'استلام من المورد' : 'Receiving Phase', url: "/coins-receiving-phase", icon: ClipboardCheck },
        { title: language === 'ar' ? 'استلام العملات' : 'Receiving Coins', url: "/receiving-coins", icon: Coins },
        { title: language === 'ar' ? 'إعداد سير العمل' : 'Workflow Setup', url: "/coins-workflow-setup", icon: Settings },
        { title: language === 'ar' ? 'متابعة شراء العملات' : 'Purchase Follow-Up', url: "/coins-purchase-followup", icon: ClipboardCheck },
        { title: language === 'ar' ? 'إعداد الموردين' : 'Supplier Setup', url: "/supplier-setup", icon: Truck },
      ]
    },
    {
      label: t("sidebar.admin"),
      items: [
        { title: t("menu.userSetup"), url: "/user-setup", icon: Users },
        { title: language === 'ar' ? 'بيانات تسجيل الدخول' : 'Users Logins', url: "/user-logins", icon: KeyRound },
        { title: language === 'ar' ? 'المستخدمين والبريد' : 'Users & Mails', url: "/user-emails", icon: Mail },
        { title: language === 'ar' ? 'إعداد البريد' : 'Mail Setup', url: "/mail-setup", icon: Mail },
        { title: language === 'ar' ? 'إعدادات النظام' : 'System Configuration', url: "/system-config", icon: Shield },
        { title: language === 'ar' ? 'حالة تكامل API' : 'API Integration Status', url: "/api-integration-status", icon: Cloud },
        { title: language === 'ar' ? 'تدريب الإغلاق' : 'Closing Training', url: "/closing-training", icon: GraduationCap },
        { title: language === 'ar' ? 'إعداد Odoo' : 'Odoo Setup', url: "/odoo-setup", icon: Link2 },
        { title: t("menu.excelSetup"), url: "/excel-sheets", icon: FileSpreadsheet },
        { title: t("menu.tableConfig"), url: "/table-generator", icon: Database },
        { title: language === 'ar' ? 'تحويل PDF إلى Excel' : 'PDF to Excel', url: "/pdf-to-excel", icon: FileSpreadsheet },
        { title: language === 'ar' ? 'نسخ احتياطي' : 'System Backup', url: "/system-backup", icon: HardDrive },
        { title: language === 'ar' ? 'استعادة النظام' : 'System Restore', url: "/system-restore", icon: RotateCcw },
        { title: language === 'ar' ? 'سجلات التدقيق' : 'Audit Logs', url: "/audit-logs", icon: ClipboardCheck },
        { title: language === 'ar' ? 'إدارة الشهادات' : 'Certificate Management', url: "/certificate-management", icon: FileKey },
        { title: language === 'ar' ? 'لوحة الأمان' : 'Security Dashboard', url: "/security-dashboard", icon: Shield },
        { title: language === 'ar' ? 'سجلات استهلاك API' : 'API Consumption Logs', url: "/api-consumption-logs", icon: ScrollText },
        { title: language === 'ar' ? 'تحديث سجل البنك' : 'Update Bank Ledger', url: "/update-bank-ledger", icon: Database },
      ]
    }
  ];

  if (loading) {
    return null;
  }

  return (
    <Sidebar
      side={language === "ar" ? "right" : "left"}
      className={`${language === "ar" ? "border-l" : "border-r"} border-sidebar-border bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] min-w-56`}
    >
      <SidebarContent>
        {menuGroups.map((group) => {
          const filteredItems = group.items.filter(item => hasAccess(item.url));
          
          if (filteredItems.length === 0) return null;
          
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-sidebar-foreground/70 mb-2 px-3 text-sm font-semibold">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
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
