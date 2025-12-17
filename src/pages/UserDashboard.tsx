import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  CheckSquare, 
  Ticket, 
  Calendar, 
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
  Save
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

// Default layout configuration
const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "news", x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
  { i: "messages", x: 0, y: 3, w: 3, h: 6, minW: 2, minH: 3 },
  { i: "tasks", x: 3, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "assignedTickets", x: 6, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "purchaseTickets", x: 9, y: 3, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "normalTickets", x: 3, y: 6, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "shifts", x: 6, y: 6, w: 3, h: 3, minW: 2, minH: 2 },
  { i: "emails", x: 0, y: 9, w: 12, h: 3, minW: 4, minH: 2 },
];

const LAYOUT_STORAGE_KEY = "user-dashboard-layout";

const UserDashboard = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<AssignedTicket[]>([]);
  const [purchaseTickets, setPurchaseTickets] = useState<UserTicket[]>([]);
  const [normalTickets, setNormalTickets] = useState<UserTicket[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [unreadEmails, setUnreadEmails] = useState<UnreadEmail[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<UnreadInternalMessage[]>([]);
  const [companyNews, setCompanyNews] = useState<CompanyNewsItem[]>([]);
  
  // Layout customization state
  const [isEditMode, setIsEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Load saved layout on mount
  useEffect(() => {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout) {
      try {
        setLayout(JSON.parse(savedLayout));
      } catch (e) {
        console.error("Failed to parse saved layout:", e);
      }
    }
  }, []);

  // Handle container resize
  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById("dashboard-container");
      if (container) {
        setContainerWidth(container.offsetWidth - 48); // Subtract padding
      }
    };
    
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
        fetchCompanyNews()
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
      .eq("is_purchase_ticket", true)
      .eq("is_deleted", false)
      .neq("status", "Closed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setPurchaseTickets(data.map(t => ({
        ...t,
        department_name: (t.departments as any)?.department_name
      })));
    }
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
      .eq("folder", "inbox")
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

  const handleLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);
  }, []);

  const handleSaveLayout = () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    setIsEditMode(false);
    toast({
      title: language === "ar" ? "تم الحفظ" : "Layout Saved",
      description: language === "ar" ? "تم حفظ تخطيط لوحة التحكم بنجاح" : "Dashboard layout saved successfully",
    });
  };

  const handleResetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    toast({
      title: language === "ar" ? "تم إعادة التعيين" : "Layout Reset",
      description: language === "ar" ? "تم إعادة تعيين التخطيط للوضع الافتراضي" : "Layout reset to default",
    });
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

  // Widget renderers
  const renderNewsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          {language === "ar" ? "أخبار الشركة" : "Company News"}
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
          {language === "ar" ? "رسائل تواصل" : "Tawasoul"}
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
          {language === "ar" ? "المهام" : "Tasks"}
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
          {language === "ar" ? "التذاكر المعينة" : "Assigned Tickets"}
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
          {language === "ar" ? "طلبات الشراء" : "Purchase Requests"}
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
          {language === "ar" ? "طلبات الدعم" : "Support Requests"}
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
          <Calendar className="h-4 w-4 text-primary" />
          {language === "ar" ? "الورديات" : "Shifts"}
        </CardTitle>
        <Badge variant="secondary">{shifts.length}</Badge>
      </CardHeader>
      <CardContent className="h-[calc(100%-60px)]">
        <ScrollArea className="h-full">
          {shifts.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Calendar className="h-6 w-6 mr-2" />
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

  const renderEmailsWidget = () => (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          {language === "ar" ? "رسائل البريد غير المقروءة" : "Unread Emails"}
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
                  onClick={() => !isEditMode && navigate("/email-manager")}
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
    emails: renderEmailsWidget,
  };

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
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
          <p className="font-medium text-primary">
            {language === "ar" 
              ? "وضع التعديل: يمكنك سحب ونقل العناصر أو تغيير حجمها من الزوايا"
              : "Edit Mode: Drag widgets to move them, or resize from corners"}
          </p>
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
          layout={layout}
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
          {layout.map((item) => (
            <div 
              key={item.i} 
              className={`relative ${isEditMode ? "ring-2 ring-primary/30 ring-dashed rounded-lg" : ""}`}
            >
              {isEditMode && (
                <div className="drag-handle absolute top-0 left-0 right-0 h-8 bg-primary/10 rounded-t-lg cursor-move flex items-center justify-center z-10">
                  <span className="text-xs font-medium text-primary">
                    {language === "ar" ? "اسحب للتحريك" : "Drag to move"}
                  </span>
                </div>
              )}
              <div className={`h-full ${isEditMode ? "pt-8" : ""}`}>
                {widgetMap[item.i]?.()}
              </div>
            </div>
          ))}
        </ReactGridLayout>
      </div>

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
