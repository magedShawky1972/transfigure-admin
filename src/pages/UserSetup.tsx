import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Shield, KeyRound, Search, Filter, Check, ChevronsUpDown } from "lucide-react";
import AvatarSelector from "@/components/AvatarSelector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  mobile_number: string | null;
  is_active: boolean;
  is_admin?: boolean;
  job_position_id?: string | null;
  job_position_name?: string | null;
  default_department_id?: string | null;
  default_department_name?: string | null;
  avatar_url?: string | null;
}

interface JobPosition {
  id: string;
  position_name: string;
  is_active: boolean;
}

interface Department {
  id: string;
  department_name: string;
}

interface UserPermission {
  id: string;
  user_id: string;
  menu_item: string;
  has_access: boolean;
  parent_menu: string | null;
}

  const MENU_ITEMS = [
    { key: "dashboard", label: "Dashboard" },
    { key: "ticket_dashboard", label: "Ticket Dashboard" },
    { key: "shift_dashboard", label: "Shift Dashboard" },
    { key: "task_dashboard", label: "Task Dashboard" },
    { key: "api_documentation", label: "API Documentation" },
    { key: "softwareLicenses", label: "Software Licenses" },
    { key: "reports", label: "Reports" },
  { key: "transactions", label: "Transactions" },
  { key: "pivotTable", label: "Pivot Table" },
  { key: "loadData", label: "Load Data" },
  { key: "uploadLog", label: "Upload Log" },
  { key: "clearData", label: "Clear Data" },
  { key: "tickets", label: "My Tickets" },
  { key: "admin_tickets", label: "Department Tickets" },
  { key: "softwareLicenseSetup", label: "License Entry" },
  { key: "shiftSession", label: "Shift Session" },
  { key: "myShifts", label: "My Shifts Calendar" },
  { key: "shiftFollowUp", label: "Shift Follow-Up" },
  { key: "tawasoul", label: "Tawasoul (تواصل)" },
  { key: "reportsSetup", label: "Reports Setup" },
  { key: "customerSetup", label: "Customer Setup" },
  { key: "customerProfile", label: "Customer Profile" },
  { key: "customerTotals", label: "Customer Totals" },
  { key: "brandSetup", label: "Brand Setup" },
  { key: "brandType", label: "Brand Type" },
  { key: "productSetup", label: "Product Setup" },
  { key: "paymentMethodSetup", label: "Payment Method Setup" },
  { key: "department_management", label: "Department Management" },
  { key: "userSetup", label: "User Setup" },
  { key: "shiftSetup", label: "Shift Setup" },
  { key: "shiftCalendar", label: "Shift Calendar" },
  { key: "currencySetup", label: "Currency Setup" },
  { key: "userGroupSetup", label: "User Groups" },
  { key: "projectsTasks", label: "Projects & Tasks" },
  { key: "companyHierarchy", label: "Company Hierarchy" },
  { key: "supplierSetup", label: "Supplier Setup" },
  { key: "userLogins", label: "Users Logins" },
  { key: "userEmails", label: "Users & Mails" },
  { key: "asusTawasoul", label: "Asus Tawasoul" },
  { key: "systemConfig", label: "System Configuration" },
  { key: "closingTraining", label: "Closing Training" },
  { key: "odooSetup", label: "Odoo Setup" },
  { key: "excelSetup", label: "Excel Setup" },
  { key: "tableConfig", label: "Table Config" },
];

const DASHBOARD_COMPONENTS = [
  { key: "sales_metrics", label: "Sales Metrics" },
  { key: "total_profit", label: "Total Profit" },
  { key: "points_sales", label: "Points Sales" },
  { key: "transaction_count", label: "Transaction Count" },
  { key: "new_customers", label: "New Customers" },
  { key: "avg_order_metrics", label: "Average Order Value" },
  { key: "income_statement", label: "Income Statement" },
  { key: "transaction_type_chart", label: "Transaction Type Chart" },
  { key: "user_transaction_count_chart", label: "User Transaction Count Chart" },
  { key: "user_transaction_value_chart", label: "User Transaction Value Chart" },
  { key: "brand_sales_grid", label: "Brand Sales Grid" },
  { key: "coins_by_brand", label: "Coins by Brand" },
  { key: "sales_trend_chart", label: "Sales Trend Chart" },
  { key: "top_brands_chart", label: "Top Brands Chart" },
  { key: "top_products_chart", label: "Top Products Chart" },
  { key: "month_comparison_chart", label: "Month Comparison Chart" },
  { key: "payment_methods_chart", label: "Payment Methods Chart" },
  { key: "payment_brands_chart", label: "Payment Brands Chart" },
  { key: "unused_payment_brands", label: "Unused Payment Brands" },
  { key: "product_summary_table", label: "Product Summary Table" },
  { key: "customer_purchases_table", label: "Customer Purchases Table" },
  { key: "inactive_customers_section", label: "Inactive Customers Section" },
  { key: "recent_transactions", label: "Recent Transactions" },
];

const REPORTS = [
  { key: "revenue-by-brand-type", label: "Revenue by Brand Type" },
  { key: "cost-by-brand-type", label: "Cost by Brand Type" },
  { key: "tickets", label: "Tickets Report" },
  { key: "software-licenses", label: "Software Licenses Report" },
  { key: "shift-report", label: "Shift Report" },
  { key: "shift-plan", label: "Shift Plan Report" },
  { key: "brand-balance", label: "Brand Balance Report" },
  { key: "api-documentation", label: "API Documentation" },
  { key: "transaction-statistics", label: "Transaction Statistics" },
];

const UserSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [dashboardPermissionsDialogOpen, setDashboardPermissionsDialogOpen] = useState(false);
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, boolean>>({});
  const [reportsPermissionsDialogOpen, setReportsPermissionsDialogOpen] = useState(false);
  const [reportsPermissions, setReportsPermissions] = useState<Record<string, boolean>>({});
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [canViewPasswords, setCanViewPasswords] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    searchTerm: "",
    statusFilter: "all", // all, active, inactive
    roleFilter: "all", // all, admin, user
  });
  
  const [formData, setFormData] = useState({
    user_name: "",
    email: "",
    mobile_number: "",
    is_active: true,
    is_admin: false,
    job_position_id: null as string | null,
    default_department_id: null as string | null,
    avatar_url: null as string | null,
  });

  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [jobPositionOpen, setJobPositionOpen] = useState(false);
  const [newJobPosition, setNewJobPosition] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetchProfiles();
    checkCurrentUserAdmin();
    fetchJobPositions();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name")
        .eq("is_active", true)
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchJobPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("is_active", true)
        .order("position_name");

      if (error) throw error;
      setJobPositions(data || []);
    } catch (error: any) {
      console.error("Error fetching job positions:", error);
    }
  };

  const handleAddNewJobPosition = async () => {
    if (!newJobPosition.trim()) return;

    try {
      const { data, error } = await supabase
        .from("job_positions")
        .insert({ position_name: newJobPosition.trim() })
        .select()
        .single();

      if (error) throw error;

      setJobPositions([...jobPositions, data]);
      setFormData({ ...formData, job_position_id: data.id });
      setNewJobPosition("");
      setJobPositionOpen(false);

      toast({
        title: t("common.success"),
        description: "Job position added successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const checkCurrentUserAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsCurrentUserAdmin(!!roleData);
      
      // Only ماجد شوقي can view passwords
      const MAGED_USER_ID = "4e38e7e3-6e16-4fea-97ea-24e588a76695";
      setCanViewPasswords(user.id === MAGED_USER_ID);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      // Fetch profiles with job positions and departments
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          *,
          job_position:job_positions(position_name),
          default_department:departments(department_name)
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Create a map of user_id to admin status
      const adminMap = new Map();
      rolesData?.forEach((role) => {
        if (role.role === 'admin') {
          adminMap.set(role.user_id, true);
        }
      });

      // Combine the data
      const profilesWithAdmin = (profilesData || []).map((profile: any) => ({
        ...profile,
        is_admin: adminMap.get(profile.user_id) || false,
        job_position_name: profile.job_position?.position_name || null,
        default_department_name: profile.default_department?.department_name || null,
      }));
      
      setProfiles(profilesWithAdmin);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProfile) {
        const { error } = await supabase
          .from("profiles")
          .update({
            user_name: formData.user_name,
            email: formData.email,
            mobile_number: formData.mobile_number || null,
            is_active: formData.is_active,
            job_position_id: formData.job_position_id,
            default_department_id: formData.default_department_id,
            avatar_url: formData.avatar_url,
          })
          .eq("id", editingProfile.id);

        if (error) throw error;

        // Handle admin role
        if (formData.is_admin) {
          // Add admin role
          await supabase
            .from("user_roles")
            .upsert({
              user_id: editingProfile.user_id,
              role: "admin",
            }, {
              onConflict: "user_id,role"
            });
        } else {
          // Remove admin role
          await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", editingProfile.user_id)
            .eq("role", "admin");
        }

        toast({
          title: t("common.success"),
          description: "User updated successfully",
        });
      } else {
        // For new users, use edge function to bypass rate limiting
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              user_name: formData.user_name,
              email: formData.email,
              mobile_number: formData.mobile_number || null,
              is_active: formData.is_active,
              job_position_id: formData.job_position_id,
            }),
          }
        );

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Failed to create user");
        }

        toast({
          title: t("common.success"),
          description: "User created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      user_name: profile.user_name,
      email: profile.email,
      mobile_number: profile.mobile_number || "",
      is_active: profile.is_active,
      is_admin: profile.is_admin || false,
      job_position_id: profile.job_position_id || null,
      default_department_id: profile.default_department_id || null,
      avatar_url: profile.avatar_url || null,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: t("common.success"),
        description: "User deleted successfully",
      });
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (profile: Profile) => {
    if (!confirm(`Are you sure you want to reset password to default (123456) for ${profile.user_name}?`)) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: {
          email: profile.email,
        },
      });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: `Password reset to 123456 for ${profile.user_name}`,
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (profile: Profile) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !profile.is_active })
        .eq("id", profile.id);

      if (error) throw error;
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      user_name: "",
      email: "",
      mobile_number: "",
      is_active: true,
      is_admin: false,
      job_position_id: null,
      default_department_id: null,
      avatar_url: null,
    });
    setEditingProfile(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const handleSecurityClick = async (profile: Profile) => {
    setSelectedUser(profile);
    setLoadingPermissions(true);
    setSecurityDialogOpen(true);
    
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", profile.user_id)
        .is("parent_menu", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const permissionsMap: Record<string, boolean> = {};
      MENU_ITEMS.forEach(item => {
        // Get the most recent permission entry for each menu item
        const permissions = data?.filter(p => p.menu_item === item.key);
        const latestPermission = permissions && permissions.length > 0 ? permissions[0] : null;
        permissionsMap[item.key] = latestPermission?.has_access ?? false;
      });
      
      setUserPermissions(permissionsMap);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handlePermissionToggle = async (menuItem: string, hasAccess: boolean) => {
    if (!selectedUser) return;

    try {
      console.log("Toggling permission:", { menuItem, hasAccess, userId: selectedUser.user_id });
      
      // Check current auth status
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session:", session?.user?.id);
      
      const { data, error } = await supabase
        .from("user_permissions")
        .upsert({
          user_id: selectedUser.user_id,
          menu_item: menuItem,
          has_access: hasAccess,
          parent_menu: null,
        }, {
          onConflict: "user_id,menu_item,parent_menu"
        })
        .select();

      console.log("Upsert result:", { data, error });
      
      if (error) throw error;

      setUserPermissions(prev => ({
        ...prev,
        [menuItem]: hasAccess,
      }));

      toast({
        title: t("common.success"),
        description: "Permission updated successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDashboardClick = async () => {
    if (!selectedUser) return;
    
    setLoadingPermissions(true);
    setDashboardPermissionsDialogOpen(true);
    
    try {
      // @ts-ignore - Supabase type recursion issue
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", selectedUser.user_id)
        .eq("parent_menu", "dashboard")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const permissionsMap: Record<string, boolean> = {};
      DASHBOARD_COMPONENTS.forEach(component => {
        // Get the most recent permission entry for each component
        const permissions = data?.filter(p => p.menu_item === component.key);
        const latestPermission = permissions && permissions.length > 0 ? permissions[0] : null;
        permissionsMap[component.key] = latestPermission?.has_access ?? true;
      });
      
      setDashboardPermissions(permissionsMap);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleDashboardPermissionToggle = async (componentKey: string, hasAccess: boolean) => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("user_permissions")
        .upsert({
          user_id: selectedUser.user_id,
          menu_item: componentKey,
          parent_menu: "dashboard",
          has_access: hasAccess,
        }, {
          onConflict: "user_id,menu_item,parent_menu"
        });

      if (error) throw error;

      setDashboardPermissions(prev => ({
        ...prev,
        [componentKey]: hasAccess,
      }));

      toast({
        title: t("common.success"),
        description: "Dashboard permission updated successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReportsClick = async () => {
    if (!selectedUser) return;
    
    setLoadingPermissions(true);
    setReportsPermissionsDialogOpen(true);
    
    try {
      // @ts-ignore - Supabase type recursion issue
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", selectedUser.user_id)
        .eq("parent_menu", "Reports")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const permissionsMap: Record<string, boolean> = {};
      REPORTS.forEach(report => {
        // Get the most recent permission entry for each report
        const permissions = data?.filter(p => p.menu_item === report.key);
        const latestPermission = permissions && permissions.length > 0 ? permissions[0] : null;
        permissionsMap[report.key] = latestPermission?.has_access ?? true;
      });
      
      setReportsPermissions(permissionsMap);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleReportsPermissionToggle = async (reportKey: string, hasAccess: boolean) => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from("user_permissions")
        .upsert({
          user_id: selectedUser.user_id,
          menu_item: reportKey,
          parent_menu: "Reports",
          has_access: hasAccess,
        }, {
          onConflict: "user_id,menu_item,parent_menu"
        });

      if (error) throw error;

      setReportsPermissions(prev => ({
        ...prev,
        [reportKey]: hasAccess,
      }));

      toast({
        title: t("common.success"),
        description: "Report permission updated successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Filter profiles based on search and filters
  const filteredProfiles = profiles.filter((profile) => {
    // Search term filter - search across all fields
    const searchLower = filters.searchTerm.toLowerCase();
    const matchesSearch = !searchLower || 
      profile.user_name.toLowerCase().includes(searchLower) ||
      profile.email.toLowerCase().includes(searchLower) ||
      (profile.mobile_number?.toLowerCase().includes(searchLower)) ||
      (profile.job_position_name?.toLowerCase().includes(searchLower)) ||
      (profile.default_department_name?.toLowerCase().includes(searchLower)) ||
      (profile.is_admin && 'admin'.includes(searchLower)) ||
      (profile.is_active ? 'active'.includes(searchLower) : 'inactive'.includes(searchLower));

    // Status filter
    const matchesStatus = 
      filters.statusFilter === "all" ||
      (filters.statusFilter === "active" && profile.is_active) ||
      (filters.statusFilter === "inactive" && !profile.is_active);

    // Role filter
    const matchesRole = 
      filters.roleFilter === "all" ||
      (filters.roleFilter === "admin" && profile.is_admin) ||
      (filters.roleFilter === "user" && !profile.is_admin);

    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">User Setup</h1>
        <div className="flex gap-2 items-center">
          {/* Main Search Box */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Hide Filters" : "Filters"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? "Edit User" : "Add New User"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {editingProfile && (
                <AvatarSelector
                  currentAvatar={formData.avatar_url}
                  onAvatarChange={(url) => setFormData({ ...formData, avatar_url: url })}
                  userName={formData.user_name}
                />
              )}
              <div className="space-y-2">
                <Label htmlFor="user_name">User Name</Label>
                <Input
                  id="user_name"
                  value={formData.user_name}
                  onChange={(e) =>
                    setFormData({ ...formData, user_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  disabled={!!editingProfile}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile_number">Mobile Number</Label>
                <Input
                  id="mobile_number"
                  value={formData.mobile_number}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile_number: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label>Job Position</Label>
                <Popover open={jobPositionOpen} onOpenChange={setJobPositionOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={jobPositionOpen}
                      className="w-full justify-between"
                    >
                      {formData.job_position_id
                        ? jobPositions.find((pos) => pos.id === formData.job_position_id)?.position_name
                        : "Select job position..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Search or type new position..." 
                        value={newJobPosition}
                        onValueChange={setNewJobPosition}
                      />
                      <CommandGroup>
                        {jobPositions
                          .filter((position) => 
                            position.position_name.toLowerCase().includes(newJobPosition.toLowerCase())
                          )
                          .map((position) => (
                            <CommandItem
                              key={position.id}
                              value={position.position_name}
                              onSelect={() => {
                                setFormData({ ...formData, job_position_id: position.id });
                                setJobPositionOpen(false);
                                setNewJobPosition("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.job_position_id === position.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {position.position_name}
                            </CommandItem>
                          ))}
                        {newJobPosition && 
                          !jobPositions.some((pos) => pos.position_name.toLowerCase() === newJobPosition.toLowerCase()) && (
                          <CommandItem
                            value={newJobPosition}
                            onSelect={handleAddNewJobPosition}
                            className="bg-primary/10"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add "{newJobPosition}"
                          </CommandItem>
                        )}
                      </CommandGroup>
                      {jobPositions.length === 0 && !newJobPosition && (
                        <CommandEmpty>No job positions found.</CommandEmpty>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Default Department</Label>
                <Select
                  value={formData.default_department_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_department_id: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Default Department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.department_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              {editingProfile && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_admin"
                    checked={formData.is_admin}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_admin: checked })
                    }
                  />
                  <Label htmlFor="is_admin">Admin Access</Label>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : editingProfile ? "Update User" : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-lg font-semibold">Advanced Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or mobile..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={filters.statusFilter}
                onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value })}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={filters.roleFilter}
                onChange={(e) => setFilters({ ...filters, roleFilter: e.target.value })}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin Only</option>
                <option value="user">User Only</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredProfiles.length} of {profiles.length} users
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ searchTerm: "", statusFilter: "all", roleFilter: "all" })}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProfiles.map((profile) => (
          <div 
            key={profile.id} 
            className={cn(
              "rounded-xl border bg-card p-4 flex flex-col items-center gap-3 transition-all hover:shadow-lg hover:border-primary/30",
              !profile.is_active && "opacity-60"
            )}
          >
            {/* Avatar */}
            <Avatar className="h-20 w-20 border-4 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.user_name} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {profile.user_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            {/* User Info */}
            <div className="text-center space-y-1 w-full">
              <h3 className="font-semibold text-lg truncate">{profile.user_name}</h3>
              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
              {profile.job_position_name && (
                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                  {profile.job_position_name}
                </span>
              )}
              {profile.default_department_name && (
                <p className="text-xs text-muted-foreground">{profile.default_department_name}</p>
              )}
              {profile.mobile_number && (
                <p className="text-xs text-muted-foreground">{profile.mobile_number}</p>
              )}
              {canViewPasswords && (
                <p className="text-xs font-mono text-muted-foreground">Pass: 123456</p>
              )}
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {profile.is_admin && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  Admin
                </span>
              )}
              <span className={cn(
                "px-2 py-0.5 text-xs rounded-full",
                profile.is_active 
                  ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                  : "bg-red-500/20 text-red-600 dark:text-red-400"
              )}>
                {profile.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 pt-2 border-t w-full justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSecurityClick(profile)}
                title="Security"
              >
                <Shield className="h-4 w-4" />
              </Button>
              {isCurrentUserAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleResetPassword(profile)}
                  title="Reset Password"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(profile)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(profile.id)}
                title="Delete"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={securityDialogOpen} onOpenChange={setSecurityDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Security Settings - {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">Loading permissions...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enable or disable access to menu items for this user. Disabled items will not appear in their sidebar.
              </p>
              
              <div className="space-y-3">
                {MENU_ITEMS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 flex-1">
                      <Label htmlFor={`perm-${item.key}`} className="cursor-pointer">
                        {item.label}
                      </Label>
                      {item.key === "dashboard" && userPermissions[item.key] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDashboardClick}
                        >
                          Configure Components
                        </Button>
                      )}
                      {item.key === "reports" && userPermissions[item.key] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReportsClick}
                        >
                          Configure Reports
                        </Button>
                      )}
                    </div>
                    <Switch
                      id={`perm-${item.key}`}
                      checked={userPermissions[item.key] || false}
                      onCheckedChange={(checked) => handlePermissionToggle(item.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dashboardPermissionsDialogOpen} onOpenChange={setDashboardPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Dashboard Components - {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">Loading permissions...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enable or disable access to specific dashboard components for this user.
              </p>
              
              <div className="space-y-3">
                {DASHBOARD_COMPONENTS.map((component) => (
                  <div key={component.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <Label htmlFor={`dash-${component.key}`} className="cursor-pointer flex-1">
                      {component.label}
                    </Label>
                    <Switch
                      id={`dash-${component.key}`}
                      checked={dashboardPermissions[component.key] ?? true}
                      onCheckedChange={(checked) => handleDashboardPermissionToggle(component.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reportsPermissionsDialogOpen} onOpenChange={setReportsPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Reports Permissions - {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">Loading permissions...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enable or disable access to specific reports for this user.
              </p>
              
              <div className="space-y-3">
                {REPORTS.map((report) => (
                  <div key={report.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <Label htmlFor={`report-${report.key}`} className="cursor-pointer flex-1">
                      {report.label}
                    </Label>
                    <Switch
                      id={`report-${report.key}`}
                      checked={reportsPermissions[report.key] ?? true}
                      onCheckedChange={(checked) => handleReportsPermissionToggle(report.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserSetup;
