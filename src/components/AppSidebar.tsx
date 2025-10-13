import { 
  Database, 
  FileSpreadsheet, 
  Cloud, 
  BarChart3, 
  Table2,
  Home,
  Settings,
  Users,
  UserCheck
} from "lucide-react";
import { NavLink } from "react-router-dom";
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, language } = useLanguage();

  const menuGroups = [
    {
      label: t("sidebar.reports"),
      items: [
        { title: t("menu.dashboard"), url: "/", icon: Home },
        { title: t("menu.reports"), url: "/reports", icon: BarChart3 },
        { title: t("menu.transactions"), url: "/transactions", icon: Table2 },
      ]
    },
    {
      label: t("sidebar.entry"),
      items: [
        { title: t("menu.loadData"), url: "/load-data", icon: FileSpreadsheet },
        { title: t("uploadLog.title"), url: "/upload-log", icon: Database },
        { title: t("menu.clearData"), url: "/clear-data", icon: Database },
      ]
    },
    {
      label: t("sidebar.setup"),
      items: [
        { title: t("menu.reportsSetup"), url: "/reports-setup", icon: Settings },
        { title: t("customerSetup.title"), url: "/customer-setup", icon: UserCheck },
      ]
    },
    {
      label: t("sidebar.admin"),
      items: [
        { title: t("menu.userSetup"), url: "/user-setup", icon: Users },
        { title: t("menu.apiConfig"), url: "/api-config", icon: Cloud },
        { title: t("menu.excelSetup"), url: "/excel-sheets", icon: FileSpreadsheet },
        { title: t("menu.tableConfig"), url: "/table-generator", icon: Database },
      ]
    }
  ];

  return (
    <Sidebar
      side={language === "ar" ? "right" : "left"}
      className={`${language === "ar" ? "border-l" : "border-r"} border-sidebar-border bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] min-w-56`}
    >
      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/70 mb-2 px-3 text-sm font-semibold">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
