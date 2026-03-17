import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import AccessDenied from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, User, Phone, Mail, MessageSquare, Link2, Calendar, Clock, Send, Plus, Ticket, ListTodo, FileText } from "lucide-react";
import { toast } from "sonner";

interface CrmCase {
  id: string;
  case_number: string;
  case_type: string;
  subject: string;
  description: string | null;
  priority: string;
  stage_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  brand_id: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  ticket_id: string | null;
  shift_session_id: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CaseNote {
  id: string;
  case_id: string;
  note_type: string;
  content: string;
  metadata: any;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

interface CaseLink {
  id: string;
  case_id: string;
  link_type: string;
  linked_id: string;
  linked_title: string | null;
  created_at: string;
}

interface PipelineStage {
  id: string;
  stage_name: string;
  stage_name_ar: string | null;
  stage_order: number;
  color: string;
  is_closed: boolean;
}

const CRMCaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { hasAccess, isLoading: accessLoading, userId } = usePageAccess("/crm");
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRtl = language === 'ar';

  const [caseData, setCaseData] = useState<CrmCase | null>(null);
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [links, setLinks] = useState<CaseLink[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; user_name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; brand_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkType, setLinkType] = useState('ticket');
  const [linkId, setLinkId] = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [caseRes, notesRes, linksRes, stagesRes, profilesRes, brandsRes] = await Promise.all([
        supabase.from('crm_cases').select('*').eq('id', id).single(),
        supabase.from('crm_case_notes').select('*').eq('case_id', id).order('created_at', { ascending: false }),
        supabase.from('crm_case_links').select('*').eq('case_id', id).order('created_at', { ascending: false }),
        supabase.from('crm_pipeline_stages').select('*').eq('is_active', true).order('stage_order'),
        supabase.from('profiles').select('user_id, user_name').eq('is_active', true),
        supabase.from('brands').select('id, brand_name').eq('status', 'active'),
      ]);

      if (caseRes.data) setCaseData(caseRes.data as CrmCase);
      if (notesRes.data) setNotes(notesRes.data as CaseNote[]);
      if (linksRes.data) setLinks(linksRes.data as CaseLink[]);
      if (stagesRes.data) setStages(stagesRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (hasAccess) fetchData();
  }, [hasAccess, fetchData]);

  const handleUpdateField = async (field: string, value: any) => {
    if (!caseData) return;
    const updates: any = { [field]: value };
    
    // Track stage changes
    if (field === 'stage_id') {
      const stage = stages.find(s => s.id === value);
      if (stage?.is_closed && stage.stage_name === 'Resolved') updates.resolved_at = new Date().toISOString();
      if (stage?.is_closed && stage.stage_name === 'Closed') updates.closed_at = new Date().toISOString();
    }

    if (field === 'assigned_to') {
      const profile = profiles.find(p => p.user_id === value);
      updates.assigned_to_name = profile?.user_name || '';
    }

    const { error } = await supabase.from('crm_cases').update(updates).eq('id', caseData.id);
    if (error) {
      toast.error(error.message);
    } else {
      // Add activity note for stage/assignment changes
      if (field === 'stage_id' || field === 'assigned_to') {
        const { data: { user } } = await supabase.auth.getUser();
        const profile = profiles.find(p => p.user_id === user?.id);
        const noteType = field === 'stage_id' ? 'status_change' : 'assignment';
        const stage = stages.find(s => s.id === value);
        const assignee = profiles.find(p => p.user_id === value);
        const content = field === 'stage_id'
          ? `Stage changed to "${stage?.stage_name}"`
          : `Assigned to "${assignee?.user_name}"`;
        await supabase.from('crm_case_notes').insert({
          case_id: caseData.id,
          note_type: noteType,
          content,
          created_by: user!.id,
          created_by_name: profile?.user_name || '',
        });
      }
      fetchData();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !caseData) return;
    const { data: { user } } = await supabase.auth.getUser();
    const profile = profiles.find(p => p.user_id === user?.id);

    const { error } = await supabase.from('crm_case_notes').insert({
      case_id: caseData.id,
      note_type: 'note',
      content: newNote,
      created_by: user!.id,
      created_by_name: profile?.user_name || '',
    });

    if (error) toast.error(error.message);
    else {
      setNewNote('');
      fetchData();
    }
  };

  const handleAddLink = async () => {
    if (!linkId.trim() || !caseData) return;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('crm_case_links').insert({
      case_id: caseData.id,
      link_type: linkType,
      linked_id: linkId,
      linked_title: linkTitle || null,
      created_by: user!.id,
    });

    if (error) toast.error(error.message);
    else {
      setShowLinkDialog(false);
      setLinkId('');
      setLinkTitle('');
      fetchData();
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    const { error } = await supabase.from('crm_case_links').delete().eq('id', linkId);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };

  const noteTypeIcons: Record<string, any> = {
    note: MessageSquare,
    status_change: Clock,
    assignment: User,
    email: Mail,
    call: Phone,
    system: FileText,
  };

  const linkTypeIcons: Record<string, any> = {
    ticket: Ticket,
    task: ListTodo,
    email: Mail,
    shift: Clock,
    tawasoul: MessageSquare,
  };

  if (accessLoading || loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!hasAccess) return <AccessDenied />;
  if (!caseData) return <div className="p-6 text-center text-muted-foreground">{isRtl ? 'القضية غير موجودة' : 'Case not found'}</div>;

  const currentStage = stages.find(s => s.id === caseData.stage_id);
  const brandName = brands.find(b => b.id === caseData.brand_id)?.brand_name;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/crm')}>
          {isRtl ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{caseData.case_number}</h1>
            <Badge variant={caseData.case_type === 'sales' ? 'default' : 'secondary'}>
              {caseData.case_type === 'sales' ? (isRtl ? 'مبيعات' : 'Sales') : (isRtl ? 'دعم' : 'Support')}
            </Badge>
            <Badge className={priorityColors[caseData.priority]}>{caseData.priority}</Badge>
          </div>
          <h2 className="text-lg text-muted-foreground mt-1">{caseData.subject}</h2>
        </div>
      </div>

      {/* Pipeline Stages - visual stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((stage, idx) => (
          <button
            key={stage.id}
            onClick={() => handleUpdateField('stage_id', stage.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${caseData.stage_id === stage.id ? 'text-white shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
            style={caseData.stage_id === stage.id ? { backgroundColor: stage.color } : {}}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
            {isRtl && stage.stage_name_ar ? stage.stage_name_ar : stage.stage_name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {caseData.description && (
            <Card>
              <CardHeader><CardTitle className="text-base">{isRtl ? 'الوصف' : 'Description'}</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{caseData.description}</p></CardContent>
            </Card>
          )}

          <Tabs defaultValue="activity">
            <TabsList>
              <TabsTrigger value="activity">{isRtl ? 'النشاط' : 'Activity'} ({notes.length})</TabsTrigger>
              <TabsTrigger value="links">{isRtl ? 'الروابط' : 'Links'} ({links.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="space-y-4 mt-4">
              {/* Add Note */}
              <div className="flex gap-2">
                <Textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder={isRtl ? 'أضف ملاحظة...' : 'Add a note...'}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={handleAddNote} size="icon" disabled={!newNote.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Timeline */}
              <div className="space-y-3">
                {notes.map(note => {
                  const Icon = noteTypeIcons[note.note_type] || MessageSquare;
                  return (
                    <div key={note.id} className="flex gap-3 border-l-2 border-border pl-4 py-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{note.created_by_name || 'System'}</span>
                          <Badge variant="outline" className="text-[10px]">{note.note_type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(note.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  );
                })}
                {notes.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">{isRtl ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="links" className="space-y-4 mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> {isRtl ? 'إضافة رابط' : 'Add Link'}
              </Button>
              <div className="space-y-2">
                {links.map(link => {
                  const Icon = linkTypeIcons[link.link_type] || Link2;
                  return (
                    <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{link.link_type}</Badge>
                          <span className="text-sm font-medium">{link.linked_title || link.linked_id}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => handleDeleteLink(link.id)}>
                        {isRtl ? 'حذف' : 'Remove'}
                      </Button>
                    </div>
                  );
                })}
                {links.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">{isRtl ? 'لا توجد روابط' : 'No linked items'}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">{isRtl ? 'التفاصيل' : 'Details'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">{isRtl ? 'المسؤول' : 'Assigned To'}</Label>
                <Select value={caseData.assigned_to || ''} onValueChange={v => handleUpdateField('assigned_to', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={isRtl ? 'اختر' : 'Select'} /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.user_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{isRtl ? 'الأولوية' : 'Priority'}</Label>
                <Select value={caseData.priority} onValueChange={v => handleUpdateField('priority', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{isRtl ? 'منخفض' : 'Low'}</SelectItem>
                    <SelectItem value="medium">{isRtl ? 'متوسط' : 'Medium'}</SelectItem>
                    <SelectItem value="high">{isRtl ? 'عالي' : 'High'}</SelectItem>
                    <SelectItem value="critical">{isRtl ? 'حرج' : 'Critical'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{isRtl ? 'العلامة التجارية' : 'Brand'}</Label>
                <Select value={caseData.brand_id || ''} onValueChange={v => handleUpdateField('brand_id', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={isRtl ? 'اختر' : 'Select'} /></SelectTrigger>
                  <SelectContent>
                    {brands.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{isRtl ? 'أنشئ بواسطة' : 'Created By'}</Label>
                <p className="text-sm">{caseData.created_by_name || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{isRtl ? 'تاريخ الإنشاء' : 'Created At'}</Label>
                <p className="text-sm">{new Date(caseData.created_at).toLocaleString()}</p>
              </div>
              {caseData.resolved_at && (
                <div>
                  <Label className="text-xs text-muted-foreground">{isRtl ? 'تاريخ الحل' : 'Resolved At'}</Label>
                  <p className="text-sm">{new Date(caseData.resolved_at).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">{isRtl ? 'العميل' : 'Customer'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {caseData.customer_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{caseData.customer_name}</span>
                </div>
              )}
              {caseData.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${caseData.customer_phone}`} className="text-sm text-primary hover:underline">{caseData.customer_phone}</a>
                </div>
              )}
              {caseData.customer_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${caseData.customer_email}`} className="text-sm text-primary hover:underline">{caseData.customer_email}</a>
                </div>
              )}
              {!caseData.customer_name && !caseData.customer_phone && !caseData.customer_email && (
                <p className="text-sm text-muted-foreground">{isRtl ? 'لا توجد بيانات عميل' : 'No customer data'}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRtl ? 'إضافة رابط' : 'Add Link'}</DialogTitle>
            <DialogDescription>{isRtl ? 'ربط تذكرة أو مهمة أو بريد بهذه القضية' : 'Link a ticket, task, email, or shift to this case'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRtl ? 'النوع' : 'Link Type'}</Label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ticket">{isRtl ? 'تذكرة' : 'Ticket'}</SelectItem>
                  <SelectItem value="task">{isRtl ? 'مهمة' : 'Task'}</SelectItem>
                  <SelectItem value="email">{isRtl ? 'بريد' : 'Email'}</SelectItem>
                  <SelectItem value="shift">{isRtl ? 'وردية' : 'Shift'}</SelectItem>
                  <SelectItem value="tawasoul">{isRtl ? 'تواصل' : 'Tawasoul'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRtl ? 'المعرف' : 'ID / Reference'}</Label>
              <Input value={linkId} onChange={e => setLinkId(e.target.value)} placeholder={isRtl ? 'مثال: TKT-20260317-0001' : 'e.g. TKT-20260317-0001'} />
            </div>
            <div>
              <Label>{isRtl ? 'العنوان (اختياري)' : 'Title (optional)'}</Label>
              <Input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleAddLink} disabled={!linkId.trim()}>{isRtl ? 'إضافة' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMCaseDetail;
