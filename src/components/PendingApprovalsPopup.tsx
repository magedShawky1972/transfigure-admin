import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Clock, FileText, ShoppingCart, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface PendingTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string | null;
  priority: string;
  is_purchase_ticket: boolean;
  created_at: string;
  department_name: string;
  requester_name: string;
}

interface PendingApprovalsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const PendingApprovalsPopup = ({ open, onOpenChange, userId }: PendingApprovalsPopupProps) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [tickets, setTickets] = useState<PendingTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && userId) {
      fetchPendingTickets();
    }
  }, [open, userId]);

  const fetchPendingTickets = async () => {
    try {
      setLoading(true);

      // Get user's department admin assignments
      const { data: adminAssignments, error: adminError } = await supabase
        .from("department_admins")
        .select("department_id, admin_order, is_purchase_admin")
        .eq("user_id", userId);

      if (adminError) throw adminError;
      if (!adminAssignments || adminAssignments.length === 0) {
        setTickets([]);
        setLoading(false);
        return;
      }

      // Get all admins for matching departments
      const deptIds = adminAssignments.map(a => a.department_id);
      const { data: allAdmins, error: allAdminsError } = await supabase
        .from("department_admins")
        .select("department_id, admin_order, is_purchase_admin")
        .in("department_id", deptIds);

      if (allAdminsError) throw allAdminsError;

      // Fetch tickets pending approval
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_number,
          subject,
          description,
          priority,
          is_purchase_ticket,
          created_at,
          next_admin_order,
          department_id,
          user_id,
          departments:department_id(department_name)
        `)
        .eq("status", "pending")
        .is("approved_at", null)
        .in("department_id", deptIds)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      // Get unique creator IDs to fetch their names
      const creatorIds = [...new Set((ticketsData || []).map(t => t.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, user_name")
          .in("id", creatorIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.id] = p.user_name || "";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Filter tickets where current user is the next approver
      const filteredTickets: PendingTicket[] = [];

      for (const ticket of ticketsData || []) {
        const userAdmin = adminAssignments.find(a => a.department_id === ticket.department_id);
        if (!userAdmin) continue;

        const deptAdmins = (allAdmins || []).filter(a => a.department_id === ticket.department_id);
        const nextOrder = ticket.next_admin_order ?? 0;

        let isNextApprover = false;

        if (!ticket.is_purchase_ticket) {
          // For non-purchase tickets: only regular admins can approve
          if (!userAdmin.is_purchase_admin && userAdmin.admin_order === nextOrder) {
            isNextApprover = true;
          }
        } else {
          // For purchase tickets: first regular admins, then purchase admins
          const regularAdminsAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
          
          if (regularAdminsAtOrder.length > 0) {
            // Still in regular admin phase
            if (!userAdmin.is_purchase_admin && userAdmin.admin_order === nextOrder) {
              isNextApprover = true;
            }
          } else {
            // In purchase admin phase
            if (userAdmin.is_purchase_admin && userAdmin.admin_order === nextOrder) {
              isNextApprover = true;
            }
          }
        }

        if (isNextApprover) {
          filteredTickets.push({
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            description: ticket.description,
            priority: ticket.priority,
            is_purchase_ticket: ticket.is_purchase_ticket,
            created_at: ticket.created_at,
            department_name: (ticket.departments as any)?.department_name || "",
            requester_name: ticket.user_id ? (profilesMap[ticket.user_id] || "") : "",
          });
        }
      }

      setTickets(filteredTickets);
    } catch (error) {
      console.error("Error fetching pending tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500 text-white";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-black";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const handleViewTicket = (ticketId: string) => {
    onOpenChange(false);
    navigate(`/ticket-details/${ticketId}`);
  };

  const handleViewAll = () => {
    onOpenChange(false);
    navigate("/admin-tickets");
  };

  if (tickets.length === 0 && !loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            {language === "ar" ? "تذاكر تنتظر موافقتك" : "Tickets Awaiting Your Approval"}
          </DialogTitle>
          <DialogDescription>
            {language === "ar"
              ? `لديك ${tickets.length} تذكرة تحتاج إلى موافقتك`
              : `You have ${tickets.length} ticket(s) pending your approval`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3 pr-4">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleViewTicket(ticket.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-muted-foreground">
                            {ticket.ticket_number}
                          </span>
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          {ticket.is_purchase_ticket && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              {language === "ar" ? "مشتريات" : "Purchase"}
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium mt-1 truncate">{ticket.subject}</h4>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {ticket.department_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(ticket.created_at), "MMM dd, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {language === "ar" ? "من:" : "From:"} {ticket.requester_name}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {language === "ar" ? "لاحقاً" : "Later"}
              </Button>
              <Button onClick={handleViewAll}>
                {language === "ar" ? "عرض جميع التذاكر" : "View All Tickets"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PendingApprovalsPopup;
