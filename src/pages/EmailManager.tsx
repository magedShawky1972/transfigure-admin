import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Progress } from "@/components/ui/progress";
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
  X,
  Trash2,
  RotateCw,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { format } from "date-fns";
import { RichTextEditor } from "@/components/RichTextEditor";
import { EmailRecipientSelector } from "@/components/EmailRecipientSelector";

interface UserEmailConfig {
  id: string;
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
  const [decodedHtml, setDecodedHtml] = useState<{ emailId: string; html: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [starredCount, setStarredCount] = useState(0);

  // server sync pagination
  const [syncOffset, setSyncOffset] = useState(0);
  const syncLimit = 50;
  const [serverTotal, setServerTotal] = useState<number | null>(null); // total emails on server

  // Sync progress dialog
  const [isSyncProgressOpen, setIsSyncProgressOpen] = useState(false);
  const [syncProgressCurrent, setSyncProgressCurrent] = useState(0);
  const [syncProgressTotal, setSyncProgressTotal] = useState(0);
  const syncAbortRef = useRef(false);
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // clear emails
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // delete email
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState(false);
  // maximize email view
  const [isEmailMaximized, setIsEmailMaximized] = useState(false);
  // reload body
  const [reloadingBodyId, setReloadingBodyId] = useState<string | null>(null);
  // Compose dialog
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const fetchIsAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  useEffect(() => {
    // Wait for auth session to be ready before fetching
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        fetchUserEmailConfig();
        fetchDepartments();
        fetchIsAdmin();
      }
    });

    // Also try immediately in case session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserEmailConfig();
        fetchDepartments();
        fetchIsAdmin();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (userConfig?.mail_type) {
      fetchEmails();
      fetchEmailCounts();
    }
  }, [userConfig, activeTab]);

  useEffect(() => {
    // reset server pagination when switching folders
    setSyncOffset(0);
    setServerTotal(null);
  }, [activeTab]);

  const fetchUserEmailConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile data
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          email,
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
      
      // Get decrypted email password using secure function
      const { data: passwordData, error: pwdError } = await supabase
        .rpc('get_my_email_password');
      
      const decryptedPassword = pwdError ? null : passwordData;
      
      if (!data.mail_type) {
        setConfigError(isArabic 
          ? "لم يتم تحديد نوع البريد. يرجى تحديث إعدادات المستخدم الخاصة بك."
          : "Mail type not set. Please update your user settings."
        );
      } else if (!decryptedPassword) {
        setConfigError(isArabic
          ? "لم يتم تعيين كلمة مرور البريد الإلكتروني. يرجى تحديث إعدادات المستخدم الخاصة بك."
          : "Email password not set. Please update your user settings."
        );
      } else {
        setConfigError(null);
      }
      
      setUserConfig({
        ...data,
        email_password: decryptedPassword
      } as UserEmailConfig);
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

      let query = supabase
        .from("emails")
        .select("*")
        .eq("user_id", user.id)
        .order("email_date", { ascending: false });

      if (activeTab === "starred") {
        query = query.eq("is_starred", true);
      } else if (activeTab === "drafts") {
        query = query.eq("is_draft", true);
      } else if (activeTab === "sent") {
        // Use ilike for case-insensitive matching (handles both "SENT" and "Sent")
        query = query.ilike("folder", "sent");
      } else {
        query = query.eq("folder", "INBOX");
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get inbox count
      const { count: inbox } = await supabase
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("folder", "INBOX");
      setInboxCount(inbox || 0);

      // Get sent count (use ilike for case-insensitive matching)
      const { count: sent } = await supabase
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .ilike("folder", "sent");
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

  const handleClearAllEmails = async () => {
    if (clearing) return;

    setClearing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // delete attachments first (avoid orphans)
      const { data: ids, error: idsError } = await supabase
        .from("emails")
        .select("id")
        .eq("user_id", user.id);
      if (idsError) throw idsError;

      const emailIds = (ids ?? []).map((r) => r.id);
      if (emailIds.length > 0) {
        // chunk to avoid URL limits
        const chunkSize = 200;
        for (let i = 0; i < emailIds.length; i += chunkSize) {
          const chunk = emailIds.slice(i, i + chunkSize);
          const { error: attError } = await supabase
            .from("email_attachments")
            .delete()
            .in("email_id", chunk);
          if (attError) throw attError;
        }
      }

      const { error: delError } = await supabase
        .from("emails")
        .delete()
        .eq("user_id", user.id);
      if (delError) throw delError;

      setSelectedEmail(null);
      setEmails([]);
      setInboxCount(0);
      setSentCount(0);
      setStarredCount(0);
      setSyncOffset(0);
      setServerTotal(null);

      toast.success(isArabic ? "تم مسح جميع الرسائل" : "All emails cleared");
      setIsClearDialogOpen(false);
    } catch (error: any) {
      console.error("Error clearing emails:", error);
      toast.error(
        isArabic
          ? `خطأ في مسح الرسائل: ${error?.message || ""}`
          : `Error clearing emails: ${error?.message || ""}`
      );
    } finally {
      setClearing(false);
    }
  };

  // Get the latest email date from database for incremental sync
  const getLatestEmailDate = async (folder: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("emails")
        .select("email_date")
        .eq("user_id", user.id)
        .eq("folder", folder)
        .order("email_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data?.email_date) return null;

      // IMAP SEARCH SINCE is day-based (no time), so we go back 1 day to avoid missing same-day emails.
      const latest = new Date(data.email_date);
      const safeSince = new Date(latest.getTime() - 24 * 60 * 60 * 1000);
      return safeSince.toISOString();
    } catch (error) {
      console.error("Error getting latest email date:", error);
      return null;
    }
  };

  const syncEmailsFromServer = async (isAutoSync = false) => {
    if (!userConfig?.mail_type || !userConfig.email_password) {
      if (!isAutoSync) {
        toast.error(isArabic ? "إعدادات البريد غير مكتملة" : "Email settings incomplete");
      }
      return;
    }

    // Don't show progress dialog for auto-sync
    if (!isAutoSync) {
      syncAbortRef.current = false;
      setIsSyncProgressOpen(true);
      setSyncProgressCurrent(0);
      setSyncProgressTotal(0);
    }
    setSyncing(true);

    try {
      const folder = activeTab === "sent" ? "Sent" : "INBOX";
      
      // Get latest email date for incremental sync
      const sinceDate = await getLatestEmailDate(folder);
      const incrementalOnly = !!sinceDate;
      
      console.log(`Syncing emails (incremental: ${incrementalOnly}, since: ${sinceDate})`);

      const { data, error } = await supabase.functions.invoke("fetch-emails-imap", {
        body: {
          imapHost: userConfig.mail_type.imap_host,
          imapPort: userConfig.mail_type.imap_port,
          imapSecure: userConfig.mail_type.imap_secure,
          email: userConfig.email,
          emailPassword: userConfig.email_password,
          folder,
          limit: syncLimit,
          offset: 0,
          sinceDate,
          incrementalOnly,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Unknown error");

      const totalFetched = data.fetched;
      const totalSaved = data.saved;
      const totalEmails = data.total;

      if (!isAutoSync) {
        setSyncProgressTotal(totalEmails);
        setSyncProgressCurrent(totalFetched);
      }

      if (totalSaved > 0) {
        toast.success(
          isArabic
            ? `تم جلب ${totalSaved} رسالة جديدة`
            : `Fetched ${totalSaved} new emails`
        );
      } else if (!isAutoSync) {
        toast.info(
          isArabic
            ? "لا توجد رسائل جديدة"
            : "No new emails"
        );
      }

      setSyncOffset(0);
      setServerTotal(totalEmails);

      await fetchEmails();
      await fetchEmailCounts();
    } catch (error: any) {
      console.error("Error syncing emails:", error);
      if (!isAutoSync) {
        toast.error(
          isArabic
            ? `خطأ في مزامنة البريد: ${error?.message || ""}`
            : `Error syncing emails: ${error?.message || ""}`
        );
      }
    } finally {
      setSyncing(false);
      if (!isAutoSync) {
        setIsSyncProgressOpen(false);
      }
    }
  };

  // Auto-sync: trigger immediately on first load if no emails, then every 30 seconds
  useEffect(() => {
    if (userConfig?.mail_type && userConfig?.email_password) {
      // Clear any existing interval
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }

      // Check if this is first time load (no emails synced)
      const checkAndAutoSync = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { count } = await supabase
          .from("emails")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
        
        // If no emails exist, trigger initial sync immediately
        if (count === 0) {
          console.log("First time load - starting initial sync");
          syncEmailsFromServer(false); // Show progress dialog for first sync
        }
      };
      
      checkAndAutoSync();

      // Set up auto-sync every 30 seconds (30000ms)
      autoSyncIntervalRef.current = setInterval(() => {
        console.log("Auto-sync triggered");
        syncEmailsFromServer(true);
      }, 30 * 1000);

      return () => {
        if (autoSyncIntervalRef.current) {
          clearInterval(autoSyncIntervalRef.current);
        }
      };
    }
  }, [userConfig, activeTab]);

  const handleCancelSync = () => {
    syncAbortRef.current = true;
    toast.info(isArabic ? "تم إلغاء المزامنة" : "Sync cancelled");
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
      // Convert attachments to base64
      const attachmentData = await Promise.all(
        attachments.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
          );
          return {
            filename: file.name,
            content: base64,
            contentType: file.type,
          };
        })
      );

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
          isHtml: true,
          attachments: attachmentData,
        },
      });

      if (error) throw error;

      // Save sent email to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const sentMessageId = `sent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await supabase.from("emails").insert({
          user_id: user.id,
          config_id: userConfig.id,
          message_id: sentMessageId,
          folder: "sent",
          from_address: userConfig.email,
          from_name: userConfig.user_name,
          to_addresses: composeData.to.split(",").map(e => e.trim()),
          cc_addresses: composeData.cc ? composeData.cc.split(",").map(e => e.trim()) : null,
          subject: composeData.subject,
          body_html: composeData.body,
          body_text: composeData.body.replace(/<[^>]*>/g, ""),
          email_date: new Date().toISOString(),
          is_read: true,
          has_attachments: attachments.length > 0,
        });
      }

      toast.success(isArabic ? "تم إرسال البريد بنجاح" : "Email sent successfully");
      setIsComposeOpen(false);
      setComposeData({ to: "", cc: "", subject: "", body: "" });
      setAttachments([]);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(isArabic ? "خطأ في إرسال البريد" : "Error sending email");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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

  const handleDeleteSelectedEmail = async () => {
    if (!selectedEmail || deletingEmail) return;

    setDeletingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Track deleted message_id so sync won't re-insert it
      const { error: trackError } = await supabase.from("deleted_email_ids").upsert(
        { user_id: user.id, message_id: selectedEmail.message_id },
        { onConflict: "user_id,message_id" }
      );
      if (trackError) console.error("Failed to track deleted email:", trackError);

      // delete attachments first
      const { error: attError } = await supabase
        .from("email_attachments")
        .delete()
        .eq("email_id", selectedEmail.id);
      if (attError) throw attError;

      const { error } = await supabase.from("emails").delete().eq("id", selectedEmail.id);
      if (error) throw error;

      setIsDeleteDialogOpen(false);
      setSelectedEmail(null);
      await fetchEmails();
      await fetchEmailCounts();

      toast.success(isArabic ? "تم حذف الرسالة" : "Email deleted");
    } catch (error: any) {
      console.error("Error deleting email:", error);
      toast.error(isArabic ? "خطأ في حذف الرسالة" : "Error deleting email");
    } finally {
      setDeletingEmail(false);
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

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const buildICalendarHtml = (ics: string): string => {
    const raw = (ics || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Unfold lines (RFC 5545)
    const folded = raw.split("\n");
    const lines: string[] = [];
    for (const l of folded) {
      if ((l.startsWith(" ") || l.startsWith("\t")) && lines.length > 0) {
        lines[lines.length - 1] += l.trimStart();
      } else {
        lines.push(l.trimEnd());
      }
    }

    const getProp = (name: string): string | null => {
      const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "i");
      const found = lines.find((ln) => re.test(ln));
      if (!found) return null;
      const m = found.match(re);
      return (m?.[1] || "").trim() || null;
    };

    const summary = getProp("SUMMARY") || "Calendar Invitation";
    const dtStart = getProp("DTSTART");
    const dtEnd = getProp("DTEND");
    const location = getProp("LOCATION");
    const status = getProp("STATUS");

    const fullText = lines.join("\n");
    const teamsLinkMatch = fullText.match(/https?:\/\/(?:www\.)?teams\.microsoft\.com\/l\/meetup-join\/[^\s>]+/i);
    const teamsLink = teamsLinkMatch?.[0] || null;

    const items: Array<[string, string]> = [];
    if (status) items.push([isArabic ? "الحالة" : "Status", status]);
    if (dtStart) items.push([isArabic ? "البداية" : "Start", dtStart]);
    if (dtEnd) items.push([isArabic ? "النهاية" : "End", dtEnd]);
    if (location) items.push([isArabic ? "الموقع" : "Location", location]);
    if (teamsLink) items.push([isArabic ? "الرابط" : "Teams", teamsLink]);

    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6">
        <h2 style="margin:0 0 10px 0;">${escapeHtml(summary)}</h2>
        <table style="border-collapse:collapse;width:100%;max-width:720px">
          <tbody>
            ${items
              .map(([k, v]) => {
                const vv = k === (isArabic ? "الرابط" : "Teams")
                  ? `<a href="${escapeHtml(v)}" target="_blank" rel="noopener noreferrer">${isArabic ? "انضم للاجتماع" : "Join meeting"}</a>`
                  : escapeHtml(v);
                return `
                  <tr>
                    <td style="padding:6px 10px;border-top:1px solid #e5e7eb;color:#6b7280;white-space:nowrap">${escapeHtml(k)}</td>
                    <td style="padding:6px 10px;border-top:1px solid #e5e7eb;color:#111827">${vv}</td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `.trim();
  };

  const tryDecodeBase64Html = (input: string | null): string | null => {
    if (!input) return null;
    const trimmed = input.trim();

    // Quick heuristic: looks like base64 and is fairly long
    if (trimmed.length < 200) return null;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return null;

    try {
      const compact = trimmed.replace(/\s/g, "");
      const padded = compact + "===".slice((compact.length + 3) % 4);
      const decoded = atob(padded);
      const sample = decoded.slice(0, 4000).toLowerCase();

      // Case 1: proper HTML
      const looksHtml =
        sample.includes("<html") ||
        sample.includes("<!doctype") ||
        sample.includes("<body") ||
        sample.includes("<div") ||
        sample.includes("<table") ||
        sample.includes("<p");

      if (looksHtml) return decoded;

      // Case 2: calendar invite inside decoded text
      if (/BEGIN:VCALENDAR/i.test(decoded)) {
        return buildICalendarHtml(decoded);
      }

      // Case 3: decoded but not HTML (often MIME or plain text) → render in the same iframe panel
      const looksText = sample.includes("content-type:") || sample.includes("mime-version:") || decoded.length > 0;
      if (looksText) {
        return `<pre style="white-space:pre-wrap;font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(decoded)}</pre>`;
      }

      return null;
    } catch {
      return null;
    }
  };

  const handleSelectEmail = async (email: Email) => {
    setSelectedEmail(email);
    setDecodedHtml(null);
    handleMarkAsRead(email);

    // Client-side fallback: render base64 bodies (HTML/MIME/calendar) into the iframe
    if (!email.body_html && email.body_text) {
      const html = tryDecodeBase64Html(email.body_text);
      if (html) {
        setDecodedHtml({ emailId: email.id, html });
      } else if (/BEGIN:VCALENDAR/i.test(email.body_text)) {
        // Some providers store raw iCalendar text
        setDecodedHtml({ emailId: email.id, html: buildICalendarHtml(email.body_text) });
      }
    }

    // Lazy-load body from server when missing
    if (!userConfig?.mail_type || !userConfig.email_password) return;
    if (email.body_html || email.body_text) return;

    try {
      const folder = activeTab === "sent" ? "INBOX.Sent" : "INBOX";
      const { data, error } = await supabase.functions.invoke("fetch-email-body-imap", {
        body: {
          imapHost: userConfig.mail_type.imap_host,
          imapPort: userConfig.mail_type.imap_port,
          imapSecure: userConfig.mail_type.imap_secure,
          email: userConfig.email,
          emailPassword: userConfig.email_password,
          folder,
          messageId: email.message_id,
        },
      });

      if (error) throw error;

      if (data?.success && data?.hasBody === false) {
        toast.error(
          isArabic
            ? "لم يتم العثور على محتوى داخل البريد (Body فارغ أو غير قابل للاستخراج)."
            : "No email body found (empty or could not be parsed)."
        );
      }

      // Refresh selected email from DB
      const { data: refreshed } = await supabase
        .from("emails")
        .select("*")
        .eq("id", email.id)
        .maybeSingle();

      if (refreshed) {
        setSelectedEmail(refreshed as any);
        setEmails((prev) => prev.map((e) => (e.id === email.id ? (refreshed as any) : e)));

        // If server saved only text but it's still a base64 HTML/calendar blob, decode for display.
        if (!(refreshed as any).body_html && (refreshed as any).body_text) {
          const bt = String((refreshed as any).body_text || "");
          const html = tryDecodeBase64Html(bt);
          if (html) setDecodedHtml({ emailId: email.id, html });
          else if (/BEGIN:VCALENDAR/i.test(bt)) setDecodedHtml({ emailId: email.id, html: buildICalendarHtml(bt) });
        }
      }
    } catch (e) {
      console.error("Body lazy-load failed:", e);
    }
  };

  // Force reload email body from server
  const handleReloadBody = async (email: Email, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userConfig?.mail_type || !userConfig.email_password) {
      toast.error(isArabic ? "إعدادات البريد غير مكتملة" : "Email settings incomplete");
      return;
    }

    setReloadingBodyId(email.id);
    try {
      // Use the email's actual folder, mapping DB folder names to IMAP folder names
      let folder = email.folder || "INBOX";
      if (folder === "Sent") folder = "INBOX.Sent";
      
      console.log("Reloading body for email:", email.id, "folder:", folder, "message_id:", email.message_id);
      
      const { data, error } = await supabase.functions.invoke("fetch-email-body-imap", {
        body: {
          imapHost: userConfig.mail_type.imap_host,
          imapPort: userConfig.mail_type.imap_port,
          imapSecure: userConfig.mail_type.imap_secure,
          email: userConfig.email,
          emailPassword: userConfig.email_password,
          folder,
          messageId: email.message_id,
        },
      });

      if (error) {
        console.error("Reload body error:", error);
        throw error;
      }
      
      if (data && !data.success) {
        toast.error(data.error || (isArabic ? "فشل إعادة التحميل" : "Reload failed"));
        return;
      }

      // Refresh email from DB
      const { data: refreshed } = await supabase
        .from("emails")
        .select("*")
        .eq("id", email.id)
        .maybeSingle();

      if (refreshed) {
        setEmails((prev) => prev.map((em) => (em.id === email.id ? (refreshed as any) : em)));
        if (selectedEmail?.id === email.id) {
          setSelectedEmail(refreshed as any);
        }
        toast.success(isArabic ? "تم إعادة تحميل المحتوى" : "Body reloaded");
      }
    } catch (err: any) {
      console.error("Reload body failed:", err);
      toast.error(isArabic ? "فشل إعادة التحميل" : "Reload failed");
    } finally {
      setReloadingBodyId(null);
    }
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
    <div className="container mx-auto px-3 py-2 space-y-2" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{isArabic ? "مدير البريد" : "Email Manager"}</h1>
            <p className="text-xs text-muted-foreground">
              {userConfig?.email} ({userConfig?.mail_type?.type_name})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Loaded / Total indicator */}
          {serverTotal !== null && (
            <span className="text-sm text-muted-foreground">
              {isArabic
                ? `تم تحميل ${inboxCount} من ${serverTotal}`
                : `Loaded ${inboxCount} of ${serverTotal}`}
            </span>
          )}
          {syncing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">{syncStatus}</span>
            </div>
          )}

          <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsClearDialogOpen(true)}
              disabled={syncing || clearing}
              title={isArabic ? "مسح كل الرسائل" : "Clear all emails"}
            >
              <Trash2 className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
              {isArabic ? "مسح" : "Clear"}
            </Button>
            <AlertDialogContent dir={isArabic ? "rtl" : "ltr"}>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isArabic ? "مسح جميع الرسائل؟" : "Clear all emails?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isArabic
                    ? "سيتم حذف جميع الرسائل المتزامنة من النظام لهذا الحساب فقط. يمكنك عمل مزامنة مرة أخرى بعد ذلك."
                    : "This will delete all synced emails for this account only. You can sync again afterwards."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing}>
                  {isArabic ? "إلغاء" : "Cancel"}
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAllEmails} disabled={clearing}>
                  {clearing ? (isArabic ? "جارٍ المسح..." : "Clearing...") : isArabic ? "مسح" : "Clear"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" onClick={() => syncEmailsFromServer()} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"} ${syncing ? "animate-spin" : ""}`} />
            {isArabic ? "مزامنة" : "Sync"}
          </Button>
          <Button onClick={() => setIsComposeOpen(true)}>
            <Plus className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
            {isArabic ? "رسالة جديدة" : "Compose"}
          </Button>
        </div>
      </div>

      {/* Sync Progress Dialog */}
      <Dialog open={isSyncProgressOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{isArabic ? "مزامنة البريد الإلكتروني" : "Syncing Emails"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between text-sm">
              <span>{isArabic ? "جاري التحميل..." : "Loading..."}</span>
              <span className="font-medium">
                {syncProgressCurrent} {isArabic ? "من" : "of"} {syncProgressTotal || "?"}
              </span>
            </div>
            <Progress 
              value={syncProgressTotal > 0 ? (syncProgressCurrent / syncProgressTotal) * 100 : 0} 
              className="h-3"
            />
            <p className="text-xs text-muted-foreground text-center">
              {isArabic 
                ? "الرجاء الانتظار حتى اكتمال المزامنة" 
                : "Please wait until sync is complete"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleCancelSync} disabled={!syncing}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Sidebar */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-2 space-y-2">
              {/* Email Account Info */}
              <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-xs font-medium truncate">{userConfig?.user_name || userConfig?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{userConfig?.email}</p>
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
        <div className="lg:col-span-4">
          <Card className="h-[calc(100vh-120px)] flex flex-col">
            <CardHeader className="p-2 pb-1">
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
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-full">
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
                            {decodeMimeWord(email.from_name || "") || email.from_address}
                          </p>
                          <p className="text-sm truncate font-medium">
                            {decodeMimeWord(email.subject || "") ||
                              (isArabic ? "(بدون موضوع)" : "(No subject)")}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {decodeMimeWord(email.body_text || "")?.substring(0, 50) || "..."}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(email.email_date), "MMM d, h:mm a")}
                          </span>
                          <div className="flex items-center gap-1">
                            {email.has_attachments && (
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleStar(email);
                              }}
                              className="p-0.5 hover:bg-muted rounded"
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  email.is_starred
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                          </div>
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
        <div className="lg:col-span-6">
          <Card className="h-[calc(100vh-120px)] flex flex-col">
            {selectedEmail ? (
              <>
                <CardHeader className="p-3 pb-2">
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
                      {/* To recipients */}
                      {selectedEmail.to_addresses && (
                        <p className="text-sm text-muted-foreground">
                          {isArabic ? "إلى:" : "To:"}{" "}
                          {Array.isArray(selectedEmail.to_addresses) 
                            ? selectedEmail.to_addresses.map((r: any) => r.name || r.address || r).join(", ")
                            : typeof selectedEmail.to_addresses === 'object'
                              ? selectedEmail.to_addresses.address || JSON.stringify(selectedEmail.to_addresses)
                              : selectedEmail.to_addresses
                          }
                        </p>
                      )}
                      {/* CC recipients */}
                      {selectedEmail.cc_addresses && Array.isArray(selectedEmail.cc_addresses) && selectedEmail.cc_addresses.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {isArabic ? "نسخة:" : "CC:"}{" "}
                          {selectedEmail.cc_addresses.map((r: any) => r.name || r.address || r).join(", ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(selectedEmail.email_date), "PPpp")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title={isArabic ? "رد" : "Reply"}>
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-xs gap-1"
                        title={isArabic ? "رد للكل" : "Reply All"}
                      >
                        <Reply className="h-4 w-4" />
                        <span>{isArabic ? "الكل" : "All"}</span>
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

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsEmailMaximized(true)}
                        title={isArabic ? "تكبير" : "Maximize"}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleReloadBody(selectedEmail, e)}
                        title={isArabic ? "إعادة تحميل المحتوى" : "Reload body"}
                        disabled={reloadingBodyId === selectedEmail.id}
                      >
                        <RefreshCw className={`h-4 w-4 ${reloadingBodyId === selectedEmail.id ? "animate-spin" : ""}`} />
                      </Button>

                      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsDeleteDialogOpen(true)}
                          title={isArabic ? "حذف" : "Delete"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <AlertDialogContent dir={isArabic ? "rtl" : "ltr"}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {isArabic ? "حذف الرسالة؟" : "Delete email?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {isArabic
                                ? "سيتم حذف الرسالة من النظام (لا يتم حذفها من صندوق البريد الخارجي)."
                                : "This will delete the email from the app (it will not remove it from the external mailbox)."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deletingEmail}>
                              {isArabic ? "إلغاء" : "Cancel"}
                            </AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSelectedEmail} disabled={deletingEmail}>
                              {deletingEmail ? (isArabic ? "جارٍ الحذف..." : "Deleting...") : (isArabic ? "حذف" : "Delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-4 flex-1 min-h-0">
                  {selectedEmail.body_html || (decodedHtml?.emailId === selectedEmail.id ? decodedHtml.html : null) ? (
                    <div className="h-full min-h-0 rounded-md border overflow-hidden bg-background">
                      <iframe
                        title={isArabic ? "محتوى البريد" : "Email content"}
                        className="w-full h-full"
                        sandbox="allow-popups allow-top-navigation-by-user-activation"
                        srcDoc={`<!doctype html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; height: 100%; }
      body {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        padding: 12px;
        background: #ffffff;
        color: #111827;
      }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    ${(selectedEmail.body_html || (decodedHtml?.emailId === selectedEmail.id ? decodedHtml.html : ""))
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")}
  </body>
</html>`}
                      />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      {selectedEmail.body_text ? (
                        <pre className="whitespace-pre-wrap text-sm font-sans">
                          {decodeMimeWord(selectedEmail.body_text)}
                        </pre>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          {isArabic ? "لا يوجد محتوى" : "No content available"}
                        </p>
                      )}
                    </ScrollArea>
                  )}
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

      {/* Maximize Email Dialog */}
      <Dialog open={isEmailMaximized} onOpenChange={setIsEmailMaximized}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">
                {selectedEmail ? (decodeMimeWord(selectedEmail.subject || '') || (isArabic ? "(بدون موضوع)" : "(No subject)")) : ""}
              </DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsEmailMaximized(false)}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
            {selectedEmail && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  {isArabic ? "من:" : "From:"} {decodeMimeWord(selectedEmail.from_name || '') || selectedEmail.from_address}
                  {selectedEmail.from_name && (
                    <span className="text-xs ml-1">&lt;{selectedEmail.from_address}&gt;</span>
                  )}
                </p>
                {selectedEmail.to_addresses && (
                  <p>
                    {isArabic ? "إلى:" : "To:"}{" "}
                    {Array.isArray(selectedEmail.to_addresses) 
                      ? selectedEmail.to_addresses.map((r: any) => r.name || r.address || r).join(", ")
                      : typeof selectedEmail.to_addresses === 'object'
                        ? selectedEmail.to_addresses.address || JSON.stringify(selectedEmail.to_addresses)
                        : selectedEmail.to_addresses
                    }
                  </p>
                )}
                {selectedEmail.cc_addresses && Array.isArray(selectedEmail.cc_addresses) && selectedEmail.cc_addresses.length > 0 && (
                  <p>
                    {isArabic ? "نسخة:" : "CC:"}{" "}
                    {selectedEmail.cc_addresses.map((r: any) => r.name || r.address || r).join(", ")}
                  </p>
                )}
                <p className="text-xs">{format(new Date(selectedEmail.email_date), "PPpp")}</p>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4">
            {selectedEmail && (selectedEmail.body_html || (decodedHtml?.emailId === selectedEmail.id ? decodedHtml.html : null)) ? (
              <div className="h-full rounded-md border overflow-hidden bg-background">
                <iframe
                  title={isArabic ? "محتوى البريد" : "Email content"}
                  className="w-full h-full"
                  sandbox="allow-popups allow-top-navigation-by-user-activation"
                  srcDoc={`<!doctype html>
<html lang="${isArabic ? "ar" : "en"}" dir="${isArabic ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; background: #ffffff; height: 100%; }
      body {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        padding: 16px;
        background: #ffffff;
        color: #111827;
        font-size: 14px;
        line-height: 1.6;
      }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    ${(selectedEmail.body_html || (decodedHtml?.emailId === selectedEmail.id ? decodedHtml.html : ""))
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")}
  </body>
</html>`}
                />
              </div>
            ) : (
              <ScrollArea className="h-full">
                {selectedEmail?.body_text ? (
                  <pre className="whitespace-pre-wrap text-sm font-sans p-4">
                    {decodeMimeWord(selectedEmail.body_text)}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-sm p-4">
                    {isArabic ? "لا يوجد محتوى" : "No content available"}
                  </p>
                )}
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isArabic ? "رسالة جديدة" : "New Email"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <EmailRecipientSelector
              label={isArabic ? "إلى" : "To"}
              value={composeData.to}
              onChange={(value) => setComposeData({ ...composeData, to: value })}
              isAdmin={isAdmin}
            />
            <EmailRecipientSelector
              label={isArabic ? "نسخة" : "CC"}
              value={composeData.cc}
              onChange={(value) => setComposeData({ ...composeData, cc: value })}
              isAdmin={isAdmin}
            />
            <div className="space-y-2">
              <Label>{isArabic ? "الموضوع" : "Subject"}</Label>
              <Input
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الرسالة" : "Message"}</Label>
              <RichTextEditor
                content={composeData.body}
                onChange={(html) => setComposeData({ ...composeData, body: html })}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المرفقات" : "Attachments"}</Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {file.name}
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
                {isArabic ? "إضافة مرفق" : "Add Attachment"}
              </Button>
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
