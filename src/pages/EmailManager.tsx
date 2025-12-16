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
  Trash2,
  RefreshCw,
  Plus,
  Settings,
  Paperclip,
  Reply,
  Forward,
  TicketIcon,
  ListTodo,
  Link2,
  Search,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";

interface EmailConfig {
  id: string;
  user_id: string;
  email_address: string;
  display_name: string | null;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  email_username: string;
  email_password: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
}

interface Email {
  id: string;
  user_id: string;
  config_id: string;
  message_id: string;
  folder: string;
  subject: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: any;
  cc_addresses: any;
  bcc_addresses: any;
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

const EmailManager = () => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("inbox");
  const [emails, setEmails] = useState<Email[]>([]);
  const [emailConfigs, setEmailConfigs] = useState<EmailConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  
  // Compose dialog
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
  });
  const [sending, setSending] = useState(false);

  // Settings dialog
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EmailConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [configFormData, setConfigFormData] = useState({
    email_address: "",
    display_name: "",
    imap_host: "",
    imap_port: 993,
    imap_secure: true,
    smtp_host: "",
    smtp_port: 465,
    smtp_secure: true,
    email_username: "",
    email_password: "",
  });

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
    fetchEmailConfigs();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      fetchEmails();
    }
  }, [selectedConfig, activeTab]);

  const fetchEmailConfigs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_email_configs")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setEmailConfigs(data || []);
      if (data && data.length > 0 && !selectedConfig) {
        setSelectedConfig(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching email configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    if (!selectedConfig) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let folder = "INBOX";
      if (activeTab === "sent") folder = "SENT";
      if (activeTab === "starred") folder = "STARRED";
      if (activeTab === "drafts") folder = "DRAFTS";

      let query = supabase
        .from("emails")
        .select("*")
        .eq("user_id", user.id)
        .eq("config_id", selectedConfig)
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

  const handleSyncEmails = async () => {
    if (!selectedConfig) {
      toast.error(language === "ar" ? "الرجاء اختيار حساب بريد" : "Please select an email account");
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-emails", {
        body: { configId: selectedConfig },
      });

      if (error) throw error;

      toast.success(language === "ar" ? "تم مزامنة البريد بنجاح" : "Emails synced successfully");
      fetchEmails();
    } catch (error: any) {
      console.error("Error syncing emails:", error);
      toast.error(language === "ar" ? "خطأ في مزامنة البريد" : "Error syncing emails");
    } finally {
      setSyncing(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedConfig || !composeData.to || !composeData.subject) {
      toast.error(language === "ar" ? "الرجاء ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    setSending(true);
    try {
      const config = emailConfigs.find(c => c.id === selectedConfig);
      if (!config) throw new Error("Config not found");

      const { data, error } = await supabase.functions.invoke("send-email-smtp", {
        body: {
          configId: selectedConfig,
          to: composeData.to.split(",").map(e => e.trim()),
          cc: composeData.cc ? composeData.cc.split(",").map(e => e.trim()) : [],
          subject: composeData.subject,
          body: composeData.body,
          fromName: config.display_name || config.email_address,
          fromEmail: config.email_address,
        },
      });

      if (error) throw error;

      toast.success(language === "ar" ? "تم إرسال البريد بنجاح" : "Email sent successfully");
      setIsComposeOpen(false);
      setComposeData({ to: "", cc: "", subject: "", body: "" });
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(language === "ar" ? "خطأ في إرسال البريد" : "Error sending email");
    } finally {
      setSending(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const configData = {
        ...configFormData,
        user_id: user.id,
      };

      if (editingConfig) {
        const { error } = await supabase
          .from("user_email_configs")
          .update(configData)
          .eq("id", editingConfig.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الإعدادات" : "Settings updated");
      } else {
        const { error } = await supabase
          .from("user_email_configs")
          .insert(configData);

        if (error) throw error;
        toast.success(language === "ar" ? "تمت إضافة حساب البريد" : "Email account added");
      }

      setIsSettingsOpen(false);
      setEditingConfig(null);
      resetConfigForm();
      fetchEmailConfigs();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الإعدادات" : "Error saving settings");
    }
  };

  const resetConfigForm = () => {
    setConfigFormData({
      email_address: "",
      display_name: "",
      imap_host: "",
      imap_port: 993,
      imap_secure: true,
      smtp_host: "",
      smtp_port: 465,
      smtp_secure: true,
      email_username: "",
      email_password: "",
    });
  };

  const handleEditConfig = (config: EmailConfig) => {
    setEditingConfig(config);
    setConfigFormData({
      email_address: config.email_address,
      display_name: config.display_name || "",
      imap_host: config.imap_host,
      imap_port: config.imap_port,
      imap_secure: config.imap_secure,
      smtp_host: config.smtp_host,
      smtp_port: config.smtp_port,
      smtp_secure: config.smtp_secure,
      email_username: config.email_username,
      email_password: config.email_password,
    });
    setIsSettingsOpen(true);
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

  const handleCreateTicketFromEmail = async () => {
    if (!selectedEmail || !ticketData.department_id) {
      toast.error(language === "ar" ? "الرجاء اختيار القسم" : "Please select department");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          department_id: ticketData.department_id,
          subject: ticketData.subject || selectedEmail.subject || "Email Ticket",
          description: ticketData.description || selectedEmail.body_text || "",
          priority: ticketData.priority,
          status: "Open",
          ticket_number: "",
        })
        .select()
        .single();

      if (error) throw error;

      // Link email to ticket
      await supabase
        .from("emails")
        .update({ linked_ticket_id: ticket.id })
        .eq("id", selectedEmail.id);

      toast.success(language === "ar" ? "تم إنشاء التذكرة بنجاح" : "Ticket created successfully");
      setIsCreateTicketOpen(false);
      setTicketData({ department_id: "", subject: "", description: "", priority: "Medium" });
      fetchEmails();
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error(language === "ar" ? "خطأ في إنشاء التذكرة" : "Error creating ticket");
    }
  };

  const handleCreateTaskFromEmail = async () => {
    if (!selectedEmail || !taskData.department_id) {
      toast.error(language === "ar" ? "الرجاء اختيار القسم" : "Please select department");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          created_by: user.id,
          assigned_to: user.id,
          department_id: taskData.department_id,
          title: taskData.title || selectedEmail.subject || "Email Task",
          description: taskData.description || selectedEmail.body_text || "",
          priority: taskData.priority,
          status: "todo",
        })
        .select()
        .single();

      if (error) throw error;

      // Link email to task
      await supabase
        .from("emails")
        .update({ linked_task_id: task.id })
        .eq("id", selectedEmail.id);

      toast.success(language === "ar" ? "تم إنشاء المهمة بنجاح" : "Task created successfully");
      setIsCreateTaskOpen(false);
      setTaskData({ department_id: "", title: "", description: "", priority: "medium" });
      fetchEmails();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error(language === "ar" ? "خطأ في إنشاء المهمة" : "Error creating task");
    }
  };

  const handleReply = (email: Email) => {
    setComposeData({
      to: email.from_address,
      cc: "",
      subject: `Re: ${email.subject || ""}`,
      body: `\n\n---\n${language === "ar" ? "من:" : "From:"} ${email.from_name || email.from_address}\n${language === "ar" ? "التاريخ:" : "Date:"} ${format(new Date(email.email_date), "PPpp")}\n\n${email.body_text || ""}`,
    });
    setIsComposeOpen(true);
  };

  const filteredEmails = emails.filter(email =>
    (email.subject || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (email.from_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (email.from_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentConfig = emailConfigs.find(c => c.id === selectedConfig);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "مدير البريد الإلكتروني" : "Email Manager"}
        </h1>
        <div className="flex items-center gap-2">
          {emailConfigs.length > 0 && (
            <Select value={selectedConfig} onValueChange={setSelectedConfig}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder={language === "ar" ? "اختر حساب البريد" : "Select email account"} />
              </SelectTrigger>
              <SelectContent>
                {emailConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.display_name || config.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="icon" onClick={handleSyncEmails} disabled={syncing || !selectedConfig}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setIsComposeOpen(true)} disabled={!selectedConfig}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "رسالة جديدة" : "Compose"}
          </Button>
          <Button variant="outline" onClick={() => { setEditingConfig(null); resetConfigForm(); setIsSettingsOpen(true); }}>
            <Settings className="h-4 w-4 mr-2" />
            {language === "ar" ? "الإعدادات" : "Settings"}
          </Button>
        </div>
      </div>

      {emailConfigs.length === 0 && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-center">
                {language === "ar" ? "لا يوجد حساب بريد مرتبط" : "No Email Account Connected"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                {language === "ar" 
                  ? "قم بإضافة حساب بريد إلكتروني لبدء إدارة رسائلك" 
                  : "Add an email account to start managing your emails"}
              </p>
              <Button onClick={() => { setEditingConfig(null); resetConfigForm(); setIsSettingsOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                {language === "ar" ? "إضافة حساب بريد" : "Add Email Account"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r p-4 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="w-full">
              <TabsList className="flex flex-col h-auto w-full bg-transparent space-y-1">
                <TabsTrigger value="inbox" className="w-full justify-start gap-2">
                  <Inbox className="h-4 w-4" />
                  {language === "ar" ? "صندوق الوارد" : "Inbox"}
                </TabsTrigger>
                <TabsTrigger value="sent" className="w-full justify-start gap-2">
                  <Send className="h-4 w-4" />
                  {language === "ar" ? "المرسلة" : "Sent"}
                </TabsTrigger>
                <TabsTrigger value="starred" className="w-full justify-start gap-2">
                  <Star className="h-4 w-4" />
                  {language === "ar" ? "المميزة" : "Starred"}
                </TabsTrigger>
                <TabsTrigger value="drafts" className="w-full justify-start gap-2">
                  <Mail className="h-4 w-4" />
                  {language === "ar" ? "المسودات" : "Drafts"}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Separator />

            {/* Quick account settings */}
            {currentConfig && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === "ar" ? "الحساب الحالي" : "Current Account"}</p>
                <p className="text-xs text-muted-foreground truncate">{currentConfig.email_address}</p>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleEditConfig(currentConfig)}>
                  <Settings className="h-3 w-3 mr-2" />
                  {language === "ar" ? "تعديل الإعدادات" : "Edit Settings"}
                </Button>
              </div>
            )}
          </div>

          {/* Email List */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث..." : "Search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {filteredEmails.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {language === "ar" ? "لا توجد رسائل" : "No emails"}
                </div>
              ) : (
                filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${
                      selectedEmail?.id === email.id ? "bg-muted" : ""
                    } ${!email.is_read ? "font-semibold" : ""}`}
                    onClick={() => {
                      setSelectedEmail(email);
                      handleMarkAsRead(email);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{email.from_name || email.from_address}</p>
                        <p className="text-sm truncate">{email.subject || "(No Subject)"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {email.body_text?.substring(0, 50) || ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(email.email_date), "MMM d")}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(email);
                          }}
                        >
                          <Star className={`h-3 w-3 ${email.is_starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        </Button>
                        {(email.linked_ticket_id || email.linked_task_id) && (
                          <Link2 className="h-3 w-3 text-primary" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Email Content */}
          <div className="flex-1 flex flex-col">
            {selectedEmail ? (
              <>
                <div className="p-4 border-b space-y-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {language === "ar" ? "رجوع" : "Back"}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleReply(selectedEmail)}>
                        <Reply className="h-4 w-4 mr-1" />
                        {language === "ar" ? "رد" : "Reply"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setTicketData({
                          department_id: "",
                          subject: selectedEmail.subject || "",
                          description: selectedEmail.body_text || "",
                          priority: "Medium",
                        });
                        setIsCreateTicketOpen(true);
                      }}>
                        <TicketIcon className="h-4 w-4 mr-1" />
                        {language === "ar" ? "تذكرة" : "Ticket"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setTaskData({
                          department_id: "",
                          title: selectedEmail.subject || "",
                          description: selectedEmail.body_text || "",
                          priority: "medium",
                        });
                        setIsCreateTaskOpen(true);
                      }}>
                        <ListTodo className="h-4 w-4 mr-1" />
                        {language === "ar" ? "مهمة" : "Task"}
                      </Button>
                    </div>
                  </div>
                  <h2 className="text-xl font-semibold">{selectedEmail.subject || "(No Subject)"}</h2>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{language === "ar" ? "من:" : "From:"} {selectedEmail.from_name || selectedEmail.from_address}</span>
                    <span>{format(new Date(selectedEmail.email_date), "PPpp")}</span>
                  </div>
                  {selectedEmail.linked_ticket_id && (
                    <Badge variant="secondary">
                      <TicketIcon className="h-3 w-3 mr-1" />
                      {language === "ar" ? "مرتبط بتذكرة" : "Linked to Ticket"}
                    </Badge>
                  )}
                  {selectedEmail.linked_task_id && (
                    <Badge variant="secondary">
                      <ListTodo className="h-3 w-3 mr-1" />
                      {language === "ar" ? "مرتبط بمهمة" : "Linked to Task"}
                    </Badge>
                  )}
                </div>
                <ScrollArea className="flex-1 p-4">
                  {selectedEmail.body_html ? (
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{selectedEmail.body_text}</pre>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                {language === "ar" ? "اختر رسالة لعرضها" : "Select an email to view"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "رسالة جديدة" : "New Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "إلى" : "To"}</Label>
              <Input
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                placeholder={language === "ar" ? "عناوين البريد (مفصولة بفواصل)" : "Email addresses (comma separated)"}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "نسخة" : "CC"}</Label>
              <Input
                value={composeData.cc}
                onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                placeholder={language === "ar" ? "عناوين البريد (مفصولة بفواصل)" : "Email addresses (comma separated)"}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الموضوع" : "Subject"}</Label>
              <Input
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الرسالة" : "Message"}</Label>
              <Textarea
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? (language === "ar" ? "جاري الإرسال..." : "Sending...") : (language === "ar" ? "إرسال" : "Send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-lg" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingConfig 
                ? (language === "ar" ? "تعديل حساب البريد" : "Edit Email Account")
                : (language === "ar" ? "إضافة حساب بريد جديد" : "Add New Email Account")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === "ar" ? "البريد الإلكتروني" : "Email Address"}</Label>
                <Input
                  value={configFormData.email_address}
                  onChange={(e) => setConfigFormData({ ...configFormData, email_address: e.target.value })}
                />
              </div>
              <div>
                <Label>{language === "ar" ? "اسم العرض" : "Display Name"}</Label>
                <Input
                  value={configFormData.display_name}
                  onChange={(e) => setConfigFormData({ ...configFormData, display_name: e.target.value })}
                />
              </div>
            </div>
            
            <Separator />
            <p className="font-medium">{language === "ar" ? "إعدادات IMAP (استلام)" : "IMAP Settings (Receiving)"}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === "ar" ? "الخادم" : "Host"}</Label>
                <Input
                  value={configFormData.imap_host}
                  onChange={(e) => setConfigFormData({ ...configFormData, imap_host: e.target.value })}
                  placeholder="imap.example.com"
                />
              </div>
              <div>
                <Label>{language === "ar" ? "المنفذ" : "Port"}</Label>
                <Input
                  type="number"
                  value={configFormData.imap_port}
                  onChange={(e) => setConfigFormData({ ...configFormData, imap_port: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <Separator />
            <p className="font-medium">{language === "ar" ? "إعدادات SMTP (إرسال)" : "SMTP Settings (Sending)"}</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === "ar" ? "الخادم" : "Host"}</Label>
                <Input
                  value={configFormData.smtp_host}
                  onChange={(e) => setConfigFormData({ ...configFormData, smtp_host: e.target.value })}
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <Label>{language === "ar" ? "المنفذ" : "Port"}</Label>
                <Input
                  type="number"
                  value={configFormData.smtp_port}
                  onChange={(e) => setConfigFormData({ ...configFormData, smtp_port: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <Separator />
            <p className="font-medium">{language === "ar" ? "بيانات الدخول" : "Credentials"}</p>
            
            <div>
              <Label>{language === "ar" ? "اسم المستخدم" : "Username"}</Label>
              <Input
                value={configFormData.email_username}
                onChange={(e) => setConfigFormData({ ...configFormData, email_username: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "كلمة المرور" : "Password"}</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={configFormData.email_password}
                  onChange={(e) => setConfigFormData({ ...configFormData, email_password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveConfig}>
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={isCreateTicketOpen} onOpenChange={setIsCreateTicketOpen}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إنشاء تذكرة من البريد" : "Create Ticket from Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "القسم" : "Department"}</Label>
              <Select value={ticketData.department_id} onValueChange={(v) => setTicketData({ ...ticketData, department_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "الموضوع" : "Subject"}</Label>
              <Input
                value={ticketData.subject}
                onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                value={ticketData.description}
                onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الأولوية" : "Priority"}</Label>
              <Select value={ticketData.priority} onValueChange={(v) => setTicketData({ ...ticketData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">{language === "ar" ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="Medium">{language === "ar" ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="High">{language === "ar" ? "عالية" : "High"}</SelectItem>
                  <SelectItem value="Critical">{language === "ar" ? "حرجة" : "Critical"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTicketOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateTicketFromEmail}>
              {language === "ar" ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إنشاء مهمة من البريد" : "Create Task from Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "القسم" : "Department"}</Label>
              <Select value={taskData.department_id} onValueChange={(v) => setTaskData({ ...taskData, department_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "العنوان" : "Title"}</Label>
              <Input
                value={taskData.title}
                onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                value={taskData.description}
                onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الأولوية" : "Priority"}</Label>
              <Select value={taskData.priority} onValueChange={(v) => setTaskData({ ...taskData, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{language === "ar" ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="medium">{language === "ar" ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="high">{language === "ar" ? "عالية" : "High"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateTaskFromEmail}>
              {language === "ar" ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailManager;
