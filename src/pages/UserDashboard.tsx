import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  CheckSquare, 
  Ticket, 
  Calendar as CalendarIcon, 
  Mail, 
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  MessageSquare,
  ShoppingCart,
  FileText,
  Newspaper,
  Settings,
  X,
  Save,
  Trash2,
  Edit2,
  Copy,
  Users,
  Eye,
  EyeOff,
  ClipboardList,
  Reply,
  ReplyAll,
  Forward,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import GridLayoutLib from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

// Cast to any to bypass type issues with react-grid-layout
const ReactGridLayout = GridLayoutLib as any;

// Layout item interface
interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  department_name?: string;
}

interface AssignedTicket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  department_name?: string;
}

interface ShiftAssignment {
  id: string;
  assignment_date: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  color: string;
  has_session: boolean;
  session_status?: string;
}

interface UnreadEmail {
  id: string;
  subject: string;
  from_address: string;
  from_name: string | null;
  email_date: string;
}

interface FullEmail {
  id: string;
  subject: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: any;
  cc_addresses: any;
  body_text: string | null;
  body_html: string | null;
  email_date: string;
  is_read: boolean;
  is_starred: boolean;
}

interface UnreadInternalMessage {
  id: string;
  message_text: string | null;
  created_at: string;
  sender_name: string;
  conversation_id: string;
}

interface UserTicket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  department_name?: string;
}

interface CompanyNewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
}

interface ShiftFollowUpItem {
  id: string;
  user_name: string;
  shift_name: string;
  assignment_date: string;
  color: string;
  session_status: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

interface UserProfile {
  user_id: string;
  user_name: string;
}

// Default widget names
const DEFAULT_WIDGET_NAMES: Record<string, { ar: string; en: string }> = {
  news: { ar: "أخبار الشركة", en: "Company News" },
  messages: { ar: "رسائل تواصل", en: "Tawasoul" },
  tasks: { ar: "المهام", en: "Tasks" },
  assignedTickets: { ar: "التذاكر المعينة", en: "Assigned Tickets" },
  purchaseTickets: { ar: "طلبات الشراء", en: "Purchase Requests" },
  normalTickets: { ar: "طلبات الدعم", en: "Support Requests" },
  shifts: { ar: "الورديات", en: "Shifts" },
  emails: { ar: "رسائل البريد غير المقروءة", en: "Unread Emails" },
  shiftFollowUp: { ar: "متابعة الورديات", en: "Shift Follow Up" },
};

// Default layout configuration
const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "news", x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
  { i: "messages", x: 0, y: 3, w: 3, h: 6, minW: 2, minH: 3 },
  { i: "tasks", x: 3, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "assignedTickets", x: 6, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "purchaseTickets", x: 9, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "normalTickets", x: 3, y: 6, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "shifts", x: 6, y: 6, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "shiftFollowUp", x: 9, y: 6, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "emails", x: 0, y: 9, w: 12, h: 3, minW: 4, minH: 2 },
];

const LAYOUT_STORAGE_KEY = "user-dashboard-layout";
const HIDDEN_WIDGETS_STORAGE_KEY = "user-dashboard-hidden-widgets";
const WIDGET_NAMES_STORAGE_KEY = "user-dashboard-widget-names";

const UserDashboard = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<AssignedTicket[]>([]);
  const [purchaseTickets, setPurchaseTickets] = useState<UserTicket[]>([]);
  const [normalTickets, setNormalTickets] = useState<UserTicket[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [unreadEmails, setUnreadEmails] = useState<UnreadEmail[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<UnreadInternalMessage[]>([]);
  const [companyNews, setCompanyNews] = useState<CompanyNewsItem[]>([]);
  const [shiftFollowUpData, setShiftFollowUpData] = useState<ShiftFollowUpItem[]>([]);
  const [shiftFollowUpDate, setShiftFollowUpDate] = useState<Date>(new Date());
  
  // Layout customization state
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [widgetNames, setWidgetNames] = useState<Record<string, string>>({});
  const [containerWidth, setContainerWidth] = useState(1200);
  
  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameWidgetId, setRenameWidgetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  
  // Copy to users dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [copyLoading, setCopyLoading] = useState(false);
  
  // Email detail dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedFullEmail, setSelectedFullEmail] = useState<FullEmail | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; department_name: string }[]>([]);

  // Load saved layout, hidden widgets, and names on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        // Merge with default to ensure new widgets are included
        const defaultIds = DEFAULT_LAYOUT.map(l => l.i);
        const savedIds = parsed.map((l: LayoutItem) => l.i);
        const mergedLayout = [...parsed];
        DEFAULT_LAYOUT.forEach(defaultItem => {
          if (!savedIds.includes(defaultItem.i)) {
            mergedLayout.push(defaultItem);
          }
        });
        setLayout(mergedLayout);
      } catch (e) {
        console.error("Failed to parse saved layout:", e);
      }
    }
    
    const savedHidden = localStorage.getItem(HIDDEN_WIDGETS_STORAGE_KEY);
    if (savedHidden) {
      try {
        setHiddenWidgets(JSON.parse(savedHidden));
      } catch (e) {
        console.error("Failed to parse hidden widgets:", e);
      }
    }
    
    const savedNames = localStorage.getItem(WIDGET_NAMES_STORAGE_KEY);
    if (savedNames) {
      try {
        setWidgetNames(JSON.parse(savedNames));
      } catch (e) {
        console.error("Failed to parse widget names:", e);
      }
    }
  }, []);

  // Handle container resize
  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById("dashboard-container");
      if (container) {
        setContainerWidth(container.offsetWidth - 48);
      }
    };
    
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    fetchUserData();
  }, []);

  // Real-time subscription for internal messages
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('dashboard-internal-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages'
        },
        () => {
          // Refresh unread messages when new message arrives
          fetchUnreadMessages(currentUserId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_messages'
        },
        () => {
          // Refresh when messages are marked as read
          fetchUnreadMessages(currentUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Poll unread emails every 30 seconds to keep the widget up-to-date
  useEffect(() => {
    if (!currentUserId) return;

    // immediate refresh when user id becomes available
    fetchUnreadEmails(currentUserId);

    const intervalId = window.setInterval(() => {
      fetchUnreadEmails(currentUserId);
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [currentUserId]);
  
  useEffect(() => {
    if (currentUserId) {
      fetchShiftFollowUp(shiftFollowUpDate);
    }
  }, [shiftFollowUpDate, currentUserId]);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setUserName(profile.user_name);
      }

      await Promise.all([
        fetchTasks(user.id),
        fetchTickets(user.id),
        fetchPurchaseTickets(user.id),
        fetchNormalTickets(user.id),
        fetchShifts(user.id),
        fetchUnreadEmails(user.id),
        fetchUnreadMessages(user.id),
        fetchCompanyNews(),
        fetchShiftFollowUp(shiftFollowUpDate)
      ]);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (userId: string) => {
    const { data } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        status,
        priority,
        deadline,
        departments:department_id (department_name)
      `)
      .eq("assigned_to", userId)
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setTasks(data.map(t => ({
        ...t,
        department_name: (t.departments as any)?.department_name
      })));
    }
  };

  const fetchTickets = async (userId: string) => {
    const { data } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        created_at,
        departments:department_id (department_name)
      `)
      .eq("assigned_to", userId)
      .eq("is_deleted", false)
      .neq("status", "Closed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setTickets(data.map(t => ({
        ...t,
        department_name: (t.departments as any)?.department_name
      })));
    }
  };

  const fetchPurchaseTickets = async (userId: string) => {
    // Get ALL departments where user is an admin (regular or purchase)
    const { data: adminDepts } = await supabase
      .from("department_admins")
      .select("department_id")
      .eq("user_id", userId);

    const adminDeptIds = adminDepts?.map(d => d.department_id) || [];

    let allTickets: any[] = [];

    // Query 1: Tickets in departments where user is admin, pending approval (not closed)
    if (adminDeptIds.length > 0) {
      const { data: pendingApproval } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_number,
          subject,
          status,
          priority,
          created_at,
          departments:department_id (department_name)
        `)
        .in("department_id", adminDeptIds)
        .eq("is_purchase_ticket", true)
        .eq("is_deleted", false)
        .neq("status", "Closed")
        .neq("status", "Rejected")
        .order("created_at", { ascending: false })
        .limit(20);

      if (pendingApproval) {
        allTickets = [...allTickets, ...pendingApproval];
      }
    }

    // Query 2: Tickets approved by this user but not closed
    const { data: approvedByUser } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        created_at,
        departments:department_id (department_name)
      `)
      .eq("approved_by", userId)
      .eq("is_purchase_ticket", true)
      .eq("is_deleted", false)
      .neq("status", "Closed")
      .neq("status", "Rejected")
      .order("created_at", { ascending: false })
      .limit(20);

    if (approvedByUser) {
      const existingIds = new Set(allTickets.map(t => t.id));
      approvedByUser.forEach(t => {
        if (!existingIds.has(t.id)) {
          allTickets.push(t);
        }
      });
    }

    // Query 3: User's own purchase tickets (created by them) not closed
    const { data: myRequests } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        created_at,
        departments:department_id (department_name)
      `)
      .eq("user_id", userId)
      .eq("is_purchase_ticket", true)
      .eq("is_deleted", false)
      .neq("status", "Closed")
      .neq("status", "Rejected")
      .order("created_at", { ascending: false })
      .limit(20);

    if (myRequests) {
      const existingIds = new Set(allTickets.map(t => t.id));
      myRequests.forEach(t => {
        if (!existingIds.has(t.id)) {
          allTickets.push(t);
        }
      });
    }

    // Sort by created_at descending and limit
    allTickets.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    allTickets = allTickets.slice(0, 15);

    setPurchaseTickets(allTickets.map(t => ({
      ...t,
      department_name: (t.departments as any)?.department_name
    })));
  };

  const fetchNormalTickets = async (userId: string) => {
    const { data } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        created_at,
        departments:department_id (department_name)
      `)
      .eq("user_id", userId)
      .eq("is_purchase_ticket", false)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setNormalTickets(data.map(t => ({
        ...t,
        department_name: (t.departments as any)?.department_name
      })));
    }
  };

  const fetchShifts = async (userId: string) => {
    const today = new Date();
    const startDate = format(today, "yyyy-MM-dd");
    const endDate = format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    const { data: assignments } = await supabase
      .from("shift_assignments")
      .select(`
        id,
        assignment_date,
        shifts:shift_id (
          shift_name,
          shift_start_time,
          shift_end_time,
          color
        ),
        shift_sessions (
          id,
          status
        )
      `)
      .eq("user_id", userId)
      .gte("assignment_date", startDate)
      .lte("assignment_date", endDate)
      .order("assignment_date", { ascending: true });

    if (assignments) {
      setShifts(assignments.map(a => ({
        id: a.id,
        assignment_date: a.assignment_date,
        shift_name: (a.shifts as any)?.shift_name || "",
        shift_start_time: (a.shifts as any)?.shift_start_time || "",
        shift_end_time: (a.shifts as any)?.shift_end_time || "",
        color: (a.shifts as any)?.color || "#3b82f6",
        has_session: (a.shift_sessions as any[])?.length > 0,
        session_status: (a.shift_sessions as any[])?.[0]?.status
      })));
    }
  };

  const fetchUnreadEmails = async (userId: string) => {
    const { data } = await supabase
      .from("emails")
      .select("id, subject, from_address, from_name, email_date")
      .eq("user_id", userId)
      .eq("is_read", false)
      .eq("folder", "INBOX")
      .order("email_date", { ascending: false })
      .limit(10);

    if (data) {
      setUnreadEmails(data);
    }
  };

  const fetchUnreadMessages = async (userId: string) => {
    const { data: participations } = await supabase
      .from("internal_conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      setUnreadMessages([]);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    const { data: messages } = await supabase
      .from("internal_messages")
      .select(`
        id,
        message_text,
        created_at,
        conversation_id,
        sender_id
      `)
      .in("conversation_id", conversationIds)
      .eq("is_read", false)
      .neq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (messages && messages.length > 0) {
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.user_name]) || []);

      setUnreadMessages(messages.map(m => ({
        id: m.id,
        message_text: m.message_text,
        created_at: m.created_at,
        sender_name: profileMap.get(m.sender_id) || "Unknown",
        conversation_id: m.conversation_id
      })));
    } else {
      setUnreadMessages([]);
    }
  };

  const fetchCompanyNews = async () => {
    const { data } = await supabase
      .from("company_news")
      .select("id, title, content, image_url, published_at, created_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(5);

    if (data) {
      setCompanyNews(data);
    }
  };
  
  const fetchShiftFollowUp = async (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    const { data: assignments } = await supabase
      .from("shift_assignments")
      .select(`
        id,
        assignment_date,
        user_id,
        shifts:shift_id (
          shift_name,
          color
        ),
        shift_sessions (
          id,
          status,
          opened_at,
          closed_at
        )
      `)
      .eq("assignment_date", dateStr)
      .order("created_at", { ascending: true });
      
    if (assignments && assignments.length > 0) {
      const userIds = [...new Set(assignments.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);
        
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.user_name]) || []);
      
      setShiftFollowUpData(assignments.map(a => ({
        id: a.id,
        user_name: profileMap.get(a.user_id) || "Unknown",
        shift_name: (a.shifts as any)?.shift_name || "",
        assignment_date: a.assignment_date,
        color: (a.shifts as any)?.color || "#3b82f6",
        session_status: (a.shift_sessions as any[])?.[0]?.status || null,
        opened_at: (a.shift_sessions as any[])?.[0]?.opened_at || null,
        closed_at: (a.shift_sessions as any[])?.[0]?.closed_at || null,
      })));
    } else {
      setShiftFollowUpData([]);
    }
  };
  
  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, user_name")
      .eq("is_active", true)
      .order("user_name");
      
    if (data) {
      setAllUsers(data.filter(u => u.user_id !== currentUserId));
    }
  };
  
  const fetchDepartments = async () => {
    const { data } = await supabase
      .from("departments")
      .select("id, department_name")
      .eq("is_active", true)
      .order("department_name");
    if (data) {
      setDepartments(data);
    }
  };
  
  const handleEmailClick = async (emailId: string) => {
    if (isEditMode) return;
    
    setEmailLoading(true);
    setEmailDialogOpen(true);
    
    try {
      // Fetch full email details
      const { data, error } = await supabase
        .from("emails")
        .select("id, subject, from_address, from_name, to_addresses, cc_addresses, body_text, body_html, email_date, is_read, is_starred")
        .eq("id", emailId)
        .single();
        
      if (error) throw error;
      
      setSelectedFullEmail(data);
      
      // Mark email as read
      if (!data.is_read) {
        await supabase
          .from("emails")
          .update({ is_read: true })
          .eq("id", emailId);
        
        // Update local state
        setUnreadEmails(prev => prev.filter(e => e.id !== emailId));
      }
      
      // Fetch departments for create ticket
      await fetchDepartments();
    } catch (error) {
      console.error("Error fetching email:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في تحميل البريد" : "Failed to load email",
        variant: "destructive"
      });
      setEmailDialogOpen(false);
    } finally {
      setEmailLoading(false);
    }
  };
  
  const handleDeleteEmail = async () => {
    if (!selectedFullEmail || !currentUserId) return;
    
    try {
      // Track deleted email
      await supabase
        .from("deleted_email_ids")
        .insert({
          message_id: selectedFullEmail.id,
          user_id: currentUserId
        });
      
      // Delete email
      await supabase
        .from("emails")
        .delete()
        .eq("id", selectedFullEmail.id);
      
      setUnreadEmails(prev => prev.filter(e => e.id !== selectedFullEmail.id));
      setEmailDialogOpen(false);
      setSelectedFullEmail(null);
      
      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف البريد بنجاح" : "Email deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting email:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في حذف البريد" : "Failed to delete email",
        variant: "destructive"
      });
    }
  };
  
  const handleCreateTicketFromEmail = () => {
    if (!selectedFullEmail) return;
    // Navigate to tickets with email data
    navigate("/tickets", { 
      state: { 
        fromEmail: true,
        emailSubject: selectedFullEmail.subject,
        emailBody: selectedFullEmail.body_text || selectedFullEmail.body_html,
        emailFrom: selectedFullEmail.from_address
      } 
    });
    setEmailDialogOpen(false);
  };
  
  const handleReplyEmail = () => {
    if (!selectedFullEmail) return;
    navigate("/email-manager", {
      state: {
        replyTo: selectedFullEmail.from_address,
        subject: `Re: ${selectedFullEmail.subject || ""}`,
        mode: "reply"
      }
    });
    setEmailDialogOpen(false);
  };
  
  const handleReplyAllEmail = () => {
    if (!selectedFullEmail) return;
    const toAddresses = Array.isArray(selectedFullEmail.to_addresses) 
      ? selectedFullEmail.to_addresses.join(", ") 
      : selectedFullEmail.to_addresses || "";
    navigate("/email-manager", {
      state: {
        replyTo: selectedFullEmail.from_address,
        cc: toAddresses,
        subject: `Re: ${selectedFullEmail.subject || ""}`,
        mode: "replyAll"
      }
    });
    setEmailDialogOpen(false);
  };
  
  const handleForwardEmail = () => {
    if (!selectedFullEmail) return;
    navigate("/email-manager", {
      state: {
        subject: `Fwd: ${selectedFullEmail.subject || ""}`,
        body: selectedFullEmail.body_html || selectedFullEmail.body_text,
        mode: "forward"
      }
    });
    setEmailDialogOpen(false);
  };

  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);
  }, []);

  const handleSaveLayout = () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    localStorage.setItem(HIDDEN_WIDGETS_STORAGE_KEY, JSON.stringify(hiddenWidgets));
    localStorage.setItem(WIDGET_NAMES_STORAGE_KEY, JSON.stringify(widgetNames));
    setIsEditMode(false);
    toast({
      title: language === "ar" ? "تم الحفظ" : "Layout Saved",
      description: language === "ar" ? "تم حفظ تخطيط لوحة التحكم بنجاح" : "Dashboard layout saved successfully",
    });
  };

  const handleResetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    setHiddenWidgets([]);
    setWidgetNames({});
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    localStorage.removeItem(HIDDEN_WIDGETS_STORAGE_KEY);
    localStorage.removeItem(WIDGET_NAMES_STORAGE_KEY);
    toast({
      title: language === "ar" ? "تم إعادة التعيين" : "Layout Reset",
      description: language === "ar" ? "تم إعادة تعيين التخطيط للوضع الافتراضي" : "Layout reset to default",
    });
  };
  
  const handleDeleteWidget = (widgetId: string) => {
    setHiddenWidgets(prev => [...prev, widgetId]);
  };
  
  const handleRestoreWidget = (widgetId: string) => {
    setHiddenWidgets(prev => prev.filter(id => id !== widgetId));
  };
  
  const handleOpenRenameDialog = (widgetId: string) => {
    setRenameWidgetId(widgetId);
    setRenameValue(getWidgetName(widgetId));
    setRenameDialogOpen(true);
  };
  
  const handleRenameWidget = () => {
    if (renameWidgetId && renameValue.trim()) {
      setWidgetNames(prev => ({
        ...prev,
        [renameWidgetId]: renameValue.trim()
      }));
      setRenameDialogOpen(false);
      setRenameWidgetId(null);
      setRenameValue("");
    }
  };
  
  const handleOpenCopyDialog = async () => {
    await fetchAllUsers();
    setSelectedUsers([]);
    setCopyDialogOpen(true);
  };
  
  const handleCopyToUsers = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "الرجاء اختيار مستخدم واحد على الأقل" : "Please select at least one user",
        variant: "destructive"
      });
      return;
    }
    
    setCopyLoading(true);
    try {
      // Store in system_settings with user_id prefix for each selected user
      for (const userId of selectedUsers) {
        const layoutKey = `dashboard_layout_${userId}`;
        
        // Check if setting exists
        const { data: existing } = await supabase
          .from("system_settings")
          .select("id")
          .eq("setting_key", layoutKey)
          .single();
          
        if (existing) {
          // Update existing
          await supabase
            .from("system_settings")
            .update({
              setting_value: { layout, hiddenWidgets, widgetNames } as any
            })
            .eq("setting_key", layoutKey);
        } else {
          // Insert new
          await supabase
            .from("system_settings")
            .insert({
              setting_key: layoutKey,
              setting_value: { layout, hiddenWidgets, widgetNames } as any
            });
        }
      }
      
      toast({
        title: language === "ar" ? "تم النسخ" : "Copied Successfully",
        description: language === "ar" 
          ? `تم نسخ التصميم إلى ${selectedUsers.length} مستخدم`
          : `Design copied to ${selectedUsers.length} user(s)`,
      });
      setCopyDialogOpen(false);
    } catch (error) {
      console.error("Error copying layout:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل نسخ التصميم" : "Failed to copy design",
        variant: "destructive"
      });
    } finally {
      setCopyLoading(false);
    }
  };
  
  const getWidgetName = (widgetId: string): string => {
    if (widgetNames[widgetId]) {
      return widgetNames[widgetId];
    }
    const defaultName = DEFAULT_WIDGET_NAMES[widgetId];
    return defaultName ? (language === "ar" ? defaultName.ar : defaultName.en) : widgetId;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      todo: { variant: "outline", label: language === "ar" ? "للتنفيذ" : "To Do" },
      in_progress: { variant: "default", label: language === "ar" ? "قيد التنفيذ" : "In Progress" },
      in_review: { variant: "secondary", label: language === "ar" ? "قيد المراجعة" : "In Review" },
      Open: { variant: "outline", label: language === "ar" ? "مفتوح" : "Open" },
      "In Progress": { variant: "default", label: language === "ar" ? "قيد التنفيذ" : "In Progress" },
      Rejected: { variant: "destructive", label: language === "ar" ? "مرفوض" : "Rejected" }
    };
    const config = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
      case "عالي":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "medium":
      case "متوسط":
        return <Circle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getWidgetIcon = (widgetId: string) => {
    const icons: Record<string, React.ReactNode> = {
      news: <Newspaper className="h-4 w-4 text-primary" />,
      messages: <MessageSquare className="h-4 w-4 text-primary" />,
      tasks: <CheckSquare className="h-4 w-4 text-primary" />,
      assignedTickets: <Ticket className="h-4 w-4 text-primary" />,
      purchaseTickets: <ShoppingCart className="h-4 w-4 text-primary" />,
      normalTickets: <FileText className="h-4 w-4 text-primary" />,
      shifts: <CalendarIcon className="h-4 w-4 text-primary" />,
      emails: <Mail className="h-4 w-4 text-primary" />,
      shiftFollowUp: <ClipboardList className="h-4 w-4 text-primary" />,
    };
    return icons[widgetId] || <Circle className="h-4 w-4 text-primary" />;
  };

  // Widget renderers
  const renderNewsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          {getWidgetName("news")}
        </CardTitle>
        <Badge variant="secondary">{companyNews.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {companyNews.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Newspaper className="h-8 w-8 mb-2" />
              {language === "ar" ? "لا توجد أخبار" : "No news"}
            </div>
          ) : (
            <div className="space-y-3">
              {companyNews.map(news => (
                <div
                  key={news.id}
                  className="p-3 bg-muted/30 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => !isEditMode && navigate("/company-news")}
                >
                  <div className="flex gap-3">
                    {news.image_url && (
                      <img 
                        src={news.image_url} 
                        alt={news.title}
                        className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{news.title}</h4>
                      <div 
                        className="text-sm text-muted-foreground line-clamp-2 mt-1"
                        dangerouslySetInnerHTML={{ __html: news.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderMessagesWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          {getWidgetName("messages")}
        </CardTitle>
        <Badge variant="secondary">{unreadMessages.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {unreadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2" />
              {language === "ar" ? "لا توجد رسائل" : "No messages"}
            </div>
          ) : (
            <div className="space-y-3">
              {unreadMessages.map(message => (
                <div
                  key={message.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate("/asus-tawasoul")}
                >
                  <p className="font-medium truncate">{message.sender_name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {message.message_text || (language === "ar" ? "مرفق وسائط" : "Media")}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(message.created_at), "dd/MM HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderTasksWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          {getWidgetName("tasks")}
        </CardTitle>
        <Badge variant="secondary">{tasks.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <CheckCircle2 className="h-6 w-6 mr-2" />
              {language === "ar" ? "لا توجد مهام" : "No tasks"}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate("/projects-tasks")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getPriorityIcon(task.priority)}
                      <span className="text-sm font-medium truncate">{task.title}</span>
                    </div>
                    {getStatusBadge(task.status)}
                  </div>
                  {task.deadline && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.deadline), "dd/MM/yyyy")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderAssignedTicketsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          {getWidgetName("assignedTickets")}
        </CardTitle>
        <Badge variant="secondary">{tickets.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {tickets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <CheckCircle2 className="h-6 w-6 mr-2" />
              {language === "ar" ? "لا توجد تذاكر" : "No tickets"}
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate(`/ticket/${ticket.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderPurchaseTicketsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          {getWidgetName("purchaseTickets")}
        </CardTitle>
        <Badge variant="secondary">{purchaseTickets.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {purchaseTickets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <CheckCircle2 className="h-6 w-6 mr-2" />
              {language === "ar" ? "لا توجد طلبات" : "No requests"}
            </div>
          ) : (
            <div className="space-y-2">
              {purchaseTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate(`/ticket/${ticket.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderNormalTicketsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {getWidgetName("normalTickets")}
        </CardTitle>
        <Badge variant="secondary">{normalTickets.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {normalTickets.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <CheckCircle2 className="h-6 w-6 mr-2" />
              {language === "ar" ? "لا توجد طلبات" : "No requests"}
            </div>
          ) : (
            <div className="space-y-2">
              {normalTickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate(`/ticket/${ticket.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderShiftsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          {getWidgetName("shifts")}
        </CardTitle>
        <Badge variant="secondary">{shifts.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {shifts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <CalendarIcon className="h-6 w-6 mr-2" />
              {language === "ar" ? "لا توجد ورديات" : "No shifts"}
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.map(shift => (
                <div
                  key={shift.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate("/my-shifts")}
                  style={{ borderLeftColor: shift.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{shift.shift_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(shift.assignment_date), "dd/MM")}
                      </p>
                    </div>
                    <Badge variant={shift.has_session ? (shift.session_status === "closed" ? "secondary" : "default") : "outline"} className="text-xs">
                      {shift.has_session 
                        ? (shift.session_status === "closed" 
                          ? (language === "ar" ? "مغلقة" : "Closed")
                          : (language === "ar" ? "مفتوحة" : "Open"))
                        : (language === "ar" ? "معلقة" : "Pending")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
  
  const renderShiftFollowUpWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          {getWidgetName("shiftFollowUp")}
        </CardTitle>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isEditMode}>
              <CalendarIcon className="h-3 w-3 mr-1" />
              {format(shiftFollowUpDate, "dd/MM")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={shiftFollowUpDate}
              onSelect={(date) => date && setShiftFollowUpDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {shiftFollowUpData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <ClipboardList className="h-6 w-6 mr-2" />
              {language === "ar" ? "لا توجد ورديات" : "No shifts"}
            </div>
          ) : (
            <div className="space-y-2">
              {shiftFollowUpData.map(item => (
                <div
                  key={item.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => !isEditMode && navigate("/shift-follow-up")}
                  style={{ borderLeftColor: item.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.user_name}</p>
                      <p className="text-xs text-muted-foreground">{item.shift_name}</p>
                    </div>
                    <Badge 
                      variant={item.session_status === "closed" ? "secondary" : item.session_status === "open" ? "default" : "outline"} 
                      className="text-xs"
                    >
                      {item.session_status === "closed" 
                        ? (language === "ar" ? "مغلقة" : "Closed")
                        : item.session_status === "open"
                          ? (language === "ar" ? "مفتوحة" : "Open")
                          : (language === "ar" ? "معلقة" : "Pending")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderEmailsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          {getWidgetName("emails")}
        </CardTitle>
        <Badge variant="secondary">{unreadEmails.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {unreadEmails.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mr-2" />
              {language === "ar" ? "لا توجد رسائل غير مقروءة" : "No unread emails"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {unreadEmails.map(email => (
                <div
                  key={email.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleEmailClick(email.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{email.subject || (language === "ar" ? "بدون موضوع" : "No Subject")}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {email.from_name || email.from_address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(email.email_date), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const widgetMap: Record<string, () => JSX.Element> = {
    news: renderNewsWidget,
    messages: renderMessagesWidget,
    tasks: renderTasksWidget,
    assignedTickets: renderAssignedTicketsWidget,
    purchaseTickets: renderPurchaseTicketsWidget,
    normalTickets: renderNormalTicketsWidget,
    shifts: renderShiftsWidget,
    shiftFollowUp: renderShiftFollowUpWidget,
    emails: renderEmailsWidget,
  };
  
  // Filter layout: exclude hidden widgets, and in live mode hide empty news widget
  const visibleLayout = layout.filter(item => {
    if (hiddenWidgets.includes(item.i)) return false;
    // In live mode, hide news widget if empty
    if (!isEditMode && item.i === "news" && companyNews.length === 0) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="dashboard-container" className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? `لوحة المستخدم - ${userName}` : `User Dashboard - ${userName}`}
        </h1>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <>
              <Button variant="outline" size="sm" onClick={handleOpenCopyDialog}>
                <Copy className="h-4 w-4 mr-1" />
                {language === "ar" ? "نسخ للمستخدمين" : "Copy to Users"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetLayout}>
                {language === "ar" ? "إعادة تعيين" : "Reset"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)}>
                <X className="h-4 w-4 mr-1" />
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleSaveLayout}>
                <Save className="h-4 w-4 mr-1" />
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setIsEditMode(true)} title={language === "ar" ? "تعديل التخطيط" : "Edit Layout"}>
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm space-y-2">
          <p className="font-medium text-primary">
            {language === "ar" 
              ? "وضع التعديل: يمكنك سحب ونقل العناصر أو تغيير حجمها من الزوايا"
              : "Edit Mode: Drag widgets to move them, or resize from corners"}
          </p>
          
          {/* Hidden Widgets */}
          {hiddenWidgets.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/20">
              <span className="text-muted-foreground text-xs">
                {language === "ar" ? "العناصر المخفية:" : "Hidden widgets:"}
              </span>
              {hiddenWidgets.map(widgetId => (
                <Button
                  key={widgetId}
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleRestoreWidget(widgetId)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  {getWidgetName(widgetId)}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid Layout */}
      <div 
        className={`relative ${isEditMode ? "dashboard-edit-mode" : ""}`}
        style={{ minHeight: "800px" }}
      >
        {/* Grid Lines Background (visible in edit mode) */}
        {isEditMode && (
          <div 
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)
              `,
              backgroundSize: `${containerWidth / 12}px 80px`,
            }}
          />
        )}

        <ReactGridLayout
          className="layout"
          layout={visibleLayout}
          cols={12}
          rowHeight={80}
          width={containerWidth}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".drag-handle"
          resizeHandles={["se", "sw", "ne", "nw"]}
          margin={[16, 16]}
          containerPadding={[0, 0]}
        >
          {visibleLayout.map((item) => (
            <div 
              key={item.i} 
              className={`relative ${isEditMode ? "ring-2 ring-primary/30 ring-dashed rounded-lg" : ""}`}
            >
              {isEditMode && (
                <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-primary/10 rounded-t-lg cursor-move flex items-center justify-between px-2 z-10">
                  <span className="text-xs font-medium text-primary flex items-center gap-1">
                    {getWidgetIcon(item.i)}
                    {getWidgetName(item.i)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRenameDialog(item.i);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWidget(item.i);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              <div className={`h-full ${isEditMode ? "pt-8" : ""}`}>
                {widgetMap[item.i]?.()}
              </div>
            </div>
          ))}
        </ReactGridLayout>
      </div>
      
      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "إعادة تسمية العنصر" : "Rename Widget"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={language === "ar" ? "أدخل الاسم الجديد" : "Enter new name"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleRenameWidget}>
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Copy to Users Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {language === "ar" ? "نسخ التصميم للمستخدمين" : "Copy Design to Users"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              {language === "ar" 
                ? "اختر المستخدمين لنسخ تصميم لوحة التحكم إليهم"
                : "Select users to copy your dashboard design to"}
            </p>
            <ScrollArea className="h-64 border rounded-lg p-2">
              <div className="space-y-2">
                {allUsers.map(user => (
                  <div
                    key={user.user_id}
                    className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md"
                  >
                    <Checkbox
                      checked={selectedUsers.includes(user.user_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUsers(prev => [...prev, user.user_id]);
                        } else {
                          setSelectedUsers(prev => prev.filter(id => id !== user.user_id));
                        }
                      }}
                    />
                    <span>{user.user_name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                {language === "ar" 
                  ? `تم اختيار ${selectedUsers.length} مستخدم`
                  : `${selectedUsers.length} user(s) selected`}
              </span>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  if (selectedUsers.length === allUsers.length) {
                    setSelectedUsers([]);
                  } else {
                    setSelectedUsers(allUsers.map(u => u.user_id));
                  }
                }}
              >
                {selectedUsers.length === allUsers.length 
                  ? (language === "ar" ? "إلغاء الكل" : "Deselect All")
                  : (language === "ar" ? "اختيار الكل" : "Select All")}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCopyToUsers} disabled={copyLoading || selectedUsers.length === 0}>
              {copyLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  {language === "ar" ? "جاري النسخ..." : "Copying..."}
                </span>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  {language === "ar" ? "نسخ" : "Copy"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Detail Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {language === "ar" ? "تفاصيل البريد" : "Email Details"}
            </DialogTitle>
          </DialogHeader>
          
          {emailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedFullEmail ? (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              {/* Email Header Info */}
              <div className="space-y-2 border-b pb-4">
                <h3 className="text-lg font-semibold">
                  {selectedFullEmail.subject || (language === "ar" ? "بدون موضوع" : "No Subject")}
                </h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">{language === "ar" ? "من:" : "From:"}</span>{" "}
                    {selectedFullEmail.from_name || selectedFullEmail.from_address}
                    {selectedFullEmail.from_name && (
                      <span className="text-xs ml-1">({selectedFullEmail.from_address})</span>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">{language === "ar" ? "التاريخ:" : "Date:"}</span>{" "}
                    {format(new Date(selectedFullEmail.email_date), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
                {selectedFullEmail.to_addresses && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">{language === "ar" ? "إلى:" : "To:"}</span>{" "}
                    {Array.isArray(selectedFullEmail.to_addresses) 
                      ? selectedFullEmail.to_addresses.join(", ")
                      : selectedFullEmail.to_addresses}
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleReplyEmail}>
                  <Reply className="h-4 w-4 mr-1" />
                  {language === "ar" ? "رد" : "Reply"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleReplyAllEmail}>
                  <ReplyAll className="h-4 w-4 mr-1" />
                  {language === "ar" ? "رد للكل" : "Reply All"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleForwardEmail}>
                  <Forward className="h-4 w-4 mr-1" />
                  {language === "ar" ? "إعادة توجيه" : "Forward"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCreateTicketFromEmail}>
                  <Ticket className="h-4 w-4 mr-1" />
                  {language === "ar" ? "إنشاء تذكرة" : "Create Ticket"}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteEmail}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {language === "ar" ? "حذف" : "Delete"}
                </Button>
              </div>
              
              {/* Email Body */}
              <ScrollArea className="flex-1 min-h-[200px] border rounded-lg bg-background">
                {selectedFullEmail.body_html ? (
                  <iframe
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                      <head>
                        <meta charset="utf-8">
                        <style>
                          body { 
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 14px;
                            line-height: 1.5;
                            padding: 16px;
                            margin: 0;
                            background: #ffffff;
                            color: #1a1a1a;
                          }
                          img { max-width: 100%; height: auto; }
                          a { color: #0066cc; }
                        </style>
                      </head>
                      <body>${selectedFullEmail.body_html}</body>
                      </html>
                    `}
                    className="w-full h-full min-h-[300px] border-0"
                    title="Email content"
                  />
                ) : (
                  <div className="p-4 whitespace-pre-wrap text-sm">
                    {selectedFullEmail.body_text || (language === "ar" ? "لا يوجد محتوى" : "No content available")}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : null}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              {language === "ar" ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Styles */}
      <style>{`
        .dashboard-edit-mode .react-grid-item {
          transition: all 200ms ease;
        }
        .dashboard-edit-mode .react-grid-item.react-grid-placeholder {
          background: hsl(var(--primary) / 0.2);
          border: 2px dashed hsl(var(--primary));
          border-radius: 0.5rem;
        }
        .dashboard-edit-mode .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
          background: hsl(var(--primary));
          border-radius: 4px;
          opacity: 0.8;
        }
        .dashboard-edit-mode .react-resizable-handle-se {
          bottom: 0;
          right: 0;
          cursor: se-resize;
        }
        .dashboard-edit-mode .react-resizable-handle-sw {
          bottom: 0;
          left: 0;
          cursor: sw-resize;
        }
        .dashboard-edit-mode .react-resizable-handle-ne {
          top: 0;
          right: 0;
          cursor: ne-resize;
        }
        .dashboard-edit-mode .react-resizable-handle-nw {
          top: 0;
          left: 0;
          cursor: nw-resize;
        }
      `}</style>
    </div>
  );
};

export default UserDashboard;
