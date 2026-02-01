import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RichTextEditor } from "@/components/RichTextEditor";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Send, Users, Briefcase, FileCheck, Eye } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AcknowledgmentDocument {
  id: string;
  title: string;
  title_ar: string | null;
  content: string;
  content_ar: string | null;
  is_active: boolean;
  requires_signature: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Recipient {
  id: string;
  document_id: string;
  user_id: string | null;
  job_position_id: string | null;
  created_at: string;
}

interface Signature {
  id: string;
  document_id: string;
  user_id: string;
  signed_at: string;
  user_name?: string;
}

interface JobPosition {
  id: string;
  position_name: string;
  position_name_ar: string | null;
}

interface Profile {
  user_id: string;
  user_name: string;
  email: string;
}

const AcknowledgmentDocuments = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/acknowledgment-documents");
  const [documents, setDocuments] = useState<AcknowledgmentDocument[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [signaturesDialogOpen, setSignaturesDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<AcknowledgmentDocument | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<AcknowledgmentDocument | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [form, setForm] = useState({
    title: "",
    title_ar: "",
    content: "",
    content_ar: "",
    is_active: true,
    requires_signature: true,
  });
  const [recipientForm, setRecipientForm] = useState({
    type: "user" as "user" | "job",
    user_ids: [] as string[],
    job_position_ids: [] as string[],
  });

  const t = {
    ar: {
      pageTitle: "إقرارات الموظفين",
      addDocument: "إضافة إقرار",
      editDocument: "تعديل الإقرار",
      title: "العنوان (إنجليزي)",
      titleAr: "العنوان (عربي)",
      content: "المحتوى (إنجليزي)",
      contentAr: "المحتوى (عربي)",
      isActive: "نشط",
      requiresSignature: "يتطلب توقيع",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      actions: "الإجراءات",
      createdAt: "تاريخ الإنشاء",
      status: "الحالة",
      active: "نشط",
      inactive: "غير نشط",
      sendTo: "إرسال إلى",
      recipients: "المستلمين",
      selectUsers: "اختر المستخدمين",
      selectJobs: "اختر الوظائف",
      byUser: "حسب المستخدم",
      byJob: "حسب الوظيفة",
      send: "إرسال",
      signatures: "التوقيعات",
      signedBy: "موقع بواسطة",
      signedAt: "تاريخ التوقيع",
      noSignatures: "لا توجد توقيعات",
      view: "عرض",
      noDocuments: "لا توجد إقرارات",
    },
    en: {
      pageTitle: "Acknowledgment Documents",
      addDocument: "Add Document",
      editDocument: "Edit Document",
      title: "Title (English)",
      titleAr: "Title (Arabic)",
      content: "Content (English)",
      contentAr: "Content (Arabic)",
      isActive: "Active",
      requiresSignature: "Requires Signature",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      actions: "Actions",
      createdAt: "Created At",
      status: "Status",
      active: "Active",
      inactive: "Inactive",
      sendTo: "Send To",
      recipients: "Recipients",
      selectUsers: "Select Users",
      selectJobs: "Select Job Positions",
      byUser: "By User",
      byJob: "By Job Position",
      send: "Send",
      signatures: "Signatures",
      signedBy: "Signed By",
      signedAt: "Signed At",
      noSignatures: "No signatures yet",
      view: "View",
      noDocuments: "No documents",
    },
  };

  const texts = t[language as keyof typeof t] || t.en;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docsRes, jobsRes, usersRes] = await Promise.all([
        supabase.from("acknowledgment_documents").select("*").order("created_at", { ascending: false }),
        supabase.from("job_positions").select("id, position_name, position_name_ar").eq("is_active", true),
        supabase.from("profiles").select("user_id, user_name, email").eq("is_active", true),
      ]);

      if (docsRes.data) setDocuments(docsRes.data);
      if (jobsRes.data) setJobPositions(jobsRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) fetchData();
  }, [hasAccess]);

  const handleOpenDialog = (doc?: AcknowledgmentDocument) => {
    if (doc) {
      setEditingDoc(doc);
      setForm({
        title: doc.title,
        title_ar: doc.title_ar || "",
        content: doc.content,
        content_ar: doc.content_ar || "",
        is_active: doc.is_active,
        requires_signature: doc.requires_signature,
      });
    } else {
      setEditingDoc(null);
      setForm({
        title: "",
        title_ar: "",
        content: "",
        content_ar: "",
        is_active: true,
        requires_signature: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingDoc) {
        const { error } = await supabase
          .from("acknowledgment_documents")
          .update({
            title: form.title,
            title_ar: form.title_ar || null,
            content: form.content,
            content_ar: form.content_ar || null,
            is_active: form.is_active,
            requires_signature: form.requires_signature,
          })
          .eq("id", editingDoc.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الإقرار" : "Document updated");
      } else {
        const { error } = await supabase.from("acknowledgment_documents").insert({
          title: form.title,
          title_ar: form.title_ar || null,
          content: form.content,
          content_ar: form.content_ar || null,
          is_active: form.is_active,
          requires_signature: form.requires_signature,
          created_by: user.id,
        });

        if (error) throw error;
        toast.success(language === "ar" ? "تم إنشاء الإقرار" : "Document created");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;

    try {
      const { error } = await supabase.from("acknowledgment_documents").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف" : "Deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOpenRecipientDialog = async (doc: AcknowledgmentDocument) => {
    setSelectedDoc(doc);
    setRecipientForm({ type: "user", user_ids: [], job_position_ids: [] });

    // Fetch existing recipients
    const { data } = await supabase
      .from("acknowledgment_recipients")
      .select("*")
      .eq("document_id", doc.id);

    if (data) setRecipients(data);
    setRecipientDialogOpen(true);
  };

  const handleSendToRecipients = async () => {
    if (!selectedDoc) return;

    const newRecipients: { document_id: string; user_id?: string; job_position_id?: string }[] = [];

    if (recipientForm.type === "user") {
      recipientForm.user_ids.forEach((userId) => {
        newRecipients.push({ document_id: selectedDoc.id, user_id: userId });
      });
    } else {
      recipientForm.job_position_ids.forEach((jobId) => {
        newRecipients.push({ document_id: selectedDoc.id, job_position_id: jobId });
      });
    }

    if (newRecipients.length === 0) {
      toast.error(language === "ar" ? "يرجى اختيار مستلمين" : "Please select recipients");
      return;
    }

    try {
      const { error } = await supabase.from("acknowledgment_recipients").insert(newRecipients);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الإرسال" : "Sent successfully");
      setRecipientDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleViewSignatures = async (doc: AcknowledgmentDocument) => {
    setSelectedDoc(doc);
    const { data } = await supabase
      .from("acknowledgment_signatures")
      .select("*")
      .eq("document_id", doc.id)
      .order("signed_at", { ascending: false });

    if (data) {
      // Enrich with user names from our users state
      const enrichedSignatures = data.map(sig => ({
        ...sig,
        user_name: users.find(u => u.user_id === sig.user_id)?.user_name || sig.user_id,
      }));
      setSignatures(enrichedSignatures);
    }
    setSignaturesDialogOpen(true);
  };

  const handleViewDocument = (doc: AcknowledgmentDocument) => {
    setSelectedDoc(doc);
    setViewDialogOpen(true);
  };

  if (accessLoading || loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="container mx-auto py-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{texts.pageTitle}</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {texts.addDocument}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{texts.title}</TableHead>
                <TableHead>{texts.status}</TableHead>
                <TableHead>{texts.createdAt}</TableHead>
                <TableHead>{texts.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {texts.noDocuments}
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {language === "ar" && doc.title_ar ? doc.title_ar : doc.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.is_active ? "default" : "secondary"}>
                        {doc.is_active ? texts.active : texts.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(doc.created_at), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => handleViewDocument(doc)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{texts.view}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(doc)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{language === "ar" ? "تعديل" : "Edit"}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => handleOpenRecipientDialog(doc)}>
                                <Send className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{texts.sendTo}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => handleViewSignatures(doc)}>
                                <FileCheck className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{texts.signatures}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(doc.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{texts.delete}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? texts.editDocument : texts.addDocument}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="en" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="en">English</TabsTrigger>
              <TabsTrigger value="ar">العربية</TabsTrigger>
            </TabsList>
            <TabsContent value="en" className="space-y-4">
              <div>
                <Label>{texts.title}</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Document title"
                />
              </div>
              <div>
                <Label>{texts.content}</Label>
                <RichTextEditor
                  content={form.content}
                  onChange={(html) => setForm({ ...form, content: html })}
                  className="min-h-[300px]"
                />
              </div>
            </TabsContent>
            <TabsContent value="ar" className="space-y-4" dir="rtl">
              <div>
                <Label>{texts.titleAr}</Label>
                <Input
                  value={form.title_ar}
                  onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                  placeholder="عنوان الإقرار"
                  dir="rtl"
                />
              </div>
              <div>
                <Label>{texts.contentAr}</Label>
                <RichTextEditor
                  content={form.content_ar}
                  onChange={(html) => setForm({ ...form, content_ar: html })}
                  className="min-h-[300px]"
                />
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: !!checked })}
              />
              <Label htmlFor="is_active">{texts.isActive}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="requires_signature"
                checked={form.requires_signature}
                onCheckedChange={(checked) => setForm({ ...form, requires_signature: !!checked })}
              />
              <Label htmlFor="requires_signature">{texts.requiresSignature}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {texts.cancel}
            </Button>
            <Button onClick={handleSave}>{texts.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Recipients Dialog */}
      <Dialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{texts.sendTo}</DialogTitle>
          </DialogHeader>
          
          {/* Existing Recipients Section */}
          {recipients.length > 0 && (
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">
                {language === "ar" ? "المستلمين الحاليين" : "Current Recipients"}
              </Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                {recipients.map((recipient) => {
                  const userName = recipient.user_id
                    ? users.find((u) => u.user_id === recipient.user_id)?.user_name
                    : null;
                  const jobName = recipient.job_position_id
                    ? jobPositions.find((j) => j.id === recipient.job_position_id)
                    : null;
                  const displayName = userName || 
                    (jobName 
                      ? (language === "ar" && jobName.position_name_ar ? jobName.position_name_ar : jobName.position_name)
                      : recipient.user_id || recipient.job_position_id);
                  
                  return (
                    <Badge 
                      key={recipient.id} 
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      {recipient.user_id ? <Users className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                      {displayName}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from("acknowledgment_recipients")
                              .delete()
                              .eq("id", recipient.id);
                            if (error) throw error;
                            setRecipients(recipients.filter((r) => r.id !== recipient.id));
                            toast.success(language === "ar" ? "تم الحذف" : "Removed");
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <Tabs value={recipientForm.type} onValueChange={(v) => setRecipientForm({ ...recipientForm, type: v as "user" | "job" })}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user">
                <Users className="h-4 w-4 mr-2" />
                {texts.byUser}
              </TabsTrigger>
              <TabsTrigger value="job">
                <Briefcase className="h-4 w-4 mr-2" />
                {texts.byJob}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="user" className="mt-4">
              <Label>{texts.selectUsers}</Label>
              <ScrollArea className="h-64 border rounded-md p-2 mt-2">
                {users
                  .filter((user) => !recipients.some((r) => r.user_id === user.user_id))
                  .map((user) => (
                  <div key={user.user_id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`user-${user.user_id}`}
                      checked={recipientForm.user_ids.includes(user.user_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRecipientForm({ ...recipientForm, user_ids: [...recipientForm.user_ids, user.user_id] });
                        } else {
                          setRecipientForm({ ...recipientForm, user_ids: recipientForm.user_ids.filter((id) => id !== user.user_id) });
                        }
                      }}
                    />
                    <Label htmlFor={`user-${user.user_id}`} className="cursor-pointer">
                      {user.user_name} ({user.email})
                    </Label>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>
            <TabsContent value="job" className="mt-4">
              <Label>{texts.selectJobs}</Label>
              <ScrollArea className="h-64 border rounded-md p-2 mt-2">
                {jobPositions
                  .filter((job) => !recipients.some((r) => r.job_position_id === job.id))
                  .map((job) => (
                  <div key={job.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`job-${job.id}`}
                      checked={recipientForm.job_position_ids.includes(job.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRecipientForm({ ...recipientForm, job_position_ids: [...recipientForm.job_position_ids, job.id] });
                        } else {
                          setRecipientForm({ ...recipientForm, job_position_ids: recipientForm.job_position_ids.filter((id) => id !== job.id) });
                        }
                      }}
                    />
                    <Label htmlFor={`job-${job.id}`} className="cursor-pointer">
                      {language === "ar" && job.position_name_ar ? job.position_name_ar : job.position_name}
                    </Label>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipientDialogOpen(false)}>
              {texts.cancel}
            </Button>
            <Button onClick={handleSendToRecipients} disabled={recipientForm.user_ids.length === 0 && recipientForm.job_position_ids.length === 0}>
              {texts.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDoc && (language === "ar" && selectedDoc.title_ar ? selectedDoc.title_ar : selectedDoc?.title)}
            </DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: language === "ar" && selectedDoc.content_ar ? selectedDoc.content_ar : selectedDoc.content,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Signatures Dialog */}
      <Dialog open={signaturesDialogOpen} onOpenChange={setSignaturesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{texts.signatures}</DialogTitle>
          </DialogHeader>
          {signatures.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{texts.noSignatures}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{texts.signedBy}</TableHead>
                  <TableHead>{texts.signedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.map((sig) => (
                  <TableRow key={sig.id}>
                    <TableCell>{sig.user_name || sig.user_id}</TableCell>
                    <TableCell>{format(new Date(sig.signed_at), "yyyy-MM-dd HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcknowledgmentDocuments;
