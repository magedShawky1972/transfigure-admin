import { 
  Database, 
  FileSpreadsheet, 
  Cloud, 
  BarChart3, 
  Table2,
  Home,
  Settings
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

const menuGroups = [
  {
    label: "Report & Dashboard",
    items: [
      { title: "Dashboard", url: "/", icon: Home },
      { title: "Reports", url: "/reports", icon: BarChart3 },
      { title: "Transaction Data", url: "/transactions", icon: Table2 },
    ]
  },
  {
    label: "Setup",
    items: []
  },
  {
    label: "Admin",
    items: [
      { title: "API Configuration", url: "/api-config", icon: Cloud },
      { title: "Excel Setup", url: "/excel-sheets", icon: FileSpreadsheet },
      { title: "Table Configuration", url: "/table-generator", icon: Database },
    ]
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/70 mb-2 px-3">
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
                          `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          }`
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
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
