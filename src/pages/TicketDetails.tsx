import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Send, Paperclip, ShoppingCart, Download, CheckCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  is_purchase_ticket: boolean;
  department_id: string;
  user_id: string;
  approved_at: string | null;
  next_admin_order: number | null;
  departments: {
    department_name: string;
  };
  profiles: {
    user_name: string;
    email: string;
  };
};

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  profiles: {
    user_name: string;
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
  const location = useLocation();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { t } = useLanguage();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approvingTicket, setApprovingTicket] = useState(false);

  // Get the source page from navigation state
  const sourceRoute = (location.state as { from?: string })?.from || "/tickets";

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchComments();
      fetchAttachments();
    }
  }, [id]);

  useEffect(() => {
    if (ticket) {
      checkAdminStatus();
    }
  }, [ticket]);

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
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Error",
          description: "Ticket not found or you don't have access to it",
          variant: "destructive",
        });
        navigate("/tickets");
        return;
      }
      
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

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ticket) return;

      // Check if user is admin for this ticket's department
      const { data } = await supabase
        .from("department_admins")
        .select("id")
        .eq("user_id", user.id)
        .eq("department_id", ticket.department_id)
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map(a => a.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", userIds);

        const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);

        const attachmentsWithProfiles = data.map(attachment => ({
          ...attachment,
          profiles: profileMap.get(attachment.user_id) || { user_name: "Unknown" }
        }));

        setAttachments(attachmentsWithProfiles);
      } else {
        setAttachments([]);
      }
    } catch (error: any) {
      console.error("Error fetching attachments:", error);
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

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("ticket_attachments").insert({
        ticket_id: id,
        user_id: user.id,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
      });

      if (dbError) throw dbError;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم رفع الملف' : 'File uploaded successfully',
      });

      setSelectedFile(null);
      fetchAttachments();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('ticket-attachments')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTogglePurchaseTicket = async () => {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from("tickets")
        .update({ is_purchase_ticket: !ticket.is_purchase_ticket })
        .eq("id", ticket.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' 
          ? `تم ${!ticket.is_purchase_ticket ? 'تحديد' : 'إلغاء'} التذكرة كتذكرة مشتريات` 
          : `Ticket ${!ticket.is_purchase_ticket ? 'marked' : 'unmarked'} as purchase ticket`,
      });

      fetchTicket();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!ticket) return;

    try {
      setApprovingTicket(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current admin's order and check if there are more admins
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
          .eq("id", ticket.id);

        if (error) throw error;

        // Send notification to next level admins
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_created",
            ticketId: ticket.id,
            adminOrder: currentOrder + 1,
          },
        });

        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
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
          .eq("id", ticket.id);

        if (error) throw error;

        // Send notification to ticket creator
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_approved",
            ticketId: ticket.id,
            recipientUserId: ticket.user_id,
          },
        });

        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تمت الموافقة على التذكرة بالكامل' : 'Ticket fully approved',
        });
      }

      fetchTicket();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setApprovingTicket(false);
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
      <Button variant="ghost" onClick={() => navigate(sourceRoute)}>
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
              {ticket.is_purchase_ticket && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ShoppingCart className="h-3 w-3" />
                  {language === 'ar' ? 'مشتريات' : 'Purchase'}
                </Badge>
              )}
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

            {isAdmin && (
              <>
                <Separator />
                <div className="space-y-3">
                  {!ticket.approved_at && (
                    <div className="flex justify-end">
                      <Button
                        onClick={handleApprove}
                        disabled={approvingTicket}
                        size="default"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        {approvingTicket 
                          ? (language === 'ar' ? 'جاري الموافقة...' : 'Approving...') 
                          : (language === 'ar' ? 'موافقة' : 'Approve')}
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-md">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">
                        {language === 'ar' ? 'تذكرة مشتريات' : 'Purchase Ticket'}
                      </span>
                    </div>
                    <Switch
                      checked={ticket.is_purchase_ticket}
                      onCheckedChange={handleTogglePurchaseTicket}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h3 className="font-semibold mb-4">
                {language === 'ar' ? 'المرفقات' : 'Attachments'}
              </h3>
              
              {/* Allow both ticket creator and admins to upload files */}
              <div className="mb-4 p-4 border rounded-md space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploading}
                    size="sm"
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    {uploading ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (language === 'ar' ? 'رفع' : 'Upload')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {attachments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {language === 'ar' ? 'لا توجد مرفقات' : 'No attachments'}
                  </p>
                ) : (
                  attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attachment.profiles.user_name} • {format(new Date(attachment.created_at), "PP")}
                            {attachment.file_size && ` • ${(attachment.file_size / 1024).toFixed(1)} KB`}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(attachment.file_path, attachment.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
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
