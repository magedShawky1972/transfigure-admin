import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  FileText
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

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

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setUserName(profile.user_name);
      }

      // Fetch all data in parallel
      await Promise.all([
        fetchTasks(user.id),
        fetchTickets(user.id),
        fetchPurchaseTickets(user.id),
        fetchNormalTickets(user.id),
        fetchShifts(user.id),
        fetchUnreadEmails(user.id),
        fetchUnreadMessages(user.id)
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
    // Get conversations user is participating in
    const { data: participations } = await supabase
      .from("internal_conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    if (!participations || participations.length === 0) {
      setUnreadMessages([]);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    // Get unread messages from those conversations (not sent by current user)
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
      // Get sender names
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

  if (loading) {
    return (
      <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? `لوحة المستخدم - ${userName}` : `User Dashboard - ${userName}`}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tasks Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              {language === "ar" ? "المهام" : "Tasks"}
            </CardTitle>
            <Badge variant="secondary">{tasks.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {tasks.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد مهام معلقة" : "No pending tasks"}
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/projects-tasks")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getPriorityIcon(task.priority)}
                          <span className="font-medium truncate">{task.title}</span>
                        </div>
                        {getStatusBadge(task.status)}
                      </div>
                      {task.deadline && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
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

        {/* Assigned Tickets Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              {language === "ar" ? "التذاكر المعينة" : "Assigned Tickets"}
            </CardTitle>
            <Badge variant="secondary">{tickets.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {tickets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد تذاكر معينة" : "No assigned tickets"}
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(ticket.priority)}
                            <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                          </div>
                          <p className="font-medium truncate mt-1">{ticket.subject}</p>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ticket.created_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Purchase Tickets Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {language === "ar" ? "طلبات الشراء" : "Purchase Requests"}
            </CardTitle>
            <Badge variant="secondary">{purchaseTickets.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {purchaseTickets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد طلبات شراء" : "No purchase requests"}
                </div>
              ) : (
                <div className="space-y-3">
                  {purchaseTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(ticket.priority)}
                            <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                          </div>
                          <p className="font-medium truncate mt-1">{ticket.subject}</p>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ticket.created_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Normal Tickets Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {language === "ar" ? "طلبات الدعم" : "Support Requests"}
            </CardTitle>
            <Badge variant="secondary">{normalTickets.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {normalTickets.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد طلبات دعم" : "No support requests"}
                </div>
              ) : (
                <div className="space-y-3">
                  {normalTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getPriorityIcon(ticket.priority)}
                            <span className="text-xs text-muted-foreground">#{ticket.ticket_number}</span>
                          </div>
                          <p className="font-medium truncate mt-1">{ticket.subject}</p>
                        </div>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ticket.created_at), "dd/MM/yyyy")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Shift Assignments Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {language === "ar" ? "الورديات القادمة" : "Upcoming Shifts"}
            </CardTitle>
            <Badge variant="secondary">{shifts.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {shifts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Calendar className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد ورديات قادمة" : "No upcoming shifts"}
                </div>
              ) : (
                <div className="space-y-3">
                  {shifts.map(shift => (
                    <div
                      key={shift.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/my-shifts")}
                      style={{ borderLeftColor: shift.color, borderLeftWidth: 4 }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{shift.shift_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(shift.assignment_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <Badge variant={shift.has_session ? (shift.session_status === "closed" ? "secondary" : "default") : "outline"}>
                          {shift.has_session 
                            ? (shift.session_status === "closed" 
                              ? (language === "ar" ? "مغلقة" : "Closed")
                              : (language === "ar" ? "مفتوحة" : "Open"))
                            : (language === "ar" ? "معلقة" : "Pending")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {shift.shift_start_time?.slice(0, 5)} - {shift.shift_end_time?.slice(0, 5)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Unread Emails Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              {language === "ar" ? "رسائل غير مقروءة" : "Unread Emails"}
            </CardTitle>
            <Badge variant="secondary">{unreadEmails.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {unreadEmails.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد رسائل غير مقروءة" : "No unread emails"}
                </div>
              ) : (
                <div className="space-y-3">
                  {unreadEmails.map(email => (
                    <div
                      key={email.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/email-manager")}
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

        {/* Unread Internal Messages Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {language === "ar" ? "رسائل تواصل غير مقروءة" : "Unread Tawasoul Messages"}
            </CardTitle>
            <Badge variant="secondary">{unreadMessages.length}</Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {unreadMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2" />
                  {language === "ar" ? "لا توجد رسائل غير مقروءة" : "No unread messages"}
                </div>
              ) : (
                <div className="space-y-3">
                  {unreadMessages.map(message => (
                    <div
                      key={message.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/asus-tawasoul")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{message.sender_name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {message.message_text || (language === "ar" ? "مرفق وسائط" : "Media attachment")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(message.created_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;
