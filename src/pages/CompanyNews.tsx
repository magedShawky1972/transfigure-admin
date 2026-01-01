import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/RichTextEditor";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Newspaper, 
  Image as ImageIcon,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  X
} from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  created_by: string;
}

const CompanyNews = () => {
  const { language } = useLanguage();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("company_news")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error fetching news:", error);
      toast.error(language === "ar" ? "خطأ في تحميل الأخبار" : "Error loading news");
    } finally {
      setLoading(false);
    }
  };

  const openNewDialog = () => {
    setEditingNews(null);
    setTitle("");
    setContent("");
    setImageUrl("");
    setIsPublished(false);
    setDialogOpen(true);
  };

  const openEditDialog = (item: NewsItem) => {
    setEditingNews(item);
    setTitle(item.title);
    setContent(item.content);
    setImageUrl(item.image_url || "");
    setIsPublished(item.is_published);
    setDialogOpen(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(language === "ar" ? "يرجى اختيار ملف صورة" : "Please select an image file");
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        const { data, error } = await supabase.functions.invoke('upload-to-cloudinary', {
          body: {
            imageBase64: base64,
            folder: 'company-news',
            resourceType: 'image'
          }
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No URL returned');

        setImageUrl(data.url);
        toast.success(language === "ar" ? "تم رفع الصورة" : "Image uploaded successfully");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(language === "ar" ? "خطأ في رفع الصورة" : "Failed to upload image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(language === "ar" ? "العنوان مطلوب" : "Title is required");
      return;
    }
    if (!content.trim()) {
      toast.error(language === "ar" ? "المحتوى مطلوب" : "Content is required");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const newsData = {
        title: title.trim(),
        content,
        image_url: imageUrl.trim() || null,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      };

      if (editingNews) {
        const { error } = await supabase
          .from("company_news")
          .update(newsData)
          .eq("id", editingNews.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الخبر" : "News updated successfully");
      } else {
        const { error } = await supabase
          .from("company_news")
          .insert({ ...newsData, created_by: user.id });

        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة الخبر" : "News added successfully");
      }

      setDialogOpen(false);
      fetchNews();
    } catch (error) {
      console.error("Error saving news:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الخبر" : "Error saving news");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل تريد حذف هذا الخبر؟" : "Delete this news item?")) {
      return;
    }

    setDeleting(id);
    try {
      const { error } = await supabase
        .from("company_news")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الخبر" : "News deleted successfully");
      fetchNews();
    } catch (error) {
      console.error("Error deleting news:", error);
      toast.error(language === "ar" ? "خطأ في حذف الخبر" : "Error deleting news");
    } finally {
      setDeleting(null);
    }
  };

  const togglePublish = async (item: NewsItem) => {
    try {
      const { error } = await supabase
        .from("company_news")
        .update({ 
          is_published: !item.is_published,
          published_at: !item.is_published ? new Date().toISOString() : null
        })
        .eq("id", item.id);

      if (error) throw error;
      toast.success(
        item.is_published 
          ? (language === "ar" ? "تم إلغاء النشر" : "Unpublished") 
          : (language === "ar" ? "تم النشر" : "Published")
      );
      fetchNews();
    } catch (error) {
      console.error("Error toggling publish:", error);
      toast.error(language === "ar" ? "خطأ في تغيير حالة النشر" : "Error toggling publish status");
    }
  };

  return (
    <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="h-6 w-6" />
          {language === "ar" ? "أخبار الشركة" : "Company News"}
        </h1>
        <Button onClick={openNewDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة خبر" : "Add News"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : news.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Newspaper className="h-12 w-12 mb-4" />
            <p>{language === "ar" ? "لا توجد أخبار" : "No news items"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {news.map(item => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <Badge variant={item.is_published ? "default" : "secondary"}>
                      {item.is_published 
                        ? (language === "ar" ? "منشور" : "Published")
                        : (language === "ar" ? "مسودة" : "Draft")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePublish(item)}
                    title={item.is_published ? (language === "ar" ? "إلغاء النشر" : "Unpublish") : (language === "ar" ? "نشر" : "Publish")}
                  >
                    {item.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                  >
                    {deleting === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {item.image_url && (
                  <img 
                    src={item.image_url} 
                    alt={item.title}
                    className="w-full max-h-48 object-cover rounded-md mb-3"
                  />
                )}
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.content) }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingNews 
                ? (language === "ar" ? "تعديل الخبر" : "Edit News")
                : (language === "ar" ? "إضافة خبر جديد" : "Add New News")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "العنوان" : "Title"}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "ar" ? "أدخل العنوان" : "Enter title"}
                className="mt-1"
              />
            </div>

            <div>
              <Label>{language === "ar" ? "صورة الخبر" : "News Image"}</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex-1"
                >
                  {uploadingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {language === "ar" ? "جاري الرفع..." : "Uploading..."}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {language === "ar" ? "رفع صورة" : "Upload Image"}
                    </>
                  )}
                </Button>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setImageUrl("")}
                    title={language === "ar" ? "إزالة الصورة" : "Remove image"}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {imageUrl && (
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className="mt-2 max-h-32 object-cover rounded-md"
                  onError={(e) => e.currentTarget.style.display = 'none'}
                />
              )}
            </div>

            <div>
              <Label>{language === "ar" ? "المحتوى" : "Content"}</Label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
              <Label>{language === "ar" ? "نشر فوري" : "Publish immediately"}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyNews;
