import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen, Tag, ChevronDown, ChevronUp } from "lucide-react";

interface KbArticle {
  id: string;
  title: string;
  title_ar: string | null;
  content: string;
  content_ar: string | null;
  tags: string[];
  category_id: string | null;
}

interface KbCategory {
  id: string;
  category_name: string;
  category_name_ar: string | null;
}

const CRMKnowledgeBasePanel = () => {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: arts }, { data: cats }] = await Promise.all([
        supabase.from('kb_articles').select('id, title, title_ar, content, content_ar, tags, category_id').eq('is_published', true),
        supabase.from('kb_categories').select('id, category_name, category_name_ar').eq('is_active', true),
      ]);
      if (arts) setArticles(arts);
      if (cats) setCategories(cats);
    };
    fetch();
  }, []);

  const q = searchQuery.toLowerCase();
  const filtered = q
    ? articles.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.title_ar || '').toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (a.content_ar || '').toLowerCase().includes(q) ||
        (a.tags || []).some(t => t.toLowerCase().includes(q))
      )
    : [];

  const getCatName = (catId: string | null) => {
    if (!catId) return '';
    const cat = categories.find(c => c.id === catId);
    return cat ? (isRtl ? cat.category_name_ar || cat.category_name : cat.category_name) : '';
  };

  const incrementView = async (id: string) => {
    await supabase.rpc('exec_sql', { sql: `UPDATE public.kb_articles SET view_count = view_count + 1 WHERE id = '${id}'` });
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      incrementView(id);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          {isRtl ? 'قاعدة المعرفة' : 'Knowledge Base'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isRtl ? 'ابحث عن مقال...' : 'Search KB...'}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {q && (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {filtered.map(art => (
                <div
                  key={art.id}
                  className="border rounded-lg p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleExpand(art.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{isRtl ? art.title_ar || art.title : art.title}</p>
                      {getCatName(art.category_id) && (
                        <Badge variant="outline" className="text-[9px] mt-0.5">{getCatName(art.category_id)}</Badge>
                      )}
                    </div>
                    {expandedId === art.id ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                  {expandedId === art.id && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{isRtl ? art.content_ar || art.content : art.content}</p>
                      {art.tags && art.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {art.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[9px]"><Tag className="h-2.5 w-2.5 mr-0.5" />{tag}</Badge>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">{isRtl ? 'لا توجد نتائج' : 'No results found'}</p>
              )}
            </div>
          </ScrollArea>
        )}

        {!q && (
          <p className="text-xs text-muted-foreground text-center py-2">{isRtl ? 'اكتب للبحث في المقالات' : 'Type to search articles'}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CRMKnowledgeBasePanel;
