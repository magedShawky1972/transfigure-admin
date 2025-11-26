import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Eye, ShoppingCart, MessageSquare, Send, Trash2, Mail } from "lucide-react";
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

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  department_id: string;
  assigned_to: string | null;
  approved_at: string | null;
  approved_by: string | null;
  is_purchase_ticket: boolean;
  next_admin_order: number | null;
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
};

type DepartmentMember = {
  user_id: string;
  profiles: {
    user_name: string;
    email: string;
  };
};

const AdminTickets = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [departmentMembers, setDepartmentMembers] = useState<Record<string, DepartmentMember[]>>({});
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [quickComment, setQuickComment] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    fetchTickets();
    fetchDepartmentMembers();
  }, []);

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

      // Get departments where user is admin
      const { data: adminDepts, error: deptError } = await supabase
        .from("department_admins")
        .select("department_id")
        .eq("user_id", user.id);

      if (deptError) throw deptError;

      const departmentIds = adminDepts?.map(d => d.department_id) || [];

      if (departmentIds.length === 0) {
        setTickets([]);
        return;
      }

      // Fetch tickets for those departments
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          departments (
            department_name
          )
        `)
        .in("department_id", departmentIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

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
          assigned_user: ticket.assigned_to ? profileMap.get(ticket.assigned_to) : null
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

  const handleApprove = async (ticketId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get ticket details first
      const { data: ticket } = await supabase
        .from("tickets")
        .select("user_id, ticket_number, subject, department_id, is_purchase_ticket")
        .eq("id", ticketId)
        .single();

      if (!ticket) throw new Error("Ticket not found");

      // Get current admin's order
      const { data: currentAdmin } = await supabase
        .from("department_admins")
        .select("admin_order")
        .eq("user_id", user.id)
        .eq("department_id", ticket.department_id)
        .single();

      const currentOrder = currentAdmin?.admin_order || 1;

      // Check if there are admins at the next order level
      const { data: nextAdmins } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id)
        .eq("admin_order", currentOrder + 1);

      const hasNextLevel = nextAdmins && nextAdmins.length > 0;

      if (hasNextLevel) {
        // There are more admins - update next_admin_order and send notification
        const { error } = await supabase
          .from("tickets")
          .update({
            next_admin_order: currentOrder + 1,
            status: "In Progress",
          })
          .eq("id", ticketId);

        if (error) throw error;

        // Send notification to next level admins
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_created",
            ticketId: ticketId,
            adminOrder: currentOrder + 1,
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
            approved_at: new Date().toISOString(),
            approved_by: user.id,
            status: "In Progress",
          })
          .eq("id", ticketId);

        if (error) throw error;

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

  const handleAssign = async (ticketId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ assigned_to: userId })
        .eq("id", ticketId);

      if (error) throw error;

      // Send notification to assigned user
      await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_assigned",
          ticketId: ticketId,
          recipientUserId: userId,
        },
      });

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تم تعيين التذكرة' : 'Ticket assigned',
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

      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        user_id: user.id,
        comment: comment,
        is_internal: false,
      });

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إضافة التعليق' : 'Comment added successfully',
      });

      setQuickComment({ ...quickComment, [ticketId]: "" });
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

  const handleResendNotification = async (ticket: Ticket) => {
    try {
      // Get the current approval level from ticket or default to 1
      const currentOrder = ticket.next_admin_order || 1;

      // Get admins at the current approval level for this department
      const { data: adminData, error: adminError } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id)
        .eq("admin_order", currentOrder);

      if (adminError) throw adminError;

      if (!adminData || adminData.length === 0) {
        throw new Error(language === 'ar' ? `لم يتم العثور على مسؤولين في المستوى ${currentOrder}` : `No admins found at level ${currentOrder}`);
      }

      // Send notification to admins at current approval level
      const { error: notificationError } = await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_created",
          ticketId: ticket.id,
          adminOrder: currentOrder,
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

  const filteredTickets = tickets.filter(ticket => {
    if (filterStatus !== "all" && ticket.status !== filterStatus) return false;
    if (filterPriority !== "all" && ticket.priority !== filterPriority) return false;
    return true;
  });

  const openTickets = filteredTickets.filter(t => t.status === "Open");
  const inProgressTickets = filteredTickets.filter(t => t.status === "In Progress");
  const closedTickets = filteredTickets.filter(t => t.status === "Closed");

  const TicketCard = ({ ticket }: { ticket: Ticket }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg">{ticket.subject}</CardTitle>
            <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
              <span className="font-medium">{ticket.ticket_number}</span>
              <span>•</span>
              <span>{ticket.departments.department_name}</span>
              <span>•</span>
              <span>{ticket.profiles.user_name}</span>
              <span>•</span>
              <span>{format(new Date(ticket.created_at), "PPp")}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {ticket.is_purchase_ticket && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  {language === 'ar' ? 'مشتريات' : 'Purchase'}
                </Badge>
              )}
            </div>
          </div>
          <Badge variant={getPriorityColor(ticket.priority)}>
            {ticket.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
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
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">{language === 'ar' ? 'مفتوح' : 'Open'}</SelectItem>
              <SelectItem value="In Progress">{language === 'ar' ? 'قيد المعالجة' : 'In Progress'}</SelectItem>
              <SelectItem value="Closed">{language === 'ar' ? 'مغلق' : 'Closed'}</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {language === 'ar' ? 'مشتريات' : 'Purchase'}
            </span>
            <Switch
              checked={ticket.is_purchase_ticket}
              onCheckedChange={(checked) => handleTogglePurchaseTicket(ticket.id, checked)}
            />
          </div>
          
          {!ticket.approved_at && (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleApprove(ticket.id)}
            >
              {language === 'ar' ? 'موافقة' : 'Approve'}
            </Button>
          )}
          
          {ticket.approved_at && (
            <Badge variant="secondary">
              {language === 'ar' ? 'تمت الموافقة' : 'Approved'}
            </Badge>
          )}
          
          <Select
            value={ticket.assigned_to || ""}
            onValueChange={(value) => handleAssign(ticket.id, value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={language === 'ar' ? 'تعيين إلى' : 'Assign to'} />
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
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'إضافة تعليق' : 'Add Comment'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                <Textarea
                  placeholder={language === 'ar' ? 'اكتب تعليقك هنا...' : 'Write your comment here...'}
                  value={quickComment[ticket.id] || ""}
                  onChange={(e) => setQuickComment({ ...quickComment, [ticket.id]: e.target.value })}
                  className="min-h-[80px] bg-background"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleQuickComment(ticket.id)}
                    disabled={submittingComment === ticket.id || !quickComment[ticket.id]?.trim()}
                    size="sm"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submittingComment === ticket.id ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (language === 'ar' ? 'إرسال' : 'Send')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
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
            onClick={() => handleResendNotification(ticket)}
          >
            <Mail className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'إعادة إرسال الإشعار' : 'Resend Notification'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/tickets/${ticket.id}`, { state: { from: '/admin-tickets' } })}
          >
            <Eye className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setTicketToDelete(ticket.id);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'تذاكر الأقسام' : 'Department Tickets'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === 'ar' ? 'إدارة التذاكر لأقسامك' : 'Manage tickets for your departments'}
        </p>
      </div>

      <div className="flex gap-4">
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={language === 'ar' ? 'تصفية حسب الأولوية' : 'Filter by priority'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ar' ? 'كل الأولويات' : 'All Priorities'}</SelectItem>
            <SelectItem value="Urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
            <SelectItem value="High">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
            <SelectItem value="Medium">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
            <SelectItem value="Low">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
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
          <TabsList>
            <TabsTrigger value="open">
              {language === 'ar' ? `مفتوح (${openTickets.length})` : `Open (${openTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="in-progress">
              {language === 'ar' ? `قيد المعالجة (${inProgressTickets.length})` : `In Progress (${inProgressTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="closed">
              {language === 'ar' ? `مغلق (${closedTickets.length})` : `Closed (${closedTickets.length})`}
            </TabsTrigger>
            <TabsTrigger value="all">
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
    </div>
  );
};

export default AdminTickets;
