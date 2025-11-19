import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Send } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  departments: {
    department_name: string;
  };
  profiles: {
    user_name: string;
    email: string;
  };
};

type Comment = {
  id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  profiles: {
    user_name: string;
  };
};

const TicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useLanguage();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchComments();
    }
  }, [id]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          departments (
            department_name
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Fetch user profile separately
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_name, email")
        .eq("user_id", data.user_id)
        .maybeSingle();
      
      setTicket({
        ...data,
        profiles: profileData || { user_name: "Unknown", email: "" }
      });
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

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(c => c.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", userIds);
        
        const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
        
        const commentsWithProfiles = data.map(comment => ({
          ...comment,
          profiles: profileMap.get(comment.user_id) || { user_name: "Unknown" }
        }));
        
        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: id,
        user_id: user.id,
        comment: newComment,
        is_internal: false,
      });

      if (error) throw error;

      toast({
        title: t("ticketDetails.success"),
        description: t("ticketDetails.commentAdded"),
      });

      setNewComment("");
      fetchComments();
    } catch (error: any) {
      toast({
        title: t("ticketDetails.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return <div className="container mx-auto p-6">{t("ticketDetails.loading")}</div>;
  }

  if (!ticket) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{t("ticketDetails.notFound")}</p>
            <Button className="mt-4" onClick={() => navigate("/tickets")}>
              {t("ticketDetails.backToTickets")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/tickets")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("ticketDetails.backToTickets")}
      </Button>

      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("ticketDetails.ticketNumber")}{ticket.ticket_number}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
                <Badge variant={getStatusColor(ticket.status)}>
                  {ticket.status}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("ticketDetails.department")}</span>
                <span className="ml-2 font-medium">{ticket.departments.department_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("ticketDetails.created")}</span>
                <span className="ml-2">{format(new Date(ticket.created_at), "PPp")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("ticketDetails.createdBy")}</span>
                <span className="ml-2">{ticket.profiles.user_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("ticketDetails.email")}</span>
                <span className="ml-2">{ticket.profiles.email}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">{t("ticketDetails.description")}</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-4">{t("ticketDetails.commentsUpdates")}</h3>
              <div className="space-y-4 mb-4">
                {comments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t("ticketDetails.noComments")}</p>
                ) : (
                  comments.map((comment) => (
                    <Card key={comment.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{comment.profiles.user_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), "PPp")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                        {comment.is_internal && (
                          <Badge variant="secondary" className="mt-2">{t("ticketDetails.internalNote")}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {ticket.status !== "Closed" && (
                <div className="space-y-2">
                  <Textarea
                    placeholder={t("ticketDetails.addCommentPlaceholder")}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={submitting || !newComment.trim()}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {t("ticketDetails.addComment")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketDetails;
