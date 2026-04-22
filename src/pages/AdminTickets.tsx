import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Eye, ShoppingCart, MessageSquare, Send, Trash2, Mail, History, ArrowRightLeft, RotateCcw, CheckCircle, Building2, Undo2, XCircle, Search } from "lucide-react";
import TicketActivityLogDialog from "@/components/TicketActivityLogDialog";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  department_id: string;
  user_id: string;
  assigned_to: string | null;
  approved_at: string | null;
  approved_by: string | null;
  is_purchase_ticket: boolean;
  next_admin_order: number | null;
  external_link: string | null;
  budget_value: number | null;
  qty: number | null;
  uom: string | null;
  currency_id: string | null;
  departments: {
    department_name: string;
  };
  profiles: {
    user_name: string;
    email: string;
  };
  assigned_user?: {
    user_name: string;
    email: string;
  } | null;
  currency?: {
    currency_code: string;
    currency_name: string;
  } | null;
};

type DepartmentMember = {
  user_id: string;
  profiles: {
    user_name: string;
    email: string;
  };
};

type DepartmentAdminInfo = {
  department_id: string;
  admin_order: number;
  is_purchase_admin: boolean;
};

type AllDepartmentAdmin = {
  department_id: string;
  user_id: string;
  admin_order: number;
  is_purchase_admin: boolean;
  user_name: string | null;
};

const AdminTickets = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterPendingApprover, setFilterPendingApprover] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentMembers, setDepartmentMembers] = useState<Record<string, DepartmentMember[]>>({});
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [selectedTicketForLog, setSelectedTicketForLog] = useState<{ id: string; number: string } | null>(null);
  const [currentUserAdminInfo, setCurrentUserAdminInfo] = useState<DepartmentAdminInfo[]>([]);
  const [allDepartmentAdmins, setAllDepartmentAdmins] = useState<AllDepartmentAdmin[]>([]);
  const [changeDeptDialog, setChangeDeptDialog] = useState<{ open: boolean; ticket: Ticket | null }>({ open: false, ticket: null });
  const [newDepartmentId, setNewDepartmentId] = useState<string>("");
  const [allDepartments, setAllDepartments] = useState<{ id: string; department_name: string }[]>([]);
  const [reverseApprovalDialog, setReverseApprovalDialog] = useState<{ open: boolean; ticket: Ticket | null }>({ open: false, ticket: null });
  
  // Cost center dialog state
  const [costCenterDialogOpen, setCostCenterDialogOpen] = useState(false);
  const [pendingApprovalTicketId, setPendingApprovalTicketId] = useState<string | null>(null);
  const [costCenters, setCostCenters] = useState<{ id: string; cost_center_name: string; cost_center_code: string }[]>([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<string>("");

  // Send back for clarification state
  const [sendBackDialog, setSendBackDialog] = useState<{ open: boolean; ticket: Ticket | null }>({ open: false, ticket: null });
  const [sendBackComment, setSendBackComment] = useState("");
  const [sendingBack, setSendingBack] = useState(false);

  // Reject ticket state
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; ticket: Ticket | null }>({ open: false, ticket: null });
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  useEffect(() => {
    checkAdminStatus();
    fetchTickets();
    fetchDepartmentMembers();
    fetchCurrentUserAdminInfo();
    fetchAllDepartments();
    fetchCostCenters();
  }, []);

  const fetchCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, cost_center_name, cost_center_code")
        .eq("is_active", true)
        .order("cost_center_name");
      
      if (error) throw error;
      setCostCenters(data || []);
    } catch (error: any) {
      console.error("Error fetching cost centers:", error);
    }
  };

  const fetchAllDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name")
        .eq("is_active", true)
        .order("department_name");
      
      if (error) throw error;
      setAllDepartments(data || []);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  // Check if current user can approve a specific ticket
  const canUserApprove = (ticket: Ticket): boolean => {
    if (ticket.approved_at) return false; // Already fully approved
    
    const userAdminForDept = currentUserAdminInfo.find(a => a.department_id === ticket.department_id);
    if (!userAdminForDept) return false;
    
    const deptAdmins = allDepartmentAdmins.filter(a => a.department_id === ticket.department_id);
    const nextOrder = ticket.next_admin_order ?? 0; // Default to 0 since admin_order starts at 0
    
    // For non-purchase tickets: only regular admins are in the approval chain
    if (!ticket.is_purchase_ticket) {
      // User must be a regular admin with matching order
      return !userAdminForDept.is_purchase_admin && userAdminForDept.admin_order === nextOrder;
    }
    
    // For purchase tickets: determine if we're in regular phase or purchase phase
    // Check if there are any regular admins at the next_admin_order
    const regularAdminsAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
    
    if (regularAdminsAtOrder.length > 0) {
      // We're in regular admin phase
      return !userAdminForDept.is_purchase_admin && userAdminForDept.admin_order === nextOrder;
    } else {
      // We're in purchase admin phase (or transitioning to it)
      // Check if there are purchase admins at next_admin_order
      const purchaseAdminsAtOrder = deptAdmins.filter(a => a.is_purchase_admin && a.admin_order === nextOrder);
      if (purchaseAdminsAtOrder.length > 0) {
        return userAdminForDept.is_purchase_admin && userAdminForDept.admin_order === nextOrder;
      }
    }
    
    return false;
  };

  // Get the approver names for a ticket
  const getApproverNames = (ticket: Ticket): string[] => {
    if (ticket.approved_at) return []; // Already fully approved
    
    const deptAdmins = allDepartmentAdmins.filter(a => a.department_id === ticket.department_id);
    const nextOrder = ticket.next_admin_order ?? 0;
    
    console.log(`getApproverNames for ${ticket.ticket_number}: deptAdmins=${deptAdmins.length}, nextOrder=${nextOrder}, allDepartmentAdmins=${allDepartmentAdmins.length}`);
    
    // For non-purchase tickets: only regular admins
    if (!ticket.is_purchase_ticket) {
      const regularAdmins = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
      console.log(`  Regular admins at order ${nextOrder}:`, regularAdmins.map(a => a.user_name));
      return regularAdmins.map(a => a.user_name).filter((name): name is string => !!name);
    }
    
    // For purchase tickets: determine phase
    const regularAdminsAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
    
    if (regularAdminsAtOrder.length > 0) {
      // Regular admin phase
      console.log(`  Purchase ticket - Regular admins at order ${nextOrder}:`, regularAdminsAtOrder.map(a => a.user_name));
      return regularAdminsAtOrder.map(a => a.user_name).filter((name): name is string => !!name);
    } else {
      // Purchase admin phase
      const purchaseAdminsAtOrder = deptAdmins.filter(a => a.is_purchase_admin && a.admin_order === nextOrder);
      console.log(`  Purchase ticket - Purchase admins at order ${nextOrder}:`, purchaseAdminsAtOrder.map(a => a.user_name));
      return purchaseAdminsAtOrder.map(a => a.user_name).filter((name): name is string => !!name);
    }
  };

  const fetchCurrentUserAdminInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

     console.log("Fetching admin info for user:", user.id);

      // Get current user's admin info for all departments
      const { data: userAdminData, error: userAdminError } = await supabase
        .from("department_admins")
        .select("department_id, admin_order, is_purchase_admin")
        .eq("user_id", user.id);

      if (userAdminError) throw userAdminError;
      setCurrentUserAdminInfo(userAdminData || []);

     console.log("User admin data:", userAdminData);

      // Check if user can view all tickets or is admin
      const { data: profileData } = await supabase
        .from("profiles")
        .select("can_view_all_tickets")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: adminRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      const canViewAllTickets = profileData?.can_view_all_tickets || !!adminRoleData;

     console.log("Can view all tickets:", canViewAllTickets, "Profile data:", profileData, "Admin role:", adminRoleData);

      let allAdmins: any[] = [];

      if (canViewAllTickets) {
        // Fetch ALL department admins for users who can view all tickets
       console.log("Fetching ALL department admins...");
        const { data: allDeptAdmins, error: allDeptAdminsError } = await supabase
          .from("department_admins")
          .select("department_id, user_id, admin_order, is_purchase_admin");

        if (allDeptAdminsError) throw allDeptAdminsError;
        allAdmins = allDeptAdmins || [];
       console.log("Fetched all admins:", allAdmins.length);
      } else {
        // Get all department IDs where user is admin
        const departmentIds = userAdminData?.map(d => d.department_id) || [];
        
       console.log("Fetching admins for user's departments:", departmentIds);
        if (departmentIds.length > 0) {
          // Get all admins for these departments
          const { data: deptAdmins, error: deptAdminsError } = await supabase
            .from("department_admins")
            .select("department_id, user_id, admin_order, is_purchase_admin")
            .in("department_id", departmentIds);

          if (deptAdminsError) throw deptAdminsError;
          allAdmins = deptAdmins || [];
         console.log("Fetched department admins:", allAdmins.length);
        }
      }

      if (allAdmins.length > 0) {
        // Fetch user names for all admins
        const userIds = [...new Set(allAdmins.map(a => a.user_id))];
       console.log("Fetching names for", userIds.length, "users");
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.user_name]) || []);
        
        const adminsWithNames = allAdmins.map(admin => ({
          ...admin,
          user_name: profileMap.get(admin.user_id) || null
        }));
        
       console.log("Setting allDepartmentAdmins:", adminsWithNames.length, "admins");
        setAllDepartmentAdmins(adminsWithNames);
     } else {
       console.log("No admins found, setting empty array");
       setAllDepartmentAdmins([]);
      }
    } catch (error: any) {
      console.error("Error fetching admin info:", error);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (data && !error) {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user has delegation to view all tickets
      const { data: profileData } = await supabase
        .from("profiles")
        .select("can_view_all_tickets")
        .eq("user_id", user.id)
        .maybeSingle();

      const canViewAllTickets = profileData?.can_view_all_tickets || isAdmin;

      let departmentIds: string[] = [];
      
      if (!canViewAllTickets) {
        // Get departments where user is admin
        const { data: adminDepts, error: deptError } = await supabase
          .from("department_admins")
          .select("department_id")
          .eq("user_id", user.id);

        if (deptError) throw deptError;

        departmentIds = adminDepts?.map(d => d.department_id) || [];

        if (departmentIds.length === 0) {
          setTickets([]);
          return;
        }
      }

      // Fetch tickets - either all or filtered by department
      let ticketQuery = supabase
        .from("tickets")
        .select(`
          *,
          departments (
            department_name
          ),
          currencies:currency_id (
            currency_code,
            currency_name
          )
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      // Only filter by department if user doesn't have delegation
      if (!canViewAllTickets && departmentIds.length > 0) {
        ticketQuery = ticketQuery.in("department_id", departmentIds);
      }

      const { data, error } = await ticketQuery;

      if (error) throw error;
      
      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set([
          ...data.map(t => t.user_id),
          ...data.filter(t => t.assigned_to).map(t => t.assigned_to)
        ].filter(Boolean))];
        
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, user_name, email")
          .in("user_id", userIds);
        
        const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
        
        const ticketsWithProfiles = data.map(ticket => ({
          ...ticket,
          profiles: profileMap.get(ticket.user_id) || { user_name: "Unknown", email: "" },
          assigned_user: ticket.assigned_to ? profileMap.get(ticket.assigned_to) : null,
          currency: ticket.currencies || null
        }));
        
        setTickets(ticketsWithProfiles);
      } else {
        setTickets([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: adminDepts } = await supabase
        .from("department_admins")
        .select("department_id")
        .eq("user_id", user.id);

      const departmentIds = adminDepts?.map(d => d.department_id) || [];

      if (departmentIds.length === 0) return;

      const { data, error } = await supabase
        .from("department_members")
        .select("department_id, user_id")
        .in("department_id", departmentIds);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(m => m.user_id))];
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, user_name, email")
          .in("user_id", userIds);

        const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);

        const membersByDept: Record<string, DepartmentMember[]> = {};
        data.forEach(member => {
          if (!membersByDept[member.department_id]) {
            membersByDept[member.department_id] = [];
          }
          const profile = profileMap.get(member.user_id);
          if (profile) {
            membersByDept[member.department_id].push({
              user_id: member.user_id,
              profiles: profile
            });
          }
        });

        setDepartmentMembers(membersByDept);
      }
    } catch (error: any) {
      console.error("Error fetching department members:", error);
    }
  };

  const handleApprove = async (ticketId: string, costCenterId?: string, purchaseType?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current user's profile for logging
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("id", user.id)
        .maybeSingle();

      // Get ticket details first
      const { data: ticket } = await supabase
        .from("tickets")
        .select("user_id, ticket_number, subject, department_id, is_purchase_ticket, next_admin_order, budget_value, qty, currency_id, cost_center_id, purchase_type")
        .eq("id", ticketId)
        .single();

      if (!ticket) throw new Error("Ticket not found");

      // Get current admin's info (order, purchase status, and requires_cost_center)
      const { data: currentAdmin } = await supabase
        .from("department_admins")
        .select("admin_order, is_purchase_admin, requires_cost_center")
        .eq("user_id", user.id)
        .eq("department_id", ticket.department_id)
        .single();

      if (!currentAdmin) throw new Error("Admin not found for this department");

      console.log("DEBUG AdminTickets handleApprove:", {
        ticketId,
        is_purchase_ticket: ticket.is_purchase_ticket,
        requires_cost_center: currentAdmin.requires_cost_center,
        existing_cost_center_id: ticket.cost_center_id,
        passed_cost_center_id: costCenterId,
        existing_purchase_type: ticket.purchase_type,
        passed_purchase_type: purchaseType,
      });

      // Check if cost center is required for purchase tickets
      if (ticket.is_purchase_ticket && currentAdmin.requires_cost_center && !costCenterId && !ticket.cost_center_id) {
        // Open cost center dialog
        setPendingApprovalTicketId(ticketId);
        setSelectedCostCenterId("");
        setSelectedPurchaseType(ticket.purchase_type || "");
        setCostCenterDialogOpen(true);
        return;
      }

      const currentOrder = currentAdmin.admin_order;
      const currentIsPurchaseAdmin = currentAdmin.is_purchase_admin;

      // Determine the approval flow based on ticket type
      // For purchase tickets: regular admins first (by order), then purchase admins (by order)
      // For non-purchase tickets: only regular admins (by order) - NEVER go to purchase admins

      let nextAdmins: any[] = [];
      let nextAdminOrder = currentOrder;
      let nextIsPurchasePhase = false;

      // STEP 1: Always check for next regular admins first (regardless of ticket type)
      const { data: nextRegularAdmins } = await supabase
        .from("department_admins")
        .select("user_id, admin_order")
        .eq("department_id", ticket.department_id)
        .eq("is_purchase_admin", false)
        .gt("admin_order", currentOrder)
        .order("admin_order", { ascending: true })
        .limit(10);

      if (nextRegularAdmins && nextRegularAdmins.length > 0) {
        // Found more regular admins - route to them
        const nextOrderLevel = nextRegularAdmins[0].admin_order;
        nextAdmins = nextRegularAdmins.filter(a => a.admin_order === nextOrderLevel);
        nextAdminOrder = nextOrderLevel;
        nextIsPurchasePhase = false;
      } else if (ticket.is_purchase_ticket) {
        // STEP 2: No more regular admins AND this is a purchase ticket
        // → Move to purchase admin phase

        if (currentIsPurchaseAdmin) {
          // Already in purchase phase - look for next purchase admin at higher level
          const { data: nextPurchaseAdmins } = await supabase
            .from("department_admins")
            .select("user_id, admin_order")
            .eq("department_id", ticket.department_id)
            .eq("is_purchase_admin", true)
            .gt("admin_order", currentOrder)
            .order("admin_order", { ascending: true })
            .limit(10);

          if (nextPurchaseAdmins && nextPurchaseAdmins.length > 0) {
            const nextOrderLevel = nextPurchaseAdmins[0].admin_order;
            nextAdmins = nextPurchaseAdmins.filter(a => a.admin_order === nextOrderLevel);
            nextAdminOrder = nextOrderLevel;
            nextIsPurchasePhase = true;
          }
        } else {
          // Just finished regular admins - start purchase admin phase from lowest level
          const { data: purchaseAdmins } = await supabase
            .from("department_admins")
            .select("user_id, admin_order")
            .eq("department_id", ticket.department_id)
            .eq("is_purchase_admin", true)
            .order("admin_order", { ascending: true })
            .limit(10);

          if (purchaseAdmins && purchaseAdmins.length > 0) {
            const firstOrderLevel = purchaseAdmins[0].admin_order;
            nextAdmins = purchaseAdmins.filter(a => a.admin_order === firstOrderLevel);
            nextAdminOrder = firstOrderLevel;
            nextIsPurchasePhase = true;
          }
        }
      }
      // STEP 3: If not a purchase ticket and no more regular admins
      // → nextAdmins stays empty → ticket will be FULLY APPROVED

      const hasNextLevel = nextAdmins.length > 0;

      // Build update object
      const updateData: Record<string, any> = {};
      
      // Add cost center and purchase type if provided
      if (costCenterId) {
        updateData.cost_center_id = costCenterId;
      }
      if (purchaseType) {
        updateData.purchase_type = purchaseType;
      }

      if (hasNextLevel) {
        // There are more admins - update next_admin_order and send notification
        const { error } = await supabase
          .from("tickets")
          .update({
            ...updateData,
            next_admin_order: nextAdminOrder,
            status: "In Progress",
          })
          .eq("id", ticketId);

        if (error) throw error;

        // Log the approval action
        await supabase.from("ticket_activity_logs").insert({
          ticket_id: ticketId,
          activity_type: "approved",
          user_id: user.id,
          user_name: userProfile?.user_name || user.email,
          description: language === 'ar' 
            ? `تمت الموافقة من المستوى ${currentOrder} - تم التمرير للمستوى ${nextAdminOrder}`
            : `Approved by level ${currentOrder} - passed to level ${nextAdminOrder}`,
        });

        // Send notification to next level admins
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_created",
            ticketId: ticketId,
            adminOrder: nextAdminOrder,
            isPurchasePhase: nextIsPurchasePhase,
          },
        });

        toast({
          title: language === 'ar' ? 'تم' : 'Success',
          description: language === 'ar' ? 'تم تمرير التذكرة للمستوى التالي' : 'Ticket passed to next approval level',
        });
      } else {
        // No more admins - fully approve the ticket
        const { error } = await supabase
          .from("tickets")
          .update({
            ...updateData,
            approved_at: new Date().toISOString(),
            approved_by: user.id,
            status: "In Progress",
          })
          .eq("id", ticketId);

        if (error) throw error;

        // Log the final approval action
        await supabase.from("ticket_activity_logs").insert({
          ticket_id: ticketId,
          activity_type: "approved",
          user_id: user.id,
          user_name: userProfile?.user_name || user.email,
          description: language === 'ar' 
            ? `تمت الموافقة النهائية من المستوى ${currentOrder}`
            : `Final approval by level ${currentOrder}`,
        });

        // AUTO-CREATE EXPENSE REQUEST only for 'expense' type purchase tickets
        const { data: freshTicket } = await supabase
          .from("tickets")
          .select("purchase_type")
          .eq("id", ticketId)
          .single();

        if (ticket.is_purchase_ticket && ticket.budget_value && freshTicket?.purchase_type === 'expense') {
          const date = new Date();
          const requestNumber = `EXP${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}${date.getHours().toString().padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}${date.getSeconds().toString().padStart(2, "0")}`;
          
          // Fetch currency rate for base currency conversion
          let exchangeRate: number | null = null;
          let baseCurrencyAmount: number | null = null;
          
          if (ticket.currency_id) {
            const { data: currencyRate } = await supabase
              .from("currency_rates")
              .select("rate_to_base, conversion_operator")
              .eq("currency_id", ticket.currency_id)
              .order("effective_date", { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (currencyRate) {
              exchangeRate = currencyRate.rate_to_base;
              if (currencyRate.conversion_operator === 'multiply') {
                baseCurrencyAmount = ticket.budget_value * currencyRate.rate_to_base;
              } else {
                baseCurrencyAmount = ticket.budget_value / currencyRate.rate_to_base;
              }
            }
          }
          
          const { error: expenseError } = await supabase.from("expense_requests").insert({
            request_number: requestNumber,
            ticket_id: ticketId,
            description: ticket.subject,
            amount: ticket.budget_value,
            quantity: ticket.qty || 1,
            currency_id: ticket.currency_id || null,
            exchange_rate: exchangeRate,
            base_currency_amount: baseCurrencyAmount,
            requester_id: ticket.user_id,
            request_date: new Date().toISOString().split("T")[0],
            status: "pending",
            notes: language === 'ar' 
              ? `تم إنشاؤه تلقائياً من تذكرة الشراء رقم ${ticket.ticket_number}`
              : `Auto-created from purchase ticket ${ticket.ticket_number}`,
          });

          if (expenseError) {
            console.error("Error creating expense request:", expenseError);
          } else {
            console.log("Expense request created for ticket:", ticket.ticket_number);
          }
        }

        // Send notification to ticket creator
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_approved",
            ticketId: ticketId,
            recipientUserId: ticket.user_id,
          },
        });

        toast({
          title: language === 'ar' ? 'تم' : 'Success',
          description: language === 'ar' ? 'تمت الموافقة على التذكرة بالكامل' : 'Ticket fully approved',
        });
      }

      fetchTickets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAssign = async (ticketId: string, userId: string, ticket: Ticket) => {
    // Check if ticket is approved before allowing assignment
    if (!ticket.approved_at) {
      toast({
        title: language === 'ar' ? 'غير مسموح' : 'Not Allowed',
        description: language === 'ar' 
          ? 'يجب إكمال جميع خطوات الموافقة قبل التعيين' 
          : 'All approval steps must be completed before assignment',
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("tickets")
        .update({ assigned_to: userId })
        .eq("id", ticketId);

      if (error) throw error;

      // Auto-create a task for the assigned user
      const { error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: ticket.subject,
          description: ticket.description,
          department_id: ticket.department_id,
          assigned_to: userId,
          created_by: user?.id,
          status: 'todo',
          priority: ticket.priority === 'Low' ? 'low' : ticket.priority === 'Medium' ? 'medium' : ticket.priority === 'High' ? 'high' : 'urgent',
          ticket_id: ticketId
        });

      if (taskError) {
        console.error('Error creating task from ticket:', taskError);
      }

      // Send ticket assignment notification
      await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_assigned",
          ticketId: ticketId,
          recipientUserId: userId,
        },
      });

      // Send in-app notification for the task
      await supabase.from('notifications').insert({
        user_id: userId,
        title: language === 'ar' ? 'مهمة جديدة من تذكرة' : 'New Task from Ticket',
        message: language === 'ar' 
          ? `تم تعيين مهمة جديدة لك من تذكرة: ${ticket.subject}`
          : `A new task has been assigned to you from ticket: ${ticket.subject}`,
        type: 'task_assigned',
        ticket_id: ticketId,
        is_read: false
      });

      // Send push notification for the task
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: userId,
            title: language === 'ar' ? 'مهمة جديدة من تذكرة' : 'New Task from Ticket',
            body: language === 'ar' 
              ? `تم تعيين مهمة جديدة لك: ${ticket.subject}`
              : `A new task has been assigned to you: ${ticket.subject}`,
            data: { type: 'task_assigned', ticketId: ticketId }
          }
        });
      } catch (pushErr) {
        console.error('Push notification error:', pushErr);
      }

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تم تعيين التذكرة وإنشاء مهمة' : 'Ticket assigned and task created',
      });

      fetchTickets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenActivityLog = (ticket: Ticket) => {
    setSelectedTicketForLog({ id: ticket.id, number: ticket.ticket_number });
    setActivityLogOpen(true);
  };

  const handleDelete = async () => {
    if (!ticketToDelete) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(language === 'ar' ? "غير مصرح" : "Not authenticated");

      // Soft delete: mark as deleted instead of removing from database
      const { error } = await supabase
        .from("tickets")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq("id", ticketToDelete);

      if (error) throw error;

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' ? "تم حذف التذكرة بنجاح" : "Ticket deleted successfully",
      });

      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: newStatus })
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' 
          ? 'تم تحديث حالة التذكرة' 
          : 'Ticket status updated successfully',
      });

      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTogglePurchaseTicket = async (ticketId: string, isPurchase: boolean) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ is_purchase_ticket: isPurchase })
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' 
          ? `تم ${isPurchase ? 'تحديد' : 'إلغاء'} التذكرة كتذكرة مشتريات` 
          : `Ticket ${isPurchase ? 'marked' : 'unmarked'} as purchase ticket`,
      });

      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleQuickComment = async (ticketId: string) => {
    const comment = quickComment[ticketId];
    if (!comment?.trim()) return;

    try {
      setSubmittingComment(ticketId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get ticket info for approval level
      const ticket = tickets.find(t => t.id === ticketId);

      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // Add regular comment
      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        user_id: user.id,
        comment: comment,
        is_internal: false,
      });

      if (error) throw error;

      // Also add as workflow note
      await supabase.from("ticket_workflow_notes").insert({
        ticket_id: ticketId,
        user_id: user.id,
        user_name: profile?.user_name || "Unknown",
        note: comment,
        approval_level: ticket?.next_admin_order ?? 0,
        activity_type: "admin_comment",
      });

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إضافة التعليق' : 'Comment added successfully',
      });

      setQuickComment(prev => ({ ...prev, [ticketId]: "" }));
      setExpandedTicket(null);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(null);
    }
  };

  const handleSendBackForClarification = async () => {
    const ticket = sendBackDialog.ticket;
    if (!ticket || !sendBackComment.trim()) return;

    try {
      setSendingBack(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // Update ticket
      await supabase.from("tickets").update({
        returned_for_clarification: true,
        returned_by: userProfile?.user_name || user.id,
        returned_at: new Date().toISOString(),
        returned_comment: sendBackComment,
        status: "Open",
      }).eq("id", ticket.id);

      // Add workflow note
      await supabase.from("ticket_workflow_notes").insert({
        ticket_id: ticket.id,
        user_id: user.id,
        user_name: userProfile?.user_name || "Unknown",
        note: `تم إرجاع التذكرة للتوضيح: ${sendBackComment}`,
        approval_level: ticket.next_admin_order ?? 0,
        activity_type: "returned_for_clarification",
      });

      // Activity log
      await supabase.from("ticket_activity_logs").insert({
        ticket_id: ticket.id,
        activity_type: "returned_for_clarification",
        user_id: user.id,
        user_name: userProfile?.user_name || "Unknown",
        recipient_id: ticket.user_id,
        recipient_name: ticket.profiles.user_name,
        description: `تم إرجاع التذكرة للتوضيح بواسطة ${userProfile?.user_name}: ${sendBackComment}`,
      });

      // Send notification + email
      await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_returned",
          ticketId: ticket.id,
          recipientUserId: ticket.user_id,
          returnComment: sendBackComment,
        },
      });

      toast({
        title: language === 'ar' ? 'تم الإرجاع' : 'Sent Back',
        description: language === 'ar' ? 'تم إرجاع التذكرة للتوضيح بنجاح' : 'Ticket returned for clarification',
      });

      setSendBackDialog({ open: false, ticket: null });
      setSendBackComment("");
      fetchTickets();
    } catch (error: any) {
      console.error("Error sending back ticket:", error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingBack(false);
    }
  };

  const handleRejectTicket = async () => {
    const ticket = rejectDialog.ticket;
    if (!ticket || !rejectReason.trim()) return;

    try {
      setRejecting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // Update ticket status to Rejected
      await supabase.from("tickets").update({
        status: "Rejected",
      }).eq("id", ticket.id);

      // Add workflow note
      await supabase.from("ticket_workflow_notes").insert({
        ticket_id: ticket.id,
        user_id: user.id,
        user_name: userProfile?.user_name || "Unknown",
        note: `تم رفض التذكرة: ${rejectReason}`,
        approval_level: ticket.next_admin_order ?? 0,
        activity_type: "rejected",
      });

      // Activity log
      await supabase.from("ticket_activity_logs").insert({
        ticket_id: ticket.id,
        activity_type: "rejected",
        user_id: user.id,
        user_name: userProfile?.user_name || "Unknown",
        recipient_id: ticket.user_id,
        recipient_name: ticket.profiles.user_name,
        description: `تم رفض التذكرة بواسطة ${userProfile?.user_name}: ${rejectReason}`,
      });

      // Send notification + email to creator
      await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_rejected",
          ticketId: ticket.id,
          recipientUserId: ticket.user_id,
          rejectReason: rejectReason,
        },
      });

      toast({
        title: language === 'ar' ? 'تم الرفض' : 'Rejected',
        description: language === 'ar' ? 'تم رفض التذكرة وإشعار مقدم الطلب' : 'Ticket rejected and creator notified',
      });

      setRejectDialog({ open: false, ticket: null });
      setRejectReason("");
      fetchTickets();
    } catch (error: any) {
      console.error("Error rejecting ticket:", error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const handleResendNotification = async (ticket: Ticket) => {
    try {
      // Get the current approval level from ticket or default to 0 (admin_order starts at 0)
      const currentOrder = ticket.next_admin_order ?? 0;

      // Determine if we're in the purchase admin phase
      // First check if there are any regular admins at the current level
      const { data: regularAdmins } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id)
        .eq("admin_order", currentOrder)
        .eq("is_purchase_admin", false);

      // If no regular admins at this level, check for purchase admins
      const { data: purchaseAdmins } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id)
        .eq("admin_order", currentOrder)
        .eq("is_purchase_admin", true);

      // Determine which phase we're in
      let isPurchasePhase = false;
      if (regularAdmins && regularAdmins.length > 0) {
        isPurchasePhase = false;
      } else if (purchaseAdmins && purchaseAdmins.length > 0) {
        isPurchasePhase = true;
      } else {
        throw new Error(language === 'ar' ? `لم يتم العثور على مسؤولين في المستوى ${currentOrder}` : `No admins found at level ${currentOrder}`);
      }

      // Send notification to admins at current approval level
      const { error: notificationError } = await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_created",
          ticketId: ticket.id,
          adminOrder: currentOrder,
          isPurchasePhase: isPurchasePhase,
        },
      });

      if (notificationError) throw notificationError;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إرسال الإشعار بنجاح' : 'Notification resent successfully',
      });
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent": return "destructive";
      case "High": return "destructive";
      case "Medium": return "default";
      case "Low": return "secondary";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open": return "default";
      case "In Progress": return "default";
      case "Closed": return "secondary";
      default: return "default";
    }
  };

  const handleChangeDepartment = async () => {
    if (!changeDeptDialog.ticket || !newDepartmentId) return;
    
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ 
          department_id: newDepartmentId,
          next_admin_order: 0, // Reset approval chain to first admin (order 0)
          approved_at: null,
          approved_by: null
        })
        .eq("id", changeDeptDialog.ticket.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم تغيير القسم بنجاح' : 'Department changed successfully',
      });

      setChangeDeptDialog({ open: false, ticket: null });
      setNewDepartmentId("");
      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReverseApproval = async () => {
    if (!reverseApprovalDialog.ticket) return;
    
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ 
          next_admin_order: 0, // Reset to first approval level (order 0)
          approved_at: null,
          approved_by: null,
          status: "Open"
        })
        .eq("id", reverseApprovalDialog.ticket.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إلغاء الموافقات بنجاح' : 'Approvals reversed successfully',
      });

      setReverseApprovalDialog({ open: false, ticket: null });
      fetchTickets();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Get pending approver user_ids for a ticket (next-in-chain approvers)
  const getPendingApproverIds = (ticket: Ticket): string[] => {
    if (ticket.approved_at) return [];
    const deptAdmins = allDepartmentAdmins.filter(a => a.department_id === ticket.department_id);
    const nextOrder = ticket.next_admin_order ?? 0;

    if (!ticket.is_purchase_ticket) {
      return deptAdmins
        .filter(a => !a.is_purchase_admin && a.admin_order === nextOrder)
        .map(a => a.user_id);
    }
    const regularAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
    if (regularAtOrder.length > 0) {
      return regularAtOrder.map(a => a.user_id);
    }
    return deptAdmins
      .filter(a => a.is_purchase_admin && a.admin_order === nextOrder)
      .map(a => a.user_id);
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus !== "all" && ticket.status !== filterStatus) return false;
    if (filterPriority !== "all" && ticket.priority !== filterPriority) return false;
    if (filterDepartment !== "all" && ticket.department_id !== filterDepartment) return false;
    if (filterPendingApprover !== "all") {
      const pendingIds = getPendingApproverIds(ticket);
      if (!pendingIds.includes(filterPendingApprover)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = ticket.subject?.toLowerCase().includes(q);
      const matchDescription = ticket.description?.toLowerCase().includes(q);
      const matchUser = ticket.profiles?.user_name?.toLowerCase().includes(q);
      const matchTicketNumber = ticket.ticket_number?.toLowerCase().includes(q);
      if (!matchSubject && !matchDescription && !matchUser && !matchTicketNumber) return false;
    }
    return true;
  });

  // Get unique departments from tickets for the filter
  const uniqueDepartments = Array.from(
    new Map(tickets.map(t => [t.department_id, t.departments.department_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  // Build unique pending approvers list across currently visible tickets (before this filter)
  const pendingApproverOptions = (() => {
    const map = new Map<string, string>();
    tickets.forEach(t => {
      if (t.approved_at) return;
      if (t.status === "Closed" || t.status === "Cancelled" || t.status === "Rejected") return;
      const ids = getPendingApproverIds(t);
      ids.forEach(uid => {
        const admin = allDepartmentAdmins.find(a => a.user_id === uid && a.department_id === t.department_id);
        if (admin?.user_name && !map.has(uid)) {
          map.set(uid, admin.user_name);
        }
      });
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const openTickets = filteredTickets.filter(t => t.status === "Open");
  const inProgressTickets = filteredTickets.filter(t => t.status === "In Progress");
  const closedTickets = filteredTickets.filter(t => t.status === "Closed");
  const cancelledTickets = filteredTickets.filter(t => t.status === "Cancelled");

  const TicketCard = ({ ticket }: { ticket: Ticket }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="space-y-2 flex-1">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <CardTitle className="text-base sm:text-lg">{ticket.subject}</CardTitle>
              <Badge variant={getPriorityColor(ticket.priority)} className="text-xs w-fit">
                {ticket.priority}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-2 items-center text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium">{ticket.ticket_number}</span>
              <span className="hidden sm:inline">•</span>
              <span>{ticket.departments.department_name}</span>
              <span className="hidden sm:inline">•</span>
              <span>{ticket.profiles.user_name}</span>
              <span className="hidden sm:inline">•</span>
              <span className="w-full sm:w-auto">{format(new Date(ticket.created_at), "PPp")}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {ticket.is_purchase_ticket && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <ShoppingCart className="h-3 w-3" />
                  {language === 'ar' ? 'مشتريات' : 'Purchase'}
                </Badge>
              )}
            </div>
            {ticket.external_link && (
              <div className="mt-2">
                <a 
                  href={ticket.external_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1"
                >
                  🔗 {language === 'ar' ? 'رابط خارجي' : 'External Link'}
                </a>
              </div>
            )}
            {/* Purchase ticket details */}
            {ticket.is_purchase_ticket && (ticket.budget_value !== null || ticket.qty !== null) && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs sm:text-sm">
                {ticket.budget_value !== null && (
                  <span className="text-muted-foreground">
                    {language === 'ar' ? 'الميزانية:' : 'Budget:'} <span className="font-medium text-foreground">{ticket.currency?.currency_code || ''} {ticket.budget_value?.toLocaleString()}</span>
                  </span>
                )}
                {ticket.qty !== null && (
                  <span className="text-muted-foreground">
                    {language === 'ar' ? 'الكمية:' : 'Qty:'} <span className="font-medium text-foreground">{ticket.qty} {ticket.uom || ''}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
        {/* Under Clarification Banner */}
        {(ticket as any).returned_for_clarification && (
          <div className="mb-3 p-3 border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg space-y-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {language === 'ar' ? '↩️ تحت التوضيح' : '↩️ Under Clarification'}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300">
              {language === 'ar' 
                ? `تم إرجاعها من ${(ticket as any).returned_by || ''} إلى ${ticket.profiles.user_name}`
                : `Returned by ${(ticket as any).returned_by || ''} to ${ticket.profiles.user_name}`}
            </p>
            {(ticket as any).returned_comment && (
              <p className="text-xs text-muted-foreground">
                <strong>{language === 'ar' ? 'السبب:' : 'Reason:'}</strong> {(ticket as any).returned_comment}
              </p>
            )}
          </div>
        )}

        <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
          {ticket.description}
        </p>
        
        {ticket.assigned_user && (
          <div className="mb-3 p-2 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground">{language === 'ar' ? 'معين إلى' : 'Assigned to'}:</p>
            <p className="text-sm font-medium">{ticket.assigned_user.user_name}</p>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={ticket.status}
            onValueChange={(value) => handleStatusChange(ticket.id, value)}
          >
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">{language === 'ar' ? 'مفتوح' : 'Open'}</SelectItem>
              <SelectItem value="In Progress">{language === 'ar' ? 'قيد المعالجة' : 'In Progress'}</SelectItem>
              <SelectItem value="Rejected">{language === 'ar' ? 'مرفوض' : 'Rejected'}</SelectItem>
              <SelectItem value="Closed">{language === 'ar' ? 'مغلق' : 'Closed'}</SelectItem>
              <SelectItem value="Cancelled">{language === 'ar' ? 'ملغي' : 'Cancelled'}</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-muted rounded-md border text-xs sm:text-sm">
            <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            <span className="hidden sm:inline">
              {language === 'ar' ? 'مشتريات' : 'Purchase'}
            </span>
            <Switch
              checked={ticket.is_purchase_ticket}
              onCheckedChange={(checked) => handleTogglePurchaseTicket(ticket.id, checked)}
            />
          </div>
          
          {canUserApprove(ticket) && !(ticket as any).returned_for_clarification && ticket.status !== 'Rejected' && (
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleApprove(ticket.id)}
            >
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {language === 'ar' ? 'موافقة' : 'Approve'}
            </Button>
          )}

          {canUserApprove(ticket) && !(ticket as any).returned_for_clarification && ticket.status !== 'Rejected' && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs sm:text-sm"
              onClick={() => setRejectDialog({ open: true, ticket })}
            >
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {language === 'ar' ? 'رفض' : 'Reject'}
            </Button>
          )}
          
          {ticket.approved_at && (
            <Badge variant="secondary" className="text-xs">
              {language === 'ar' ? 'تمت الموافقة' : 'Approved'}
            </Badge>
          )}
          
          {!ticket.approved_at && !canUserApprove(ticket) && (
            <div className="flex flex-col gap-1">
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                {language === 'ar' ? 'بانتظار موافقة' : 'Awaiting approval from'}:
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                {getApproverNames(ticket).join(', ') || (language === 'ar' ? 'غير محدد' : 'Not specified')}
              </span>
            </div>
          )}
          
          <Select
            value={ticket.assigned_to || ""}
            onValueChange={(value) => handleAssign(ticket.id, value, ticket)}
            disabled={!ticket.approved_at}
          >
            <SelectTrigger className={cn(
              "w-full sm:w-[150px] h-8 text-xs sm:text-sm",
              !ticket.approved_at && "opacity-50 cursor-not-allowed"
            )}>
              <SelectValue placeholder={language === 'ar' ? 'تعيين' : 'Assign'} />
            </SelectTrigger>
            <SelectContent>
              {departmentMembers[ticket.department_id]?.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.profiles.user_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Collapsible
            open={expandedTicket === ticket.id}
            onOpenChange={(open) => setExpandedTicket(open ? ticket.id : null)}
            className="w-full sm:w-auto"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs sm:text-sm w-full sm:w-auto"
              >
                <MessageSquare className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                {language === 'ar' ? 'تعليق' : 'Comment'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <Textarea
                  placeholder={language === 'ar' ? 'اكتب تعليقك هنا...' : 'Write your comment here...'}
                  value={quickComment[ticket.id] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQuickComment(prev => ({ ...prev, [ticket.id]: value }));
                  }}
                  onBlur={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="min-h-[80px] bg-background text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleQuickComment(ticket.id)}
                    disabled={submittingComment === ticket.id || !quickComment[ticket.id]?.trim()}
                    size="sm"
                    className="h-8 text-xs sm:text-sm flex-1 sm:flex-none"
                  >
                    <Send className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    {submittingComment === ticket.id ? (language === 'ar' ? 'إرسال...' : 'Sending...') : (language === 'ar' ? 'إرسال' : 'Send')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs sm:text-sm flex-1 sm:flex-none"
                    onClick={() => setExpandedTicket(null)}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs sm:text-sm"
            onClick={() => handleResendNotification(ticket)}
          >
            <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'إرسال' : 'Resend'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs sm:text-sm"
            onClick={() => handleOpenActivityLog(ticket)}
          >
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'سجل' : 'Log'}</span>
          </Button>

          {/* Change Department button - only for not fully approved tickets */}
          {!ticket.approved_at && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs sm:text-sm"
              onClick={() => {
                setChangeDeptDialog({ open: true, ticket });
                setNewDepartmentId(ticket.department_id);
              }}
            >
              <ArrowRightLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'نقل' : 'Move'}</span>
            </Button>
          )}

          {/* Reverse Approval button - for tickets that have partial approval (next_admin_order > 0 or approved_at set) */}
          {((ticket.next_admin_order ?? 0) > 0 || ticket.approved_at) && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs sm:text-sm text-amber-600 border-amber-600 hover:bg-amber-50"
              onClick={() => setReverseApprovalDialog({ open: true, ticket })}
            >
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'عكس الموافقة' : 'Reverse'}</span>
            </Button>
          )}

          {!(ticket as any).returned_for_clarification && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs sm:text-sm text-orange-600 border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
              onClick={() => setSendBackDialog({ open: true, ticket })}
            >
              <Undo2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'إرجاع' : 'Return'}</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs sm:text-sm"
            onClick={() => navigate(`/tickets/${ticket.id}`, { state: { from: '/admin-tickets' } })}
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'عرض' : 'View'}</span>
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs sm:text-sm"
              onClick={() => {
                setTicketToDelete(ticket.id);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-2">{language === 'ar' ? 'حذف' : 'Delete'}</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {language === 'ar' ? 'تذاكر الأقسام' : 'Department Tickets'}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {language === 'ar' ? 'إدارة التذاكر لأقسامك' : 'Manage tickets for your departments'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'بحث بالموضوع، الوصف، المستخدم...' : 'Search subject, description, user...'}
            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="w-full sm:w-[200px] h-9 text-sm">
            <SelectValue placeholder={language === 'ar' ? 'القسم' : 'Department'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'جميع الأقسام' : 'All Departments'}</SelectItem>
            {uniqueDepartments.map(dept => (
              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
            <SelectValue placeholder={language === 'ar' ? 'الأولوية' : 'Priority'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
            <SelectItem value="Urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
            <SelectItem value="High">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
            <SelectItem value="Medium">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
            <SelectItem value="Low">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPendingApprover} onValueChange={setFilterPendingApprover}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm">
            <SelectValue placeholder={language === 'ar' ? 'بانتظار موافقة' : 'Pending Approval From'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'كل الموافقين' : 'All Approvers'}</SelectItem>
            {pendingApproverOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8">{language === 'ar' ? 'جاري التحميل...' : 'Loading tickets...'}</div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {language === 'ar' ? 'لم يتم العثور على تذاكر لأقسامك' : 'No tickets found for your departments'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="open" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="open" className="text-xs sm:text-sm px-2 sm:px-3">
              {language === 'ar' ? `مفتوح (${openTickets.length})` : `Open (${openTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="text-xs sm:text-sm px-2 sm:px-3">
              {language === 'ar' ? `معالجة (${inProgressTickets.length})` : `Progress (${inProgressTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs sm:text-sm px-2 sm:px-3">
              {language === 'ar' ? `مغلق (${closedTickets.length})` : `Closed (${closedTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs sm:text-sm px-2 sm:px-3">
              {language === 'ar' ? `ملغي (${cancelledTickets.length})` : `Cancelled (${cancelledTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs sm:text-sm px-2 sm:px-3">
              {language === 'ar' ? `الكل (${filteredTickets.length})` : `All (${filteredTickets.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="space-y-4">
            {openTickets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد تذاكر مفتوحة' : 'No open tickets'}</p>
                </CardContent>
              </Card>
            ) : (
              openTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-4">
            {inProgressTickets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد تذاكر قيد المعالجة' : 'No tickets in progress'}</p>
                </CardContent>
              </Card>
            ) : (
              inProgressTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="closed" className="space-y-4">
            {closedTickets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد تذاكر مغلقة' : 'No closed tickets'}</p>
                </CardContent>
              </Card>
            ) : (
              closedTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            {cancelledTickets.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">{language === 'ar' ? 'لا توجد تذاكر ملغية' : 'No cancelled tickets'}</p>
                </CardContent>
              </Card>
            ) : (
              cancelledTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {filteredTickets.map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'سيتم وضع علامة على هذه التذكرة على أنها محذوفة. يمكن للمسؤولين فقط عرض التذاكر المحذوفة.'
                : 'This ticket will be marked as deleted. Only admins can view deleted tickets.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Department Dialog */}
      <AlertDialog open={changeDeptDialog.open} onOpenChange={(open) => {
        if (!open) {
          setChangeDeptDialog({ open: false, ticket: null });
          setNewDepartmentId("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تغيير القسم' : 'Change Department'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'اختر القسم الجديد للتذكرة. سيتم إعادة تعيين سلسلة الموافقات.'
                : 'Select the new department for this ticket. The approval chain will be reset.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={newDepartmentId} onValueChange={setNewDepartmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select Department'} />
              </SelectTrigger>
              <SelectContent>
                {allDepartments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleChangeDepartment}
              disabled={!newDepartmentId || newDepartmentId === changeDeptDialog.ticket?.department_id}
            >
              {language === 'ar' ? 'تأكيد' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTicketForLog && (
        <TicketActivityLogDialog
          open={activityLogOpen}
          onOpenChange={setActivityLogOpen}
          ticketId={selectedTicketForLog.id}
          ticketNumber={selectedTicketForLog.number}
        />
      )}

      {/* Reverse Approval Dialog */}
      <AlertDialog open={reverseApprovalDialog.open} onOpenChange={(open) => {
        if (!open) {
          setReverseApprovalDialog({ open: false, ticket: null });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'عكس الموافقة' : 'Reverse Approval'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'سيتم إلغاء جميع الموافقات وإعادة التذكرة للحالة الأولى. هل تريد المتابعة؟'
                : 'All approvals will be reversed and the ticket will be reset to initial state. Do you want to continue?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverseApproval}>
              {language === 'ar' ? 'تأكيد' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Cost Center Selection Dialog */}
      <Dialog open={costCenterDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCostCenterDialogOpen(false);
          setPendingApprovalTicketId(null);
          setSelectedCostCenterId("");
          setSelectedPurchaseType("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {language === 'ar' ? 'تحديد مركز التكلفة ونوع الشراء' : 'Select Cost Center & Purchase Type'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'يرجى تحديد مركز التكلفة ونوع الشراء للمتابعة مع الموافقة'
                : 'Please select a cost center and purchase type to continue with approval'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Cost Center Selection */}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'مركز التكلفة' : 'Cost Center'}</Label>
              <Select value={selectedCostCenterId} onValueChange={setSelectedCostCenterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={language === 'ar' ? 'اختر مركز التكلفة...' : 'Select cost center...'} />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.cost_center_code} - {cc.cost_center_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Purchase Type Selection */}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'نوع الشراء' : 'Purchase Type'}</Label>
              <RadioGroup value={selectedPurchaseType} onValueChange={setSelectedPurchaseType}>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="expense" id="expense" />
                  <Label htmlFor="expense" className="cursor-pointer">
                    {language === 'ar' ? 'مصروف (اشتراكات، خدمات)' : 'Expense (subscriptions, services)'}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="purchase" id="purchase" />
                  <Label htmlFor="purchase" className="cursor-pointer">
                    {language === 'ar' ? 'شراء (معدات، أجهزة)' : 'Purchase (equipment, hardware)'}
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCostCenterDialogOpen(false);
                setPendingApprovalTicketId(null);
                setSelectedCostCenterId("");
                setSelectedPurchaseType("");
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={() => {
                if (pendingApprovalTicketId && selectedCostCenterId && selectedPurchaseType) {
                  setCostCenterDialogOpen(false);
                  handleApprove(pendingApprovalTicketId, selectedCostCenterId, selectedPurchaseType);
                  setPendingApprovalTicketId(null);
                  setSelectedCostCenterId("");
                  setSelectedPurchaseType("");
                }
              }}
              disabled={!selectedCostCenterId || !selectedPurchaseType}
            >
              {language === 'ar' ? 'موافقة' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Send Back for Clarification Dialog */}
      <Dialog open={sendBackDialog.open} onOpenChange={(open) => {
        if (!open) {
          setSendBackDialog({ open: false, ticket: null });
          setSendBackComment("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'إرجاع التذكرة للتوضيح' : 'Return Ticket for Clarification'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `تذكرة: ${sendBackDialog.ticket?.ticket_number || ''}`
                : `Ticket: ${sendBackDialog.ticket?.ticket_number || ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'ملاحظات التوضيح المطلوبة' : 'Clarification Notes'}
            </label>
            <Textarea
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب ما تحتاج توضيحه...' : 'Describe what needs clarification...'}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSendBackDialog({ open: false, ticket: null });
                setSendBackComment("");
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSendBackForClarification}
              disabled={!sendBackComment.trim() || sendingBack}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              {sendingBack 
                ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...')
                : (language === 'ar' ? 'إرجاع للتوضيح' : 'Send Back')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Ticket Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => {
        if (!open) {
          setRejectDialog({ open: false, ticket: null });
          setRejectReason("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'رفض التذكرة' : 'Reject Ticket'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `تذكرة: ${rejectDialog.ticket?.ticket_number || ''}`
                : `Ticket: ${rejectDialog.ticket?.ticket_number || ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {language === 'ar' ? 'سبب الرفض' : 'Rejection Reason'}
            </label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب سبب رفض التذكرة...' : 'Describe the reason for rejection...'}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialog({ open: false, ticket: null });
                setRejectReason("");
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleRejectTicket}
              disabled={!rejectReason.trim() || rejecting}
              variant="destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {rejecting 
                ? (language === 'ar' ? 'جاري الرفض...' : 'Rejecting...')
                : (language === 'ar' ? 'رفض التذكرة' : 'Reject Ticket')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTickets;
