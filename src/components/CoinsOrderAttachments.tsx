import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Image, File, Download, Eye, X } from "lucide-react";

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  phase: string;
  uploaded_by_name: string | null;
  created_at: string;
}

interface CoinsOrderAttachmentsProps {
  purchaseOrderId: string | null;
  currentPhase: string;
  readOnly?: boolean;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return <File className="h-4 w-4" />;
  if (fileType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-600" />;
  if (fileType.includes("pdf")) return <FileText className="h-4 w-4 text-red-600" />;
  if (fileType.includes("sheet") || fileType.includes("excel") || fileType.includes("csv"))
    return <FileText className="h-4 w-4 text-green-600" />;
  if (fileType.includes("word") || fileType.includes("document"))
    return <FileText className="h-4 w-4 text-blue-800" />;
  return <File className="h-4 w-4" />;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const phaseLabels: Record<string, { ar: string; en: string }> = {
  creation: { ar: "إنشاء", en: "Creation" },
  sending: { ar: "توجيه", en: "Sending" },
  receiving: { ar: "استلام", en: "Receiving" },
  coins_entry: { ar: "إدخال الكوينز", en: "Coins Entry" },
  completed: { ar: "مكتمل", en: "Completed" },
};

const CoinsOrderAttachments = ({ purchaseOrderId, currentPhase, readOnly = false }: CoinsOrderAttachmentsProps) => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  useEffect(() => {
    if (purchaseOrderId) fetchAttachments();
  }, [purchaseOrderId]);

  const fetchAttachments = async () => {
    if (!purchaseOrderId) return;
    const { data } = await supabase
      .from("coins_purchase_attachments")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId)
      .order("created_at", { ascending: false });
    if (data) setAttachments(data as Attachment[]);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !purchaseOrderId) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
        const publicId = `coins-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { imageBase64: base64, folder: "Edara_Attachments", publicId, resourceType },
        });
        if (uploadError) throw uploadError;
        if (!uploadData?.url) throw new Error("Upload failed");

        await supabase.from("coins_purchase_attachments").insert({
          purchase_order_id: purchaseOrderId,
          phase: currentPhase,
          file_name: file.name,
          file_url: uploadData.url,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.email || "",
          uploaded_by_name: user?.user_metadata?.display_name || user?.email || "",
        } as any);
      }
      toast.success(isArabic ? "تم رفع الملفات بنجاح" : "Files uploaded successfully");
      fetchAttachments();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isArabic ? "هل أنت متأكد من حذف هذا الملف؟" : "Delete this file?")) return;
    const { error } = await supabase.from("coins_purchase_attachments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isArabic ? "تم حذف الملف" : "File deleted");
      fetchAttachments();
    }
  };

  const getPreviewUrl = (att: Attachment): string | null => {
    if (!att.file_url) return null;
    if (att.file_type?.startsWith("image/")) return att.file_url;
    // Cloudinary: convert PDF first page to image
    if (att.file_type?.includes("pdf") && att.file_url.includes("cloudinary.com")) {
      // Works for both /raw/upload/ and /image/upload/ paths
      const url = att.file_url.replace("/raw/upload/", "/image/upload/");
      // Insert pg_1 transformation
      return url.replace("/upload/", "/upload/pg_1,f_jpg/");
    }
    return null;
  };

  const handlePreview = (att: Attachment) => {
    const url = getPreviewUrl(att);
    if (url) {
      setPreviewUrl(url);
      setPreviewType(att.file_type);
    } else {
      window.open(att.file_url, "_blank");
    }
  };

  if (!purchaseOrderId) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isArabic ? "المرفقات" : "Attachments"}
              {attachments.length > 0 && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{attachments.length}</span>
              )}
            </CardTitle>
            {!readOnly && (
              <div>
                <input
                  type="file"
                  id="coins-attachment-upload"
                  className="hidden"
                  multiple
                  accept="*/*"
                  onChange={handleUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("coins-attachment-upload")?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading
                    ? (isArabic ? "جاري الرفع..." : "Uploading...")
                    : (isArabic ? "رفع ملف" : "Upload File")}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isArabic ? "لا توجد مرفقات" : "No attachments"}
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => {
                const preview = getPreviewUrl(att);
                return (
                  <div key={att.id} className="rounded-lg border bg-muted/30 overflow-hidden">
                    {/* Inline thumbnail preview */}
                    {preview && (
                      <div
                        className="relative w-full bg-black/5 flex items-center justify-center cursor-pointer group"
                        style={{ maxHeight: 200 }}
                        onClick={() => handlePreview(att)}
                      >
                        <img
                          src={preview}
                          alt={att.file_name}
                          className="max-h-[200px] object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getFileIcon(att.file_type)}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{att.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isArabic ? phaseLabels[att.phase]?.ar : phaseLabels[att.phase]?.en}
                            {att.uploaded_by_name && ` • ${att.uploaded_by_name}`}
                            {att.file_size ? ` • ${formatFileSize(att.file_size)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {preview && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePreview(att)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(att.file_url, "_blank")}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {!readOnly && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(att.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full-size preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-1">
          <div className="relative w-full h-full flex items-center justify-center overflow-auto">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CoinsOrderAttachments;
