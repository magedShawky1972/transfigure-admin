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
  Mail
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

  const URL_TO_PERMISSION: Record<string, string> = {
    "/": "dashboard",
    "/dashboard": "dashboard",
    "/ticket-dashboard": "ticket_dashboard",
    "/shift-dashboard": "shift_dashboard",
    "/task-dashboard": "task_dashboard",
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
    "/company-hierarchy": "companyHierarchy",
    "/user-logins": "userLogins",
    "/supplier-setup": "supplierSetup",
    "/user-emails": "userEmails",
    "/asus-tawasoul": "asusTawasoul",
  };

  useEffect(() => {
    fetchUserPermissions();

    // Set up real-time subscription for permission changes
    const channel = supabase
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
          // Refetch permissions when any change occurs
          fetchUserPermissions();
        }
      )
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
        { title: language === 'ar' ? "تواصل" : "Tawasoul", url: "/tawasoul", icon: MessageCircle },
        { title: language === 'ar' ? "أسس تواصل" : "Asus Tawasoul", url: "/asus-tawasoul", icon: Users },
        { title: language === 'ar' ? "المشاريع والمهام" : "Projects & Tasks", url: "/projects-tasks", icon: FolderKanban },
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
        { title: language === 'ar' ? "إدارة الأقسام" : "Department Management", url: "/department-management", icon: Settings },
        { title: language === 'ar' ? 'إعداد الورديات' : 'Shift Setup', url: "/shift-setup", icon: Clock },
        { title: language === 'ar' ? 'تقويم الورديات' : 'Shift Calendar', url: "/shift-calendar", icon: BarChart3 },
        { title: language === 'ar' ? 'إعداد العملات' : 'Currency Setup', url: "/currency-setup", icon: DollarSign },
        { title: language === 'ar' ? 'مجموعات المستخدمين' : 'User Groups', url: "/user-group-setup", icon: Users },
        { title: language === 'ar' ? 'الهيكل التنظيمي' : 'Company Hierarchy', url: "/company-hierarchy", icon: Building2 },
        { title: language === 'ar' ? 'إعداد الموردين' : 'Supplier Setup', url: "/supplier-setup", icon: Truck },
      ]
    },
    {
      label: t("sidebar.admin"),
      items: [
        { title: t("menu.userSetup"), url: "/user-setup", icon: Users },
        { title: language === 'ar' ? 'بيانات تسجيل الدخول' : 'Users Logins', url: "/user-logins", icon: KeyRound },
        { title: language === 'ar' ? 'المستخدمين والبريد' : 'Users & Mails', url: "/user-emails", icon: Mail },
        { title: language === 'ar' ? 'إعدادات النظام' : 'System Configuration', url: "/system-config", icon: Shield },
        { title: language === 'ar' ? 'تدريب الإغلاق' : 'Closing Training', url: "/closing-training", icon: GraduationCap },
        { title: language === 'ar' ? 'إعداد Odoo' : 'Odoo Setup', url: "/odoo-setup", icon: Link2 },
        { title: t("menu.excelSetup"), url: "/excel-sheets", icon: FileSpreadsheet },
        { title: t("menu.tableConfig"), url: "/table-generator", icon: Database },
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
