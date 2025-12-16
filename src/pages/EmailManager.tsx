import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail,
  Inbox,
  Send,
  Star,
  RefreshCw,
  Plus,
  Paperclip,
  Reply,
  Forward,
  TicketIcon,
  ListTodo,
  Search,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface UserEmailConfig {
  email: string;
  email_password: string | null;
  user_name: string;
  mail_type: {
    id: string;
    type_name: string;
    imap_host: string;
    imap_port: number;
    imap_secure: boolean;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
  } | null;
}

interface Email {
  id: string;
  user_id: string;
  message_id: string;
  folder: string;
  subject: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: any;
  cc_addresses: any;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  has_attachments: boolean;
  email_date: string;
  linked_ticket_id: string | null;
  linked_task_id: string | null;
}
interface Department {
  id: string;
  department_name: string;
}

// Client-side MIME decoder for fallback
const decodeMimeWord = (text: string): string => {
  if (!text) return text;
  
  // Check if it's MIME encoded
  if (!text.includes('=?')) return text;
  
  const mimePattern = /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi;
  
  return text.replace(mimePattern, (match, charset, encoding, encodedText) => {
    try {
      let decoded = '';
      
      if (encoding.toUpperCase() === 'Q') {
        // Quoted-Printable decoding
        decoded = encodedText
          .replace(/_/g, ' ')
          .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) => 
            String.fromCharCode(parseInt(hex, 16))
          );
      } else if (encoding.toUpperCase() === 'B') {
        // Base64 decoding
        decoded = atob(encodedText);
      } else {
        return match;
      }
      
      // Convert bytes to proper charset
      const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
      return new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch (e) {
      console.error('MIME decode error:', e);
      return match;
    }
  });
};

const EmailManager = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  
  const [activeTab, setActiveTab] = useState("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [userConfig, setUserConfig] = useState<UserEmailConfig | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);
  
  // Compose dialog
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
  });
  const [sending, setSending] = useState(false);

  // Create ticket/task dialogs
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [ticketData, setTicketData] = useState({
    department_id: "",
    subject: "",
    description: "",
    priority: "Medium",
  });
  const [taskData, setTaskData] = useState({
    department_id: "",
    title: "",
    description: "",
    priority: "medium",
  });

  useEffect(() => {
    fetchUserEmailConfig();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (userConfig?.mail_type) {
      fetchEmails();
      fetchEmailCounts();
    }
  }, [userConfig, activeTab]);

  const fetchUserEmailConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          email,
          email_password,
          user_name,
          mail_type:mail_types(
            id,
            type_name,
            imap_host,
            imap_port,
            imap_secure,
            smtp_host,
            smtp_port,
            smtp_secure
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      
      if (!data.mail_type) {
        setConfigError(isArabic 
          ? "لم يتم تحديد نوع البريد. يرجى تحديث إعدادات المستخدم الخاصة بك."
          : "Mail type not set. Please update your user settings."
        );
      } else if (!data.email_password) {
        setConfigError(isArabic
          ? "لم يتم تعيين كلمة مرور البريد الإلكتروني. يرجى تحديث إعدادات المستخدم الخاصة بك."
          : "Email password not set. Please update your user settings."
        );
      } else {
        setConfigError(null);
      }
      
      setUserConfig(data as UserEmailConfig);
    } catch (error) {
      console.error("Error fetching user email config:", error);
      setConfigError(isArabic ? "خطأ في جلب الإعدادات" : "Error fetching settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    if (!userConfig?.mail_type) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let folder = "INBOX";
      if (activeTab === "sent") folder = "Sent";

      let query = supabase
        .from("emails")
        .select("*")
        .eq("user_id", user.id)
        .order("email_date", { ascending: false });

      if (activeTab === "starred") {
        query = query.eq("is_starred", true);
      } else if (activeTab === "drafts") {
        query = query.eq("is_draft", true);
      } else {
        query = query.eq("folder", folder);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  const fetchEmailCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get inbox count
      const { count: inbox } = await supabase
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("folder", "INBOX");
      setInboxCount(inbox || 0);

      // Get sent count
      const { count: sent } = await supabase
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("folder", "Sent");
      setSentCount(sent || 0);

      // Get starred count
      const { count: starred } = await supabase
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_starred", true);
      setStarredCount(starred || 0);
    } catch (error) {
      console.error("Error fetching email counts:", error);
    }
  };

  const syncEmailsFromServer = async () => {
    if (!userConfig?.mail_type || !userConfig.email_password) {
      toast.error(isArabic ? "إعدادات البريد غير مكتملة" : "Email settings incomplete");
      return;
    }

    setSyncing(true);
    setSyncStatus(isArabic ? "جاري الاتصال بالخادم..." : "Connecting to server...");
    
    try {
      const folder = activeTab === "sent" ? "Sent" : "INBOX";
      
      setSyncStatus(isArabic ? "جاري جلب الرسائل..." : "Fetching emails...");
      
      const { data, error } = await supabase.functions.invoke("fetch-emails-imap", {
        body: {
          imapHost: userConfig.mail_type.imap_host,
          imapPort: userConfig.mail_type.imap_port,
          imapSecure: userConfig.mail_type.imap_secure,
          email: userConfig.email,
          emailPassword: userConfig.email_password,
          folder: folder,
          limit: 50,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setSyncStatus(isArabic ? "جاري حفظ الرسائل..." : "Saving emails...");
        toast.success(
          isArabic 
            ? `تم جلب ${data.fetched} رسالة (${data.saved} جديدة)` 
            : `Fetched ${data.fetched} emails (${data.saved} new)`
        );
        await fetchEmails();
      } else {
        throw new Error(data?.error || "Unknown error");
      }
    } catch (error: any) {
      console.error("Error syncing emails:", error);
      toast.error(isArabic ? "خطأ في مزامنة البريد" : "Error syncing emails");
    } finally {
      setSyncing(false);
      setSyncStatus("");
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name")
        .eq("is_active", true);

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleSendEmail = async () => {
    if (!userConfig?.mail_type || !composeData.to || !composeData.subject) {
      toast.error(isArabic ? "الرجاء ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email-smtp", {
        body: {
          to: composeData.to.split(",").map(e => e.trim()),
          cc: composeData.cc ? composeData.cc.split(",").map(e => e.trim()) : [],
          subject: composeData.subject,
          body: composeData.body,
          fromName: userConfig.user_name,
          fromEmail: userConfig.email,
          smtpHost: userConfig.mail_type.smtp_host,
          smtpPort: userConfig.mail_type.smtp_port,
          smtpSecure: userConfig.mail_type.smtp_secure,
          emailPassword: userConfig.email_password,
        },
      });

      if (error) throw error;

      toast.success(isArabic ? "تم إرسال البريد بنجاح" : "Email sent successfully");
      setIsComposeOpen(false);
      setComposeData({ to: "", cc: "", subject: "", body: "" });
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(isArabic ? "خطأ في إرسال البريد" : "Error sending email");
    } finally {
      setSending(false);
    }
  };

  const handleToggleStar = async (email: Email) => {
    try {
      const { error } = await supabase
        .from("emails")
        .update({ is_starred: !email.is_starred })
        .eq("id", email.id);

      if (error) throw error;
      
      setEmails(emails.map(e => 
        e.id === email.id ? { ...e, is_starred: !e.is_starred } : e
      ));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail({ ...selectedEmail, is_starred: !selectedEmail.is_starred });
      }
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  };

  const handleMarkAsRead = async (email: Email) => {
    if (email.is_read) return;
    
    try {
      const { error } = await supabase
        .from("emails")
        .update({ is_read: true })
        .eq("id", email.id);

      if (error) throw error;
      
      setEmails(emails.map(e => 
        e.id === email.id ? { ...e, is_read: true } : e
      ));
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    handleMarkAsRead(email);
  };

  const openCreateTicket = () => {
    if (!selectedEmail) return;
    setTicketData({
      department_id: "",
      subject: selectedEmail.subject || "",
      description: selectedEmail.body_text || "",
      priority: "Medium",
    });
    setIsCreateTicketOpen(true);
  };

  const openCreateTask = () => {
    if (!selectedEmail) return;
    setTaskData({
      department_id: "",
      title: selectedEmail.subject || "",
      description: selectedEmail.body_text || "",
      priority: "medium",
    });
    setIsCreateTaskOpen(true);
  };

  const handleCreateTicket = async () => {
    if (!ticketData.department_id || !ticketData.subject) {
      toast.error(isArabic ? "الرجاء ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          department_id: ticketData.department_id,
          subject: ticketData.subject,
          description: ticketData.description,
          priority: ticketData.priority,
          ticket_number: "", // Auto-generated by trigger
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Link email to ticket
      if (selectedEmail) {
        await supabase
          .from("emails")
          .update({ linked_ticket_id: data.id })
          .eq("id", selectedEmail.id);
      }

      toast.success(isArabic ? "تم إنشاء التذكرة بنجاح" : "Ticket created successfully");
      setIsCreateTicketOpen(false);
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error(isArabic ? "خطأ في إنشاء التذكرة" : "Error creating ticket");
    }
  };

  const handleCreateTask = async () => {
    if (!taskData.department_id || !taskData.title) {
      toast.error(isArabic ? "الرجاء ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          department_id: taskData.department_id,
          assigned_to: user.id,
          created_by: user.id,
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
        })
        .select()
        .single();

      if (error) throw error;

      // Link email to task
      if (selectedEmail) {
        await supabase
          .from("emails")
          .update({ linked_task_id: data.id })
          .eq("id", selectedEmail.id);
      }

      toast.success(isArabic ? "تم إنشاء المهمة بنجاح" : "Task created successfully");
      setIsCreateTaskOpen(false);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error(isArabic ? "خطأ في إنشاء المهمة" : "Error creating task");
    }
  };

  const filteredEmails = emails.filter(email => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(search) ||
      email.from_address?.toLowerCase().includes(search) ||
      email.from_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (configError) {
    return (
      <div className="container mx-auto p-6" dir={isArabic ? "rtl" : "ltr"}>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {isArabic ? "إعداد مطلوب" : "Setup Required"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{configError}</p>
            <p className="text-sm">
              {isArabic 
                ? "اذهب إلى إعداد المستخدم وقم بتعيين نوع البريد وكلمة مرور البريد الإلكتروني."
                : "Go to User Setup and set your Mail Type and Email Password."
              }
            </p>
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="font-medium">{isArabic ? "البريد الحالي:" : "Current Email:"}</p>
              <p className="text-sm">{userConfig?.email || "-"}</p>
              <p className="font-medium">{isArabic ? "نوع البريد:" : "Mail Type:"}</p>
              <p className="text-sm">{userConfig?.mail_type?.type_name || (isArabic ? "غير محدد" : "Not set")}</p>
              <p className="font-medium">{isArabic ? "كلمة المرور:" : "Password:"}</p>
              <p className="text-sm">{userConfig?.email_password ? "••••••••" : (isArabic ? "غير محددة" : "Not set")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{isArabic ? "مدير البريد" : "Email Manager"}</h1>
            <p className="text-sm text-muted-foreground">
              {userConfig?.email} ({userConfig?.mail_type?.type_name})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">{syncStatus}</span>
            </div>
          )}
          <Button variant="outline" onClick={syncEmailsFromServer} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"} ${syncing ? "animate-spin" : ""}`} />
            {isArabic ? "مزامنة" : "Sync"}
          </Button>
          <Button onClick={() => setIsComposeOpen(true)}>
            <Plus className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
            {isArabic ? "رسالة جديدة" : "Compose"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="col-span-3">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Email Account Info */}
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-sm font-medium truncate">{userConfig?.user_name || userConfig?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{userConfig?.email}</p>
                <p className="text-xs text-muted-foreground">{userConfig?.mail_type?.type_name}</p>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical">
                <TabsList className="flex flex-col w-full h-auto bg-transparent gap-1">
                  <TabsTrigger value="inbox" className="w-full justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Inbox className="h-4 w-4" />
                      {isArabic ? "الوارد" : "Inbox"}
                    </span>
                    {inboxCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{inboxCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="w-full justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      {isArabic ? "المرسل" : "Sent"}
                    </span>
                    {sentCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{sentCount}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="starred" className="w-full justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      {isArabic ? "المميز" : "Starred"}
                    </span>
                    {starredCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{starredCount}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Email List */}
        <div className="col-span-4">
          <Card className="h-[calc(100vh-200px)]">
            <CardHeader className="pb-2">
              <div className="relative">
                <Search className={`absolute ${isArabic ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
                <Input
                  placeholder={isArabic ? "بحث..." : "Search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={isArabic ? "pr-9" : "pl-9"}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-300px)]">
                {filteredEmails.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {isArabic ? "لا توجد رسائل" : "No emails"}
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={`p-3 border-b cursor-pointer hover:bg-accent transition-colors ${
                        selectedEmail?.id === email.id ? "bg-accent" : ""
                      } ${!email.is_read ? "bg-primary/5 font-medium" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {decodeMimeWord(email.from_name || '') || email.from_address}
                          </p>
                          <p className="text-sm truncate font-medium">
                            {decodeMimeWord(email.subject || '') || (isArabic ? "(بدون موضوع)" : "(No subject)")}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {decodeMimeWord(email.body_text || '')?.substring(0, 50) || '...'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(email.email_date), "MMM d, h:mm a")}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStar(email);
                            }}
                          >
                            <Star
                              className={`h-4 w-4 ${
                                email.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Email View */}
        <div className="col-span-5">
          <Card className="h-[calc(100vh-200px)]">
            {selectedEmail ? (
              <>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg">
                        {decodeMimeWord(selectedEmail.subject || '') || (isArabic ? "(بدون موضوع)" : "(No subject)")}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {isArabic ? "من:" : "From:"} {decodeMimeWord(selectedEmail.from_name || '') || selectedEmail.from_address}
                        {selectedEmail.from_name && (
                          <span className="text-xs ml-1">&lt;{selectedEmail.from_address}&gt;</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedEmail.email_date), "PPpp")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title={isArabic ? "رد" : "Reply"}>
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title={isArabic ? "تحويل" : "Forward"}>
                        <Forward className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={openCreateTicket} title={isArabic ? "إنشاء تذكرة" : "Create Ticket"}>
                        <TicketIcon className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={openCreateTask} title={isArabic ? "إنشاء مهمة" : "Create Task"}>
                        <ListTodo className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-4">
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    {selectedEmail.body_html ? (
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                      />
                    ) : selectedEmail.body_text ? (
                      <pre className="whitespace-pre-wrap text-sm font-sans">
                        {decodeMimeWord(selectedEmail.body_text)}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {isArabic ? "لا يوجد محتوى" : "No content available"}
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </>
            ) : (
              <CardContent className="h-full flex items-center justify-center text-muted-foreground">
                {isArabic ? "اختر رسالة لعرضها" : "Select an email to view"}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isArabic ? "رسالة جديدة" : "New Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? "إلى" : "To"}</Label>
              <Input
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                placeholder={isArabic ? "البريد الإلكتروني" : "email@example.com"}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "نسخة" : "CC"}</Label>
              <Input
                value={composeData.cc}
                onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الموضوع" : "Subject"}</Label>
              <Input
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الرسالة" : "Message"}</Label>
              <Textarea
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              <Send className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
              {sending ? (isArabic ? "جاري الإرسال..." : "Sending...") : (isArabic ? "إرسال" : "Send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={isCreateTicketOpen} onOpenChange={setIsCreateTicketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? "إنشاء تذكرة" : "Create Ticket"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? "القسم" : "Department"}</Label>
              <Select
                value={ticketData.department_id}
                onValueChange={(value) => setTicketData({ ...ticketData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isArabic ? "اختر القسم" : "Select department"} />
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
            <div className="space-y-2">
              <Label>{isArabic ? "الموضوع" : "Subject"}</Label>
              <Input
                value={ticketData.subject}
                onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea
                value={ticketData.description}
                onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الأولوية" : "Priority"}</Label>
              <Select
                value={ticketData.priority}
                onValueChange={(value) => setTicketData({ ...ticketData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">{isArabic ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="Medium">{isArabic ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="High">{isArabic ? "عالية" : "High"}</SelectItem>
                  <SelectItem value="Urgent">{isArabic ? "عاجلة" : "Urgent"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTicketOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateTicket}>
              {isArabic ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isArabic ? "إنشاء مهمة" : "Create Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? "القسم" : "Department"}</Label>
              <Select
                value={taskData.department_id}
                onValueChange={(value) => setTaskData({ ...taskData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isArabic ? "اختر القسم" : "Select department"} />
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
            <div className="space-y-2">
              <Label>{isArabic ? "العنوان" : "Title"}</Label>
              <Input
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الأولوية" : "Priority"}</Label>
              <Select
                value={taskData.priority}
                onValueChange={(value) => setTaskData({ ...taskData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{isArabic ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="medium">{isArabic ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="high">{isArabic ? "عالية" : "High"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateTask}>
              {isArabic ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailManager;
