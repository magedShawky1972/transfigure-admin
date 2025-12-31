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
import { Plus, Pencil, Trash2, Shield, KeyRound, Search, Filter, Check, ChevronsUpDown, Eye, EyeOff, Copy, Link2 } from "lucide-react";
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
  email_password?: string | null;
  mail_type_id?: string | null;
  mail_type_name?: string | null;
  salesman_code?: string | null;
}

interface MailType {
  id: string;
  type_name: string;
  is_active: boolean;
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
    { key: "dashboard", label: "لوحة التحكم", labelEn: "Dashboard" },
    { key: "ticket_dashboard", label: "لوحة التذاكر", labelEn: "Ticket Dashboard" },
    { key: "shift_dashboard", label: "لوحة الورديات", labelEn: "Shift Dashboard" },
    { key: "task_dashboard", label: "لوحة المهام", labelEn: "Task Dashboard" },
    { key: "user_dashboard", label: "لوحة المستخدم", labelEn: "User Dashboard" },
    { key: "api_documentation", label: "توثيق API", labelEn: "API Documentation" },
    { key: "softwareLicenses", label: "البرامج والتراخيص", labelEn: "Software Licenses" },
    { key: "reports", label: "التقارير", labelEn: "Reports" },
    { key: "transactions", label: "المعاملات", labelEn: "Transactions" },
    { key: "pivotTable", label: "الجدول المحوري", labelEn: "Pivot Table" },
    { key: "loadData", label: "تحميل البيانات", labelEn: "Load Data" },
    { key: "uploadLog", label: "سجل التحميل", labelEn: "Upload Log" },
    { key: "clearData", label: "مسح البيانات", labelEn: "Clear Data" },
    { key: "tickets", label: "تذاكري", labelEn: "My Tickets" },
    { key: "admin_tickets", label: "تذاكر القسم", labelEn: "Department Tickets" },
    { key: "softwareLicenseSetup", label: "إدخال الترخيص", labelEn: "License Entry" },
    { key: "shiftSession", label: "جلسة الوردية", labelEn: "Shift Session" },
    { key: "myShifts", label: "تقويم وردياتي", labelEn: "My Shifts Calendar" },
    { key: "shiftFollowUp", label: "متابعة الورديات", labelEn: "Shift Follow-Up" },
    { key: "tawasoul", label: "تواصل", labelEn: "Tawasoul" },
    { key: "companyNews", label: "أخبار الشركة", labelEn: "Company News" },
    { key: "reportsSetup", label: "إعداد التقارير", labelEn: "Reports Setup" },
    { key: "customerSetup", label: "إعداد العملاء", labelEn: "Customer Setup" },
    { key: "customerProfile", label: "ملف العميل", labelEn: "Customer Profile" },
    { key: "customerTotals", label: "إجمالي العملاء", labelEn: "Customer Totals" },
    { key: "brandSetup", label: "إعداد العلامات", labelEn: "Brand Setup" },
    { key: "brandType", label: "نوع العلامة", labelEn: "Brand Type" },
    { key: "productSetup", label: "إعداد المنتجات", labelEn: "Product Setup" },
    { key: "paymentMethodSetup", label: "إعداد طرق الدفع", labelEn: "Payment Method Setup" },
    { key: "department_management", label: "إدارة الأقسام", labelEn: "Department Management" },
    { key: "userSetup", label: "إعداد المستخدمين", labelEn: "User Setup" },
    { key: "shiftSetup", label: "إعداد الورديات", labelEn: "Shift Setup" },
    { key: "shiftCalendar", label: "تقويم الورديات", labelEn: "Shift Calendar" },
    { key: "currencySetup", label: "إعداد العملات", labelEn: "Currency Setup" },
    { key: "userGroupSetup", label: "مجموعات المستخدمين", labelEn: "User Groups" },
    { key: "projectsTasks", label: "المشاريع والمهام", labelEn: "Projects & Tasks" },
    { key: "companyHierarchy", label: "الهيكل التنظيمي", labelEn: "Company Hierarchy" },
    { key: "supplierSetup", label: "إعداد الموردين", labelEn: "Supplier Setup" },
    { key: "userLogins", label: "بيانات تسجيل الدخول", labelEn: "Users Logins" },
    { key: "userEmails", label: "المستخدمين والبريد", labelEn: "Users & Mails" },
    { key: "asusTawasoul", label: "أسس تواصل", labelEn: "Asus Tawasoul" },
    { key: "emailManager", label: "مدير البريد", labelEn: "Email Manager" },
    { key: "mailSetup", label: "إعداد البريد", labelEn: "Mail Setup" },
    { key: "systemConfig", label: "إعدادات النظام", labelEn: "System Configuration" },
    { key: "closingTraining", label: "تدريب الإغلاق", labelEn: "Closing Training" },
    { key: "odooSetup", label: "إعداد Odoo", labelEn: "Odoo Setup" },
    { key: "excelSetup", label: "إعداد Excel", labelEn: "Excel Setup" },
    { key: "tableConfig", label: "إعداد الجداول", labelEn: "Table Config" },
    { key: "pdfToExcel", label: "تحويل PDF إلى Excel", labelEn: "PDF to Excel" },
    { key: "systemBackup", label: "نسخ احتياطي", labelEn: "System Backup" },
    { key: "systemRestore", label: "استعادة النظام", labelEn: "System Restore" },
    { key: "employeeSetup", label: "إعداد الموظفين", labelEn: "Employee Setup" },
    { key: "vacationSetup", label: "إعداد الإجازات", labelEn: "Vacation Setup" },
    { key: "timesheetManagement", label: "إدارة الحضور", labelEn: "Timesheet Management" },
    { key: "deductionRulesSetup", label: "قواعد الخصم", labelEn: "Deduction Rules" },
    { key: "medicalInsuranceSetup", label: "التأمين الطبي", labelEn: "Medical Insurance" },
    { key: "shiftPlansSetup", label: "خطط الورديات", labelEn: "Shift Plans" },
    { key: "documentTypeSetup", label: "أنواع المستندات", labelEn: "Document Types" },
  ];

const DASHBOARD_COMPONENTS = [
  { key: "sales_metrics", labelEn: "Sales Metrics", labelAr: "مقاييس المبيعات" },
  { key: "total_profit", labelEn: "Total Profit", labelAr: "إجمالي الأرباح" },
  { key: "points_sales", labelEn: "Points Sales", labelAr: "مبيعات النقاط" },
  { key: "transaction_count", labelEn: "Transaction Count", labelAr: "عدد المعاملات" },
  { key: "new_customers", labelEn: "New Customers", labelAr: "العملاء الجدد" },
  { key: "avg_order_metrics", labelEn: "Average Order Value", labelAr: "متوسط قيمة الطلب" },
  { key: "income_statement", labelEn: "Income Statement", labelAr: "بيان الدخل" },
  { key: "transaction_type_chart", labelEn: "Transaction Type Chart", labelAr: "رسم أنواع المعاملات" },
  { key: "user_transaction_count_chart", labelEn: "User Transaction Count Chart", labelAr: "رسم عدد معاملات المستخدم" },
  { key: "user_transaction_value_chart", labelEn: "User Transaction Value Chart", labelAr: "رسم قيمة معاملات المستخدم" },
  { key: "brand_sales_grid", labelEn: "Brand Sales Grid", labelAr: "شبكة مبيعات العلامات" },
  { key: "coins_by_brand", labelEn: "Coins by Brand", labelAr: "الكوينز حسب العلامة" },
  { key: "sales_trend_chart", labelEn: "Sales Trend Chart", labelAr: "رسم اتجاه المبيعات" },
  { key: "top_brands_chart", labelEn: "Top Brands Chart", labelAr: "رسم أفضل العلامات" },
  { key: "top_products_chart", labelEn: "Top Products Chart", labelAr: "رسم أفضل المنتجات" },
  { key: "month_comparison_chart", labelEn: "Month Comparison Chart", labelAr: "رسم مقارنة الأشهر" },
  { key: "payment_methods_chart", labelEn: "Payment Methods Chart", labelAr: "رسم طرق الدفع" },
  { key: "payment_brands_chart", labelEn: "Payment Brands Chart", labelAr: "رسم علامات الدفع" },
  { key: "unused_payment_brands", labelEn: "Unused Payment Brands", labelAr: "علامات الدفع غير المستخدمة" },
  { key: "product_summary_table", labelEn: "Product Summary Table", labelAr: "جدول ملخص المنتجات" },
  { key: "customer_purchases_table", labelEn: "Customer Purchases Table", labelAr: "جدول مشتريات العملاء" },
  { key: "inactive_customers_section", labelEn: "Inactive Customers Section", labelAr: "قسم العملاء غير النشطين" },
  { key: "recent_transactions", labelEn: "Recent Transactions", labelAr: "المعاملات الأخيرة" },
];

const REPORTS = [
  { key: "revenue-by-brand-type", labelEn: "Revenue by Brand Type", labelAr: "الإيرادات حسب نوع العلامة التجارية" },
  { key: "cost-by-brand-type", labelEn: "Cost by Brand Type", labelAr: "التكلفة حسب نوع العلامة التجارية" },
  { key: "tickets", labelEn: "Tickets Report", labelAr: "تقرير التذاكر" },
  { key: "software-licenses", labelEn: "Software Licenses Report", labelAr: "تقرير تراخيص البرمجيات" },
  { key: "shift-report", labelEn: "Shift Report", labelAr: "تقرير المناوبات" },
  { key: "shift-plan", labelEn: "Shift Plan Report", labelAr: "تقرير خطة المناوبات" },
  { key: "brand-balance", labelEn: "Brand Balance Report", labelAr: "تقرير أرصدة البراندات" },
  { key: "api-documentation", labelEn: "API Documentation", labelAr: "توثيق API" },
  { key: "transaction-statistics", labelEn: "Transaction Statistics", labelAr: "إحصائيات المعاملات" },
  { key: "order-payment", labelEn: "Order Payment Report", labelAr: "تقرير مدفوعات الطلبات" },
  { key: "data-loading-status", labelEn: "Data Loading Status", labelAr: "حالة تحميل البيانات" },
  { key: "coins-ledger", labelEn: "Coins Ledger Report", labelAr: "تقرير دفتر الكوينز" },
  { key: "bank-statement", labelEn: "Bank Statement Report", labelAr: "تقرير كشف حساب البنك" },
];

const UserSetup = () => {
  const { t, language } = useLanguage();
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
  const [copyPermissionsDialogOpen, setCopyPermissionsDialogOpen] = useState(false);
  const [selectedTargetUsers, setSelectedTargetUsers] = useState<string[]>([]);
  const [copyingPermissions, setCopyingPermissions] = useState(false);
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
    email_password: "",
    mail_type_id: null as string | null,
    salesman_code: "",
  });

  const [mailTypes, setMailTypes] = useState<MailType[]>([]);
  const [mailTypeOpen, setMailTypeOpen] = useState(false);
  const [newMailType, setNewMailType] = useState("");

  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [jobPositionOpen, setJobPositionOpen] = useState(false);
  const [newJobPosition, setNewJobPosition] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailPasswordVerifyOpen, setEmailPasswordVerifyOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyingForUserId, setVerifyingForUserId] = useState<string | null>(null);
  const [visibleEmailPasswords, setVisibleEmailPasswords] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchProfiles();
    checkCurrentUserAdmin();
    fetchJobPositions();
    fetchDepartments();
    fetchMailTypes();
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

  const fetchMailTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("mail_types")
        .select("id, type_name, is_active")
        .eq("is_active", true)
        .order("type_name");

      if (error) throw error;
      setMailTypes(data || []);
    } catch (error: any) {
      console.error("Error fetching mail types:", error);
    }
  };

  const handleAddNewMailType = async () => {
    if (!newMailType.trim()) return;

    try {
      const { data, error } = await supabase
        .from("mail_types")
        .insert({ 
          type_name: newMailType.trim(),
          imap_host: "",
          smtp_host: ""
        })
        .select()
        .single();

      if (error) throw error;

      setMailTypes([...mailTypes, data]);
      setFormData({ ...formData, mail_type_id: data.id });
      setNewMailType("");
      setMailTypeOpen(false);

      toast({
        title: t("common.success"),
        description: "Mail type added successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
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
      // Fetch profiles with job positions, departments and mail types
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          *,
          job_position:job_positions(position_name),
          default_department:departments(department_name),
          mail_type:mail_types(type_name)
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
        mail_type_name: profile.mail_type?.type_name || null,
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
            email_password: formData.email_password || null,
            mail_type_id: formData.mail_type_id,
            salesman_code: formData.salesman_code || null,
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
        const isSysadminSession = sessionStorage.getItem("sysadmin_session") === "true";
        
        // Check if there's a valid session OR sysadmin session
        if (!session && !isSysadminSession) {
          throw new Error("Not authenticated");
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Add appropriate auth header
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }
        
        // Add sysadmin session header if applicable
        if (isSysadminSession) {
          headers["x-sysadmin-session"] = "true";
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              user_name: formData.user_name,
              email: formData.email,
              mobile_number: formData.mobile_number || null,
              is_active: formData.is_active,
              job_position_id: formData.job_position_id,
              is_admin: formData.is_admin,
            }),
          }
        );

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || "Failed to create user");
        }

        // If this was the first user created, show a special message
        if (result.isFirstUser) {
          toast({
            title: t("common.success"),
            description: language === 'ar' 
              ? "تم إنشاء المستخدم الأول بصلاحيات المسؤول الكاملة" 
              : "First user created with full admin permissions",
          });
        } else {
          toast({
            title: t("common.success"),
            description: "User created successfully",
          });
        }
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
      email_password: profile.email_password || "",
      mail_type_id: profile.mail_type_id || null,
      salesman_code: profile.salesman_code || "",
    });
    setShowEmailPassword(false);
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
      email_password: "",
      mail_type_id: null,
      salesman_code: "",
    });
    setEditingProfile(null);
    setShowEmailPassword(false);
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

  const handleCopyPermissionsToUsers = async () => {
    if (!selectedUser || selectedTargetUsers.length === 0) return;
    
    setCopyingPermissions(true);
    try {
      // Fetch all permissions of source user
      const { data: sourcePermissions, error: fetchError } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", selectedUser.user_id);
      
      if (fetchError) throw fetchError;
      
      // Copy permissions to each target user
      for (const targetUserId of selectedTargetUsers) {
        // Delete existing permissions for target user
        await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", targetUserId);
        
        // Insert source permissions for target user
        if (sourcePermissions && sourcePermissions.length > 0) {
          const newPermissions = sourcePermissions.map(perm => ({
            user_id: targetUserId,
            menu_item: perm.menu_item,
            has_access: perm.has_access,
            parent_menu: perm.parent_menu,
          }));
          
          const { error: insertError } = await supabase
            .from("user_permissions")
            .insert(newPermissions);
          
          if (insertError) throw insertError;
        }
      }
      
      toast({
        title: t("common.success"),
        description: language === 'ar' 
          ? `تم نسخ الصلاحيات إلى ${selectedTargetUsers.length} مستخدم بنجاح`
          : `Permissions copied to ${selectedTargetUsers.length} user(s) successfully`,
      });
      
      setCopyPermissionsDialogOpen(false);
      setSelectedTargetUsers([]);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCopyingPermissions(false);
    }
  };

  const toggleTargetUser = (userId: string) => {
    setSelectedTargetUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
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

  const handleShowEmailPassword = (profileId: string) => {
    setVerifyingForUserId(profileId);
    setVerifyPassword("");
    setEmailPasswordVerifyOpen(true);
  };

  const handleVerifyEmailPassword = () => {
    if (verifyPassword === "159753" && verifyingForUserId) {
      setVisibleEmailPasswords(prev => new Set([...prev, verifyingForUserId]));
      setEmailPasswordVerifyOpen(false);
      setVerifyPassword("");
      setVerifyingForUserId(null);
    } else {
      toast({
        title: "Error",
        description: "Invalid password",
        variant: "destructive",
      });
    }
  };

  const copyEmailPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast({
      title: "Copied",
      description: "Email password copied to clipboard",
    });
  };

  const generatePasswordResetLink = (email: string) => {
    // Generate a link that will auto-login with default password and redirect to change password.
    // Use a single param to avoid some chat apps dropping extra query params in link previews.
    const baseUrl = "https://edaraasus.com";
    const defaultPassword = "123456";

    const payload = btoa(JSON.stringify({ email, password: defaultPassword }));
    const resetLink = `${baseUrl}/auth?firstlogin=${encodeURIComponent(payload)}`;
    return resetLink;
  };

  const copyPasswordResetLink = (profile: Profile) => {
    const link = generatePasswordResetLink(profile.email);
    navigator.clipboard.writeText(link);
    toast({
      title: language === 'ar' ? 'تم النسخ' : 'Copied',
      description: language === 'ar' 
        ? `تم نسخ رابط تغيير كلمة المرور لـ ${profile.user_name}`
        : `Password reset link copied for ${profile.user_name}`,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {language === 'ar' ? 'إعداد المستخدمين' : 'User Setup'}
        </h1>
        <div className="flex gap-2 items-center">
          {/* Main Search Box */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === 'ar' ? 'بحث المستخدمين...' : 'Search users...'}
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
            {showFilters 
              ? (language === 'ar' ? 'إخفاء الفلاتر' : 'Hide Filters') 
              : (language === 'ar' ? 'الفلاتر' : 'Filters')}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProfile 
                  ? (language === 'ar' ? 'تعديل المستخدم' : 'Edit User') 
                  : (language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User')}
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
                <Label htmlFor="user_name">{language === 'ar' ? 'اسم المستخدم' : 'User Name'}</Label>
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
                <Label htmlFor="email">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
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
                <Label htmlFor="mobile_number">{language === 'ar' ? 'رقم الجوال' : 'Mobile Number'}</Label>
                <Input
                  id="mobile_number"
                  value={formData.mobile_number}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile_number: e.target.value })
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المسمى الوظيفي' : 'Job Position'}</Label>
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
                        : (language === 'ar' ? 'اختر المسمى الوظيفي...' : 'Select job position...')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder={language === 'ar' ? 'بحث أو إضافة مسمى جديد...' : 'Search or type new position...'} 
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
                            {language === 'ar' ? `إضافة "${newJobPosition}"` : `Add "${newJobPosition}"`}
                          </CommandItem>
                        )}
                      </CommandGroup>
                      {jobPositions.length === 0 && !newJobPosition && (
                        <CommandEmpty>{language === 'ar' ? 'لا توجد مسميات وظيفية.' : 'No job positions found.'}</CommandEmpty>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'القسم الافتراضي' : 'Default Department'}</Label>
                <Select
                  value={formData.default_department_id || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_department_id: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر القسم...' : 'Select department...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === 'ar' ? 'بدون قسم افتراضي' : 'No Default Department'}</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.department_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salesman_code">{language === 'ar' ? 'كود البائع' : 'Sales Man Code'}</Label>
                <Input
                  id="salesman_code"
                  value={formData.salesman_code}
                  onChange={(e) =>
                    setFormData({ ...formData, salesman_code: e.target.value })
                  }
                  placeholder={language === 'ar' ? 'أدخل كود البائع...' : 'Enter sales man code...'}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'نوع البريد' : 'Mail Type'}</Label>
                <Popover open={mailTypeOpen} onOpenChange={setMailTypeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={mailTypeOpen}
                      className="w-full justify-between"
                    >
                      {formData.mail_type_id
                        ? mailTypes.find((mt) => mt.id === formData.mail_type_id)?.type_name
                        : (language === 'ar' ? 'اختر نوع البريد...' : 'Select mail type...')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder={language === 'ar' ? 'بحث أو إضافة نوع بريد جديد...' : 'Search or type new mail type...'} 
                        value={newMailType}
                        onValueChange={setNewMailType}
                      />
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setFormData({ ...formData, mail_type_id: null });
                            setMailTypeOpen(false);
                            setNewMailType("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !formData.mail_type_id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {language === 'ar' ? 'بدون نوع بريد' : 'No Mail Type'}
                        </CommandItem>
                        {mailTypes
                          .filter((mailType) => 
                            mailType.type_name.toLowerCase().includes(newMailType.toLowerCase())
                          )
                          .map((mailType) => (
                            <CommandItem
                              key={mailType.id}
                              value={mailType.type_name}
                              onSelect={() => {
                                setFormData({ ...formData, mail_type_id: mailType.id });
                                setMailTypeOpen(false);
                                setNewMailType("");
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.mail_type_id === mailType.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {mailType.type_name}
                            </CommandItem>
                          ))}
                        {newMailType && 
                          !mailTypes.some((mt) => mt.type_name.toLowerCase() === newMailType.toLowerCase()) && (
                          <CommandItem
                            value={newMailType}
                            onSelect={handleAddNewMailType}
                            className="bg-primary/10"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {language === 'ar' ? `إضافة "${newMailType}"` : `Add "${newMailType}"`}
                          </CommandItem>
                        )}
                      </CommandGroup>
                      {mailTypes.length === 0 && !newMailType && (
                        <CommandEmpty>{language === 'ar' ? 'لا توجد أنواع بريد.' : 'No mail types found.'}</CommandEmpty>
                      )}
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {editingProfile && (
                <div className="space-y-2">
                  <Label htmlFor="email_password">{language === 'ar' ? 'كلمة مرور البريد' : 'Email Password'}</Label>
                  <div className="relative flex gap-2">
                    <Input
                      id="email_password"
                      type={showEmailPassword ? "text" : "password"}
                      value={formData.email_password}
                      onChange={(e) =>
                        setFormData({ ...formData, email_password: e.target.value })
                      }
                      placeholder={language === 'ar' ? 'أدخل كلمة مرور البريد...' : 'Enter email password...'}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                    >
                      {showEmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">{language === 'ar' ? 'نشط' : 'Active'}</Label>
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
                  <Label htmlFor="is_admin">{language === 'ar' ? 'صلاحية المدير' : 'Admin Access'}</Label>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading 
                  ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                  : editingProfile 
                    ? (language === 'ar' ? 'تحديث المستخدم' : 'Update User') 
                    : (language === 'ar' ? 'إنشاء المستخدم' : 'Create User')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-lg font-semibold">{language === 'ar' ? 'الفلاتر المتقدمة' : 'Advanced Filters'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">{language === 'ar' ? 'بحث' : 'Search'}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={language === 'ar' ? 'بحث بالاسم أو البريد أو الجوال...' : 'Search by name, email, or mobile...'}
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">{language === 'ar' ? 'الحالة' : 'Status'}</Label>
              <select
                id="status"
                value={filters.statusFilter}
                onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value })}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
                <option value="active">{language === 'ar' ? 'النشطين فقط' : 'Active Only'}</option>
                <option value="inactive">{language === 'ar' ? 'غير النشطين فقط' : 'Inactive Only'}</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">{language === 'ar' ? 'الدور' : 'Role'}</Label>
              <select
                id="role"
                value={filters.roleFilter}
                onChange={(e) => setFilters({ ...filters, roleFilter: e.target.value })}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">{language === 'ar' ? 'كل الأدوار' : 'All Roles'}</option>
                <option value="admin">{language === 'ar' ? 'المدراء فقط' : 'Admin Only'}</option>
                <option value="user">{language === 'ar' ? 'المستخدمين فقط' : 'User Only'}</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? `عرض ${filteredProfiles.length} من ${profiles.length} مستخدم`
                : `Showing ${filteredProfiles.length} of ${profiles.length} users`}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ searchTerm: "", statusFilter: "all", roleFilter: "all" })}
            >
              {language === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
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
              {/* Email Password Display */}
              {isCurrentUserAdmin && profile.email_password && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  {visibleEmailPasswords.has(profile.id) ? (
                    <>
                      <span className="text-xs font-mono text-muted-foreground">
                        Email Pass: {profile.email_password}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => copyEmailPassword(profile.email_password!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => handleShowEmailPassword(profile.id)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Email Pass
                    </Button>
                  )}
                </div>
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
            <div className="flex items-center gap-1 pt-2 border-t w-full justify-center flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyPasswordResetLink(profile)}
                title={language === 'ar' ? 'نسخ رابط تغيير كلمة المرور' : 'Copy Password Reset Link'}
                className="text-blue-500 hover:text-blue-600"
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSecurityClick(profile)}
                title={language === 'ar' ? 'الأمان' : 'Security'}
              >
                <Shield className="h-4 w-4" />
              </Button>
              {isCurrentUserAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleResetPassword(profile)}
                  title={language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
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
            <div className="flex items-center justify-between">
              <DialogTitle>
                {language === 'ar' ? 'إعدادات الأمان' : 'Security Settings'} - {selectedUser?.user_name}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTargetUsers([]);
                  setCopyPermissionsDialogOpen(true);
                }}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                {language === 'ar' ? 'نسخ إلى مستخدم' : 'Copy to User'}
              </Button>
            </div>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">{language === 'ar' ? 'جاري التحميل...' : 'Loading permissions...'}</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'تمكين أو تعطيل الوصول إلى عناصر القائمة لهذا المستخدم. العناصر المعطلة لن تظهر في القائمة الجانبية.'
                  : 'Enable or disable access to menu items for this user. Disabled items will not appear in their sidebar.'}
              </p>
              
              <div className="space-y-3">
                {MENU_ITEMS.map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 flex-1">
                      <Label htmlFor={`perm-${item.key}`} className="cursor-pointer">
                        {language === 'ar' ? item.label : item.labelEn}
                      </Label>
                      {item.key === "dashboard" && userPermissions[item.key] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDashboardClick}
                        >
                          {language === 'ar' ? 'إعداد المكونات' : 'Configure Components'}
                        </Button>
                      )}
                      {item.key === "reports" && userPermissions[item.key] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReportsClick}
                        >
                          {language === 'ar' ? 'إعداد التقارير' : 'Configure Reports'}
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
              {language === 'ar' ? 'مكونات لوحة التحكم' : 'Dashboard Components'} - {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">{language === 'ar' ? 'جاري التحميل...' : 'Loading permissions...'}</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'تفعيل أو تعطيل الوصول إلى مكونات لوحة التحكم المحددة لهذا المستخدم.'
                  : 'Enable or disable access to specific dashboard components for this user.'}
              </p>
              
              <div className="space-y-3">
                {DASHBOARD_COMPONENTS.map((component) => (
                  <div key={component.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <Label htmlFor={`dash-${component.key}`} className="cursor-pointer flex-1">
                      {language === 'ar' ? component.labelAr : component.labelEn}
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
              {language === 'ar' ? 'صلاحيات التقارير' : 'Reports Permissions'} - {selectedUser?.user_name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingPermissions ? (
            <div className="py-8 text-center">{language === 'ar' ? 'جارٍ تحميل الصلاحيات...' : 'Loading permissions...'}</div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'تفعيل أو تعطيل الوصول إلى تقارير محددة لهذا المستخدم.' : 'Enable or disable access to specific reports for this user.'}
              </p>
              
              <div className="space-y-3">
                {REPORTS.map((report) => (
                  <div key={report.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <Label htmlFor={`report-${report.key}`} className="cursor-pointer flex-1">
                      {language === 'ar' ? report.labelAr : report.labelEn}
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

      {/* Copy Permissions Dialog */}
      <Dialog open={copyPermissionsDialogOpen} onOpenChange={setCopyPermissionsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'نسخ الصلاحيات إلى مستخدمين آخرين' : 'Copy Permissions to Other Users'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? `نسخ جميع صلاحيات ${selectedUser?.user_name} إلى المستخدمين المحددين أدناه.`
                : `Copy all permissions from ${selectedUser?.user_name} to the selected users below.`}
            </p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {profiles
                .filter(p => p.user_id !== selectedUser?.user_id && p.is_active)
                .map((profile) => (
                  <div 
                    key={profile.user_id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedTargetUsers.includes(profile.user_id) 
                        ? "bg-primary/10 border-primary" 
                        : "bg-card hover:bg-muted"
                    )}
                    onClick={() => toggleTargetUser(profile.user_id)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {profile.avatar_url ? (
                          <AvatarImage src={profile.avatar_url} alt={profile.user_name} />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {profile.user_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{profile.user_name}</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center",
                      selectedTargetUsers.includes(profile.user_id)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground"
                    )}>
                      {selectedTargetUsers.includes(profile.user_id) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                  </div>
                ))}
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? `تم تحديد ${selectedTargetUsers.length} مستخدم`
                  : `${selectedTargetUsers.length} user(s) selected`}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setCopyPermissionsDialogOpen(false)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button 
                  onClick={handleCopyPermissionsToUsers}
                  disabled={selectedTargetUsers.length === 0 || copyingPermissions}
                >
                  {copyingPermissions 
                    ? (language === 'ar' ? 'جاري النسخ...' : 'Copying...') 
                    : (language === 'ar' ? 'نسخ الصلاحيات' : 'Copy Permissions')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Password Verification Dialog */}
      <Dialog open={emailPasswordVerifyOpen} onOpenChange={setEmailPasswordVerifyOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Enter Password to View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter verification password..."
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerifyEmailPassword();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEmailPasswordVerifyOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleVerifyEmailPassword}>
                Verify
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserSetup;
