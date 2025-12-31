import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, FileText } from "lucide-react";

interface DocumentType {
  id: string;
  type_name: string;
  type_name_ar: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
}

export default function DocumentTypeSetup() {
  const { language } = useLanguage();
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState({
    type_name: "",
    type_name_ar: "",
    is_mandatory: false,
    is_active: true,
    description: "",
  });

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("document_types")
        .select("*")
        .order("type_name");

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedType(null);
    setFormData({
      type_name: "",
      type_name_ar: "",
      is_mandatory: false,
      is_active: true,
      description: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (docType: DocumentType) => {
    setSelectedType(docType);
    setFormData({
      type_name: docType.type_name,
      type_name_ar: docType.type_name_ar || "",
      is_mandatory: docType.is_mandatory,
      is_active: docType.is_active,
      description: docType.description || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.type_name) {
      toast.error(language === "ar" ? "يرجى إدخال اسم النوع" : "Please enter type name");
      return;
    }

    try {
      const payload = {
        type_name: formData.type_name,
        type_name_ar: formData.type_name_ar || null,
        is_mandatory: formData.is_mandatory,
        is_active: formData.is_active,
        description: formData.description || null,
      };

      if (selectedType) {
        const { error } = await supabase
          .from("document_types")
          .update(payload)
          .eq("id", selectedType.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث النوع بنجاح" : "Type updated successfully");
      } else {
        const { error } = await supabase.from("document_types").insert(payload);
        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة النوع بنجاح" : "Type added successfully");
      }

      setDialogOpen(false);
      fetchDocumentTypes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    try {
      const { error } = await supabase.from("document_types").delete().eq("id", selectedType.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف النوع بنجاح" : "Type deleted successfully");
      setDeleteDialogOpen(false);
      fetchDocumentTypes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {language === "ar" ? "إعداد أنواع المستندات" : "Document Type Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة نوع" : "Add Type"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</TableHead>
                  <TableHead>{language === "ar" ? "إلزامي" : "Mandatory"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : documentTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {language === "ar" ? "لا توجد بيانات" : "No data found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  documentTypes.map((docType) => (
                    <TableRow key={docType.id}>
                      <TableCell className="font-medium">{docType.type_name}</TableCell>
                      <TableCell>{docType.type_name_ar || "-"}</TableCell>
                      <TableCell>
                        {docType.is_mandatory ? (
                          <Badge variant="destructive">
                            {language === "ar" ? "إلزامي" : "Mandatory"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {language === "ar" ? "اختياري" : "Optional"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={docType.is_active ? "default" : "secondary"}>
                          {docType.is_active
                            ? language === "ar"
                              ? "نشط"
                              : "Active"
                            : language === "ar"
                            ? "غير نشط"
                            : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{docType.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(docType)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedType(docType);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedType
                ? language === "ar"
                  ? "تعديل نوع المستند"
                  : "Edit Document Type"
                : language === "ar"
                ? "إضافة نوع مستند"
                : "Add Document Type"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم (إنجليزي) *" : "Name (English) *"}</Label>
              <Input
                value={formData.type_name}
                onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
              <Input
                value={formData.type_name_ar}
                onChange={(e) => setFormData({ ...formData, type_name_ar: e.target.value })}
                dir="rtl"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "إلزامي" : "Mandatory"}</Label>
              <Switch
                checked={formData.is_mandatory}
                onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "نشط" : "Active"}</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p>
            {language === "ar"
              ? `هل أنت متأكد من حذف نوع المستند "${selectedType?.type_name}"؟`
              : `Are you sure you want to delete document type "${selectedType?.type_name}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {language === "ar" ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
