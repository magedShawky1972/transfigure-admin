import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Send, Paperclip, ShoppingCart, Download, CheckCircle, UserPlus, Edit, X, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  external_link: string | null;
  budget_value: number | null;
  qty: number | null;
  uom: string | null;
  departments: {
    department_name: string;
  };
  profiles: {
    user_name: string;
    email: string;
  };
};

type Department = {
  id: string;
  department_name: string;
};

type UOM = {
  id: string;
  uom_code: string;
  uom_name: string;
  uom_name_ar: string | null;
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
  const [isDepartmentAdmin, setIsDepartmentAdmin] = useState(false);
  const [isTicketOwner, setIsTicketOwner] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [approvingTicket, setApprovingTicket] = useState(false);
  
  // Extra approval states
  const [extraApprovalDialogOpen, setExtraApprovalDialogOpen] = useState(false);
  const [availableAdmins, setAvailableAdmins] = useState<{ user_id: string; user_name: string }[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [sendingExtraApproval, setSendingExtraApproval] = useState(false);

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    department_id: "",
    subject: "",
    description: "",
    priority: "",
    external_link: "",
    is_purchase_ticket: false,
    budget_value: null as number | null,
    qty: null as number | null,
    uom: null as string | null,
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [uomList, setUomList] = useState<UOM[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newUomName, setNewUomName] = useState("");
  const [addingUom, setAddingUom] = useState(false);

  // Get the source page from navigation state
  const sourceRoute = (location.state as { from?: string })?.from || "/tickets";

  useEffect(() => {
    if (id) {
      fetchTicket();
      fetchComments();
      fetchAttachments();
      fetchDepartments();
      fetchUomList();
    }
  }, [id]);

  useEffect(() => {
    if (ticket) {
      checkAdminStatus();
      // Initialize edit data when ticket loads
      setEditData({
        department_id: ticket.department_id,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        external_link: ticket.external_link || "",
        is_purchase_ticket: ticket.is_purchase_ticket,
        budget_value: ticket.budget_value,
        qty: ticket.qty,
        uom: ticket.uom,
      });
    }
  }, [ticket]);

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

  const fetchUomList = async () => {
    try {
      const { data, error } = await supabase
        .from("uom")
        .select("*")
        .eq("is_active", true)
        .order("uom_name");

      if (error) throw error;
      setUomList(data || []);
    } catch (error: any) {
      console.error("Error fetching UOM list:", error);
    }
  };

  const handleAddNewUom = async () => {
    if (!newUomName.trim()) return;
    
    setAddingUom(true);
    try {
      const uomCode = newUomName.toUpperCase().replace(/\s+/g, '_').substring(0, 10);
      const { data, error } = await supabase
        .from("uom")
        .insert({
          uom_code: uomCode,
          uom_name: newUomName,
          uom_name_ar: newUomName,
        })
        .select()
        .single();

      if (error) throw error;

      setUomList(prev => [...prev, data]);
      setEditData(prev => ({ ...prev, uom: data.uom_code }));
      setNewUomName("");
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم إضافة وحدة القياس' : 'UOM added successfully',
      });
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingUom(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!ticket) return;

    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({
          department_id: editData.department_id,
          subject: editData.subject,
          description: editData.description,
          priority: editData.priority,
          external_link: editData.external_link || null,
          is_purchase_ticket: editData.is_purchase_ticket,
          budget_value: editData.is_purchase_ticket ? editData.budget_value : null,
          qty: editData.is_purchase_ticket ? editData.qty : null,
          uom: editData.is_purchase_ticket ? editData.uom : null,
        })
        .eq("id", ticket.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم تحديث التذكرة' : 'Ticket updated successfully',
      });

      setIsEditing(false);
      fetchTicket();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

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

      // Check if user is the ticket owner
      setIsTicketOwner(user.id === ticket.user_id);

      // Check if user is admin for this ticket's department
      const { data } = await supabase
        .from("department_admins")
        .select("id, admin_order, is_purchase_admin")
        .eq("user_id", user.id)
        .eq("department_id", ticket.department_id)
        .maybeSingle();

      setIsAdmin(!!data);
      setIsDepartmentAdmin(!!data);

      // Check if current admin can approve (is at the correct approval level)
      if (data && !ticket.approved_at) {
        const adminOrder = data.admin_order;
        const isPurchaseAdmin = data.is_purchase_admin;
        const ticketNextOrder = ticket.next_admin_order ?? 0; // Default to 0 since admin_order starts at 0

        // Determine if this admin is in the current approval phase
        // For regular admins: check if no purchase phase started yet or admin_order matches next_admin_order
        // For purchase admins: check if we're in purchase phase and order matches
        
        if (ticket.is_purchase_ticket) {
          // For purchase tickets, check if we're in purchase phase or regular phase
          // Regular phase: next_admin_order matches regular admin's order
          // Purchase phase: need to check if all regular admins approved
          
          // Get max order of regular admins
          const { data: maxRegularOrder } = await supabase
            .from("department_admins")
            .select("admin_order")
            .eq("department_id", ticket.department_id)
            .eq("is_purchase_admin", false)
            .order("admin_order", { ascending: false })
            .limit(1)
            .maybeSingle();

          const maxRegularAdminOrder = maxRegularOrder?.admin_order || 0;

          if (!isPurchaseAdmin) {
            // Regular admin can approve if their order matches next_admin_order
            setCanApprove(adminOrder === ticketNextOrder);
          } else {
            // Purchase admin can only approve after all regular admins approved
            // which means next_admin_order > max regular admin order
            setCanApprove(ticketNextOrder > maxRegularAdminOrder && adminOrder === ticketNextOrder);
          }
        } else {
          // Non-purchase tickets only go through regular admins
          if (!isPurchaseAdmin) {
            setCanApprove(adminOrder === ticketNextOrder);
          } else {
            setCanApprove(false);
          }
        }
      } else {
        setCanApprove(false);
      }
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

      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      const publicId = `tickets/${id}/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { 
          imageBase64: base64, 
          folder: "Edara_Images",
          publicId 
        },
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.url) throw new Error("Failed to get URL from Cloudinary");

      const { error: dbError } = await supabase.from("ticket_attachments").insert({
        ticket_id: id,
        user_id: user.id,
        file_name: selectedFile.name,
        file_path: uploadData.url,
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
      // If it's a Cloudinary URL, open directly
      if (filePath.startsWith('http')) {
        const a = document.createElement('a');
        a.href = filePath;
        a.download = fileName;
        a.target = '_blank';
        a.click();
      } else {
        // Fallback for old Supabase storage files
        const { data, error } = await supabase.storage
          .from('ticket-attachments')
          .download(filePath);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      }
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

      // Get current admin's info (order and purchase status)
      const { data: currentAdmin } = await supabase
        .from("department_admins")
        .select("admin_order, is_purchase_admin")
        .eq("user_id", user.id)
        .eq("department_id", ticket.department_id)
        .single();

      if (!currentAdmin) throw new Error("Admin not found for this department");

      const currentOrder = currentAdmin.admin_order;
      const currentIsPurchaseAdmin = currentAdmin.is_purchase_admin;

      // Determine the approval flow based on ticket type
      // For purchase tickets: regular admins first (by order), then purchase admins (by order)
      // For non-purchase tickets: only regular admins (by order)

      let nextAdmins: any[] = [];
      let nextAdminOrder = currentOrder;
      let nextIsPurchasePhase = currentIsPurchaseAdmin;

      if (currentIsPurchaseAdmin) {
        // Current admin is a purchase admin - check for next purchase admin
        const { data: nextPurchaseAdmins } = await supabase
          .from("department_admins")
          .select("user_id, admin_order")
          .eq("department_id", ticket.department_id)
          .eq("is_purchase_admin", true)
          .gt("admin_order", currentOrder)
          .order("admin_order", { ascending: true })
          .limit(10);

        if (nextPurchaseAdmins && nextPurchaseAdmins.length > 0) {
          // Find next order level among purchase admins
          const nextOrderLevel = nextPurchaseAdmins[0].admin_order;
          nextAdmins = nextPurchaseAdmins.filter(a => a.admin_order === nextOrderLevel);
          nextAdminOrder = nextOrderLevel;
          nextIsPurchasePhase = true;
        }
      } else {
        // Current admin is a regular admin - check for next regular admin first
        const { data: nextRegularAdmins } = await supabase
          .from("department_admins")
          .select("user_id, admin_order")
          .eq("department_id", ticket.department_id)
          .eq("is_purchase_admin", false)
          .gt("admin_order", currentOrder)
          .order("admin_order", { ascending: true })
          .limit(10);

        if (nextRegularAdmins && nextRegularAdmins.length > 0) {
          // Find next order level among regular admins
          const nextOrderLevel = nextRegularAdmins[0].admin_order;
          nextAdmins = nextRegularAdmins.filter(a => a.admin_order === nextOrderLevel);
          nextAdminOrder = nextOrderLevel;
          nextIsPurchasePhase = false;
        } else if (ticket.is_purchase_ticket) {
          // No more regular admins but this is a purchase ticket - move to purchase admins
          const { data: purchaseAdmins } = await supabase
            .from("department_admins")
            .select("user_id, admin_order")
            .eq("department_id", ticket.department_id)
            .eq("is_purchase_admin", true)
            .order("admin_order", { ascending: true })
            .limit(10);

          if (purchaseAdmins && purchaseAdmins.length > 0) {
            // Find first order level among purchase admins
            const firstOrderLevel = purchaseAdmins[0].admin_order;
            nextAdmins = purchaseAdmins.filter(a => a.admin_order === firstOrderLevel);
            nextAdminOrder = firstOrderLevel;
            nextIsPurchasePhase = true;
          }
        }
      }

      const hasNextLevel = nextAdmins.length > 0;

      if (hasNextLevel) {
        // There are more admins - update next_admin_order and send notification
        const { error } = await supabase
          .from("tickets")
          .update({
            next_admin_order: nextAdminOrder,
            status: "In Progress",
          })
          .eq("id", ticket.id);

        if (error) throw error;

        // Send notification to next level admins
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_created",
            ticketId: ticket.id,
            adminOrder: nextAdminOrder,
            isPurchasePhase: nextIsPurchasePhase,
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

  const fetchAvailableAdmins = async () => {
    if (!ticket) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all department admins for this department
      const { data: adminsData, error } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id);

      if (error) throw error;

      const adminUserIds = adminsData?.map(a => a.user_id) || [];
      
      // Filter out current user
      const otherAdminIds = adminUserIds.filter(id => id !== user.id);

      if (otherAdminIds.length > 0) {
        // Fetch profiles for these admins
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", otherAdminIds);

        setAvailableAdmins(profilesData || []);
      } else {
        setAvailableAdmins([]);
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const handleOpenExtraApprovalDialog = async () => {
    await fetchAvailableAdmins();
    setSelectedAdminId("");
    setExtraApprovalDialogOpen(true);
  };

  const handleSendExtraApproval = async () => {
    if (!ticket || !selectedAdminId) return;

    try {
      setSendingExtraApproval(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current user's profile
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // Get recipient's profile
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", selectedAdminId)
        .single();

      // Create notification for the selected admin
      await supabase.from("notifications").insert({
        user_id: selectedAdminId,
        type: "extra_approval_request",
        title: language === 'ar' ? 'طلب موافقة إضافية' : 'Extra Approval Request',
        message: language === 'ar' 
          ? `طلب ${senderProfile?.user_name || 'مستخدم'} موافقتك على التذكرة ${ticket.ticket_number}`
          : `${senderProfile?.user_name || 'User'} requested your approval on ticket ${ticket.ticket_number}`,
        ticket_id: ticket.id,
      });

      // Log the activity
      await supabase.from("ticket_activity_logs").insert({
        ticket_id: ticket.id,
        activity_type: "extra_approval_sent",
        user_id: user.id,
        user_name: senderProfile?.user_name,
        recipient_id: selectedAdminId,
        recipient_name: recipientProfile?.user_name,
        description: language === 'ar'
          ? `تم إرسال طلب موافقة إضافية إلى ${recipientProfile?.user_name}`
          : `Extra approval request sent to ${recipientProfile?.user_name}`,
      });

      // Send email notification
      await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "extra_approval_request",
          ticketId: ticket.id,
          recipientUserId: selectedAdminId,
          senderName: senderProfile?.user_name,
        },
      });

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' 
          ? `تم إرسال طلب الموافقة إلى ${recipientProfile?.user_name}`
          : `Approval request sent to ${recipientProfile?.user_name}`,
      });

      setExtraApprovalDialogOpen(false);
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingExtraApproval(false);
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

  // Check if user can view ticket details (owner or department admin)
  const canViewDetails = isDepartmentAdmin || isTicketOwner;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={() => navigate(sourceRoute)} className="h-8 sm:h-9 text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("ticketDetails.backToTickets")}
        </Button>
        
        {/* Edit button - only show if not approved and user can view details */}
        {canViewDetails && !ticket.approved_at && !isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'تعديل' : 'Edit'}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          {isEditing ? (
            // Edit mode UI
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">{language === 'ar' ? 'تعديل التذكرة' : 'Edit Ticket'}</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="mr-1 h-4 w-4" />
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                    <Save className="mr-1 h-4 w-4" />
                    {savingEdit ? '...' : (language === 'ar' ? 'حفظ' : 'Save')}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{language === 'ar' ? 'القسم' : 'Department'}</label>
                  <Select value={editData.department_id} onValueChange={(v) => setEditData(prev => ({ ...prev, department_id: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">{language === 'ar' ? 'الأولوية' : 'Priority'}</label>
                  <Select value={editData.priority} onValueChange={(v) => setEditData(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
                      <SelectItem value="Medium">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                      <SelectItem value="High">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
                      <SelectItem value="Urgent">{language === 'ar' ? 'عاجل' : 'Urgent'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">{language === 'ar' ? 'الموضوع' : 'Subject'}</label>
                <Input
                  value={editData.subject}
                  onChange={(e) => setEditData(prev => ({ ...prev, subject: e.target.value }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">{language === 'ar' ? 'الوصف' : 'Description'}</label>
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 min-h-[100px]"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">{language === 'ar' ? 'رابط خارجي' : 'External Link'}</label>
                <Input
                  value={editData.external_link}
                  onChange={(e) => setEditData(prev => ({ ...prev, external_link: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
              
              <div className="flex items-center space-x-3 p-4 border rounded-md">
                <Checkbox
                  checked={editData.is_purchase_ticket}
                  onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_purchase_ticket: checked as boolean }))}
                />
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'طلب شراء' : 'Purchase Request'}
                </label>
              </div>
              
              {/* Purchase ticket fields */}
              {editData.is_purchase_ticket && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <h3 className="font-medium">{language === 'ar' ? 'تفاصيل الشراء' : 'Purchase Details'}</h3>
                  
                  <div>
                    <label className="text-sm font-medium">{language === 'ar' ? 'قيمة الميزانية' : 'Budget Value'}</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.budget_value ?? ''}
                      onChange={(e) => setEditData(prev => ({ ...prev, budget_value: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">{language === 'ar' ? 'الكمية' : 'Quantity'}</label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={editData.qty ?? ''}
                        onChange={(e) => setEditData(prev => ({ ...prev, qty: e.target.value ? parseFloat(e.target.value) : null }))}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">{language === 'ar' ? 'وحدة القياس' : 'UOM'}</label>
                      <Select value={editData.uom || ""} onValueChange={(v) => setEditData(prev => ({ ...prev, uom: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={language === 'ar' ? 'اختر الوحدة' : 'Select UOM'} />
                        </SelectTrigger>
                        <SelectContent>
                          {uomList.map((uom) => (
                            <SelectItem key={uom.id} value={uom.uom_code}>
                              {language === 'ar' && uom.uom_name_ar ? uom.uom_name_ar : uom.uom_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-sm font-medium">{language === 'ar' ? 'إضافة وحدة قياس جديدة' : 'Add New UOM'}</label>
                      <Input
                        value={newUomName}
                        onChange={(e) => setNewUomName(e.target.value)}
                        placeholder={language === 'ar' ? 'اسم الوحدة' : 'UOM name'}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddNewUom}
                      disabled={addingUom || !newUomName.trim()}
                    >
                      {addingUom ? '...' : (language === 'ar' ? 'إضافة' : 'Add')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // View mode UI
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div>
                  <CardTitle className="text-lg sm:text-2xl">
                    {canViewDetails 
                      ? ticket.subject 
                      : (language === 'ar' ? '--- محتوى مخفي ---' : '--- Hidden Content ---')}
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                    {t("ticketDetails.ticketNumber")}{ticket.ticket_number}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <Badge variant={getPriorityColor(ticket.priority)} className="text-xs">
                    {ticket.priority}
                  </Badge>
                  <Badge variant={getStatusColor(ticket.status)} className="text-xs">
                    {ticket.status}
                  </Badge>
                  {ticket.is_purchase_ticket && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <ShoppingCart className="h-3 w-3" />
                      {language === 'ar' ? 'مشتريات' : 'Purchase'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-muted-foreground">{t("ticketDetails.department")}</span>
                  <span className="sm:ml-2 font-medium">{ticket.departments.department_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-muted-foreground">{t("ticketDetails.created")}</span>
                  <span className="sm:ml-2">{format(new Date(ticket.created_at), "PPp")}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-muted-foreground">{t("ticketDetails.createdBy")}</span>
                  <span className="sm:ml-2">{ticket.profiles.user_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-muted-foreground">{t("ticketDetails.email")}</span>
                  <span className="sm:ml-2 truncate">{ticket.profiles.email}</span>
                </div>
                {ticket.external_link && (
                  <div className="flex flex-col sm:flex-row sm:items-center col-span-1 sm:col-span-2">
                    <span className="text-muted-foreground">{language === 'ar' ? 'رابط خارجي:' : 'External Link:'}</span>
                    <a 
                      href={ticket.external_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="sm:ml-2 text-primary hover:underline truncate"
                    >
                      {ticket.external_link}
                    </a>
                  </div>
                )}
                
                {/* Purchase ticket fields display */}
                {ticket.is_purchase_ticket && (
                  <>
                    {ticket.budget_value !== null && (
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-muted-foreground">{language === 'ar' ? 'الميزانية:' : 'Budget:'}</span>
                        <span className="sm:ml-2 font-medium">{ticket.budget_value?.toLocaleString()}</span>
                      </div>
                    )}
                    {ticket.qty !== null && (
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <span className="text-muted-foreground">{language === 'ar' ? 'الكمية:' : 'Quantity:'}</span>
                        <span className="sm:ml-2 font-medium">{ticket.qty} {ticket.uom || ''}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-4">
            {!isEditing && (
              <div>
                <h3 className="font-semibold mb-2">{t("ticketDetails.description")}</h3>
                {canViewDetails ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                ) : (
                  <p className="text-muted-foreground italic">
                    {language === 'ar' 
                      ? 'لا يمكنك عرض تفاصيل هذه التذكرة لأنك لست مسؤولاً عن هذا القسم' 
                      : 'You cannot view this ticket\'s details as you are not an admin for this department'}
                  </p>
                )}
              </div>
            )}

            {isAdmin && (
              <>
                <Separator />
                <div className="space-y-3">
                {canApprove && (
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
                  
                  {/* Send for Extra Approval button */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleOpenExtraApprovalDialog}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إرسال لموافقة إضافية' : 'Send for Extra Approval'}
                    </Button>
                  </div>

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
              <div className="mb-4 p-3 sm:p-4 border rounded-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploading}
                    size="sm"
                    className="w-full sm:w-auto"
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

      {/* Extra Approval Dialog */}
      <Dialog open={extraApprovalDialogOpen} onOpenChange={setExtraApprovalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'إرسال لموافقة إضافية' : 'Send for Extra Approval'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {language === 'ar' ? 'اختر المسؤول' : 'Select Admin'}
              </label>
              <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر مسؤولاً...' : 'Select an admin...'} />
                </SelectTrigger>
                <SelectContent>
                  {availableAdmins.map((admin) => (
                    <SelectItem key={admin.user_id} value={admin.user_id}>
                      {admin.user_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableAdmins.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'لا يوجد مسؤولين آخرين متاحين' : 'No other admins available'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtraApprovalDialogOpen(false)}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSendExtraApproval}
              disabled={!selectedAdminId || sendingExtraApproval}
            >
              {sendingExtraApproval 
                ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') 
                : (language === 'ar' ? 'إرسال' : 'Send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketDetails;
