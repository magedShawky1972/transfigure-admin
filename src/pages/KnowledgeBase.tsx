import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Search, FolderOpen, FileText, Tag, Eye } from "lucide-react";
import { toast } from "sonner";

interface KbCategory {
  id: string;
  category_name: string;
  category_name_ar: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface KbArticle {
  id: string;
  category_id: string | null;
  title: string;
  title_ar: string | null;
  content: string;
  content_ar: string | null;
  tags: string[];
  is_published: boolean;
  view_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KnowledgeBase = () => {
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/knowledge-base");
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Category dialog
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<KbCategory | null>(null);
  const [catForm, setCatForm] = useState({ category_name: '', category_name_ar: '', description: '', is_active: true, sort_order: 0 });

  // Article dialog
  const [showArtDialog, setShowArtDialog] = useState(false);
  const [editingArt, setEditingArt] = useState<KbArticle | null>(null);
  const [artForm, setArtForm] = useState({ title: '', title_ar: '', content: '', content_ar: '', category_id: '', tags: '', is_published: true });

  const fetchData = async () => {
    const [{ data: cats }, { data: arts }] = await Promise.all([
      supabase.from('kb_categories').select('*').order('sort_order'),
      supabase.from('kb_articles').select('*').order('created_at', { ascending: false }),
    ]);
    if (cats) setCategories(cats);
    if (arts) setArticles(arts);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Category CRUD
  const openCatDialog = (cat?: KbCategory) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ category_name: cat.category_name, category_name_ar: cat.category_name_ar || '', description: cat.description || '', is_active: cat.is_active, sort_order: cat.sort_order });
    } else {
      setEditingCat(null);
      setCatForm({ category_name: '', category_name_ar: '', description: '', is_active: true, sort_order: 0 });
    }
    setShowCatDialog(true);
  };

  const saveCat = async () => {
    const payload = { ...catForm, category_name_ar: catForm.category_name_ar || null, description: catForm.description || null };
    if (editingCat) {
      const { error } = await supabase.from('kb_categories').update(payload).eq('id', editingCat.id);
      if (error) { toast.error(error.message); return; }
      toast.success(isRtl ? 'تم التحديث' : 'Category updated');
    } else {
      const { error } = await supabase.from('kb_categories').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(isRtl ? 'تم الإضافة' : 'Category added');
    }
    setShowCatDialog(false);
    fetchData();
  };

  const deleteCat = async (id: string) => {
    await supabase.from('kb_categories').delete().eq('id', id);
    toast.success(isRtl ? 'تم الحذف' : 'Category deleted');
    fetchData();
  };

  // Article CRUD
  const openArtDialog = (art?: KbArticle) => {
    if (art) {
      setEditingArt(art);
      setArtForm({ title: art.title, title_ar: art.title_ar || '', content: art.content, content_ar: art.content_ar || '', category_id: art.category_id || '', tags: (art.tags || []).join(', '), is_published: art.is_published });
    } else {
      setEditingArt(null);
      setArtForm({ title: '', title_ar: '', content: '', content_ar: '', category_id: '', tags: '', is_published: true });
    }
    setShowArtDialog(true);
  };

  const saveArt = async () => {
    const tags = artForm.tags.split(',').map(t => t.trim()).filter(Boolean);
    const payload = {
      title: artForm.title,
      title_ar: artForm.title_ar || null,
      content: artForm.content,
      content_ar: artForm.content_ar || null,
      category_id: artForm.category_id || null,
      tags,
      is_published: artForm.is_published,
    };
    if (editingArt) {
      const { error } = await supabase.from('kb_articles').update(payload).eq('id', editingArt.id);
      if (error) { toast.error(error.message); return; }
      toast.success(isRtl ? 'تم التحديث' : 'Article updated');
    } else {
      const { error } = await supabase.from('kb_articles').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(isRtl ? 'تم الإضافة' : 'Article added');
    }
    setShowArtDialog(false);
    fetchData();
  };

  const deleteArt = async (id: string) => {
    await supabase.from('kb_articles').delete().eq('id', id);
    toast.success(isRtl ? 'تم الحذف' : 'Article deleted');
    fetchData();
  };

  // Filtering
  const filteredArticles = articles.filter(a => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || a.title.toLowerCase().includes(q) || (a.title_ar || '').toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q));
    const matchesCat = filterCategory === 'all' || a.category_id === filterCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryName = (catId: string | null) => {
    if (!catId) return isRtl ? 'بدون تصنيف' : 'Uncategorized';
    const cat = categories.find(c => c.id === catId);
    return cat ? (isRtl ? cat.category_name_ar || cat.category_name : cat.category_name) : '-';
  };

  if (accessLoading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">{isRtl ? 'قاعدة المعرفة' : 'Knowledge Base'}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="articles"><FileText className="h-4 w-4 mr-1" /> {isRtl ? 'المقالات' : 'Articles'}</TabsTrigger>
          <TabsTrigger value="categories"><FolderOpen className="h-4 w-4 mr-1" /> {isRtl ? 'التصنيفات' : 'Categories'}</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={isRtl ? 'بحث في المقالات...' : 'Search articles...'} className="pl-9" />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRtl ? 'كل التصنيفات' : 'All Categories'}</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{isRtl ? c.category_name_ar || c.category_name : c.category_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => openArtDialog()}><Plus className="h-4 w-4 mr-1" /> {isRtl ? 'مقال جديد' : 'New Article'}</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map(art => (
              <Card key={art.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openArtDialog(art)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{isRtl ? art.title_ar || art.title : art.title}</CardTitle>
                    {!art.is_published && <Badge variant="secondary" className="shrink-0">{isRtl ? 'مسودة' : 'Draft'}</Badge>}
                  </div>
                  <Badge variant="outline" className="text-[10px] w-fit">{getCategoryName(art.category_id)}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">{isRtl ? art.content_ar || art.content : art.content}</p>
                  {art.tags && art.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {art.tags.slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-[10px]"><Tag className="h-3 w-3 mr-0.5" />{tag}</Badge>)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" /> {art.view_count}
                    <span>• {new Date(art.updated_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredArticles.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">{isRtl ? 'لا توجد مقالات' : 'No articles found'}</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4 mt-4">
          <Button onClick={() => openCatDialog()}><Plus className="h-4 w-4 mr-1" /> {isRtl ? 'تصنيف جديد' : 'New Category'}</Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isRtl ? 'الترتيب' : 'Order'}</TableHead>
                <TableHead>{isRtl ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{isRtl ? 'الاسم بالعربي' : 'Name (AR)'}</TableHead>
                <TableHead>{isRtl ? 'الوصف' : 'Description'}</TableHead>
                <TableHead>{isRtl ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{isRtl ? 'المقالات' : 'Articles'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.id}>
                  <TableCell>{cat.sort_order}</TableCell>
                  <TableCell className="font-medium">{cat.category_name}</TableCell>
                  <TableCell>{cat.category_name_ar || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{cat.description || '-'}</TableCell>
                  <TableCell><Badge variant={cat.is_active ? 'default' : 'secondary'}>{cat.is_active ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'غير نشط' : 'Inactive')}</Badge></TableCell>
                  <TableCell>{articles.filter(a => a.category_id === cat.id).length}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openCatDialog(cat)}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteCat(cat.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{isRtl ? 'لا توجد تصنيفات' : 'No categories'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? (isRtl ? 'تعديل التصنيف' : 'Edit Category') : (isRtl ? 'تصنيف جديد' : 'New Category')}</DialogTitle>
            <DialogDescription>{isRtl ? 'أدخل بيانات التصنيف' : 'Enter category details'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>{isRtl ? 'الاسم' : 'Name'}</Label><Input value={catForm.category_name} onChange={e => setCatForm(p => ({ ...p, category_name: e.target.value }))} /></div>
            <div><Label>{isRtl ? 'الاسم بالعربي' : 'Name (AR)'}</Label><Input value={catForm.category_name_ar} onChange={e => setCatForm(p => ({ ...p, category_name_ar: e.target.value }))} /></div>
            <div><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={catForm.description} onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div><Label>{isRtl ? 'الترتيب' : 'Sort Order'}</Label><Input type="number" value={catForm.sort_order} onChange={e => setCatForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            <div className="flex items-center gap-2"><Switch checked={catForm.is_active} onCheckedChange={v => setCatForm(p => ({ ...p, is_active: v }))} /><Label>{isRtl ? 'نشط' : 'Active'}</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCatDialog(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveCat} disabled={!catForm.category_name.trim()}>{isRtl ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article Dialog */}
      <Dialog open={showArtDialog} onOpenChange={setShowArtDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingArt ? (isRtl ? 'تعديل المقال' : 'Edit Article') : (isRtl ? 'مقال جديد' : 'New Article')}</DialogTitle>
            <DialogDescription>{isRtl ? 'أدخل بيانات المقال' : 'Enter article details'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>{isRtl ? 'العنوان' : 'Title'}</Label><Input value={artForm.title} onChange={e => setArtForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>{isRtl ? 'العنوان بالعربي' : 'Title (AR)'}</Label><Input value={artForm.title_ar} onChange={e => setArtForm(p => ({ ...p, title_ar: e.target.value }))} /></div>
            <div>
              <Label>{isRtl ? 'التصنيف' : 'Category'}</Label>
              <Select value={artForm.category_id} onValueChange={v => setArtForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder={isRtl ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{isRtl ? c.category_name_ar || c.category_name : c.category_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{isRtl ? 'المحتوى' : 'Content'}</Label><Textarea value={artForm.content} onChange={e => setArtForm(p => ({ ...p, content: e.target.value }))} rows={6} /></div>
            <div><Label>{isRtl ? 'المحتوى بالعربي' : 'Content (AR)'}</Label><Textarea value={artForm.content_ar} onChange={e => setArtForm(p => ({ ...p, content_ar: e.target.value }))} rows={6} /></div>
            <div><Label>{isRtl ? 'الوسوم (مفصولة بفاصلة)' : 'Tags (comma separated)'}</Label><Input value={artForm.tags} onChange={e => setArtForm(p => ({ ...p, tags: e.target.value }))} placeholder="FAQ, billing, refund" /></div>
            <div className="flex items-center gap-2"><Switch checked={artForm.is_published} onCheckedChange={v => setArtForm(p => ({ ...p, is_published: v }))} /><Label>{isRtl ? 'منشور' : 'Published'}</Label></div>
            {editingArt && (
              <Button variant="destructive" size="sm" onClick={() => { deleteArt(editingArt.id); setShowArtDialog(false); }}>
                <Trash2 className="h-4 w-4 mr-1" /> {isRtl ? 'حذف المقال' : 'Delete Article'}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArtDialog(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={saveArt} disabled={!artForm.title.trim() || !artForm.content.trim()}>{isRtl ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBase;
