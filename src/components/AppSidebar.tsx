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
  Key
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
    "/api-config": "apiConfig",
    "/excel-sheets": "excelSetup",
    "/table-generator": "tableConfig",
    "/odoo-setup": "odooSetup",
    "/software-license-setup": "softwareLicenseSetup",
  };

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
        .select("menu_item, has_access")
        .eq("user_id", user.id)
        .eq("has_access", true);

      if (error) throw error;

      const permissions = new Set(data?.map(p => p.menu_item) || []);
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
        { title: language === 'ar' ? "لوحة التراخيص" : "Software Licenses", url: "/software-licenses", icon: Key },
        { title: t("menu.reports"), url: "/reports", icon: FileBarChart },
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
      ]
    },
    {
      label: t("sidebar.admin"),
      items: [
        { title: t("menu.userSetup"), url: "/user-setup", icon: Users },
        { title: t("menu.apiConfig"), url: "/api-config", icon: Cloud },
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
