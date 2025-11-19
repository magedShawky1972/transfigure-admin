import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  useEffect(() => {
    fetchTickets();
    fetchDepartmentMembers();
  }, []);

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

      const { error } = await supabase
        .from("tickets")
        .update({
          approved_at: new Date().toISOString(),
          approved_by: user.id
        })
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تمت الموافقة على التذكرة' : 'Ticket approved',
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

  const handleAssign = async (ticketId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ assigned_to: userId })
        .eq("id", ticketId);

      if (error) throw error;

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

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: newStatus })
        .eq("id", ticketId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ticket status updated",
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/tickets/${ticket.id}`)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
          </Button>
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
    </div>
  );
};

export default AdminTickets;
