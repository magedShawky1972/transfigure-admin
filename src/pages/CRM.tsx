import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, List, LayoutGrid, Search, Filter, Phone, Mail, User, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";

interface PipelineStage {
  id: string;
  stage_name: string;
  stage_name_ar: string | null;
  stage_order: number;
  stage_type: string;
  color: string;
  is_active: boolean;
  is_closed: boolean;
}

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
  created_at: string;
  updated_at: string;
}

function DroppableColumn({ id, children, color, title, count }: { id: string; children: React.ReactNode; color: string; title: string; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[320px] rounded-xl border transition-all ${isOver ? 'ring-2 ring-primary bg-accent/30' : 'bg-muted/30'}`}
    >
      <div className="flex items-center gap-2 p-3 border-b rounded-t-xl" style={{ borderTopColor: color, borderTopWidth: '3px' }}>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold text-sm flex-1">{title}</span>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-280px)]">
        {children}
      </div>
    </div>
  );
}

function DraggableCaseCard({ caseItem, language, onClick }: { caseItem: CrmCase; language: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: caseItem.id,
    data: { caseItem },
  });

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
    zIndex: isDragging ? 999 : undefined,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const priorityColors: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <Card className="hover:shadow-md transition-shadow border border-border/60" onClick={onClick}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">{caseItem.case_number}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[caseItem.priority] || ''}`}>
              {caseItem.priority}
            </Badge>
          </div>
          <p className="text-sm font-medium line-clamp-2">{caseItem.subject}</p>
          {caseItem.customer_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{caseItem.customer_name}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Badge variant={caseItem.case_type === 'sales' ? 'default' : 'secondary'} className="text-[10px]">
              {caseItem.case_type === 'sales' ? (language === 'ar' ? 'مبيعات' : 'Sales') : (language === 'ar' ? 'دعم' : 'Support')}
            </Badge>
            {caseItem.assigned_to_name && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{caseItem.assigned_to_name}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CaseOverlayCard({ caseItem, language }: { caseItem: CrmCase; language: string }) {
  return (
    <Card className="shadow-xl border-2 border-primary w-[280px]">
      <CardContent className="p-3 space-y-2">
        <span className="text-xs font-mono text-muted-foreground">{caseItem.case_number}</span>
        <p className="text-sm font-medium">{caseItem.subject}</p>
      </CardContent>
    </Card>
  );
}

const CRM = () => {
  const { hasAccess, isLoading: accessLoading, userId } = usePageAccess("/crm");
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRtl = language === 'ar';

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [cases, setCases] = useState<CrmCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showNewCaseDialog, setShowNewCaseDialog] = useState(false);
  const [activeCase, setActiveCase] = useState<CrmCase | null>(null);

  // New case form
  const [newCase, setNewCase] = useState({
    subject: '',
    description: '',
    case_type: 'support',
    priority: 'medium',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
  });

  const [profiles, setProfiles] = useState<{ user_id: string; user_name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; brand_name: string }[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchData = useCallback(async () => {
    try {
      const [stagesRes, casesRes, profilesRes, brandsRes] = await Promise.all([
        supabase.from('crm_pipeline_stages').select('*').eq('is_active', true).order('stage_order'),
        supabase.from('crm_cases').select('*').order('updated_at', { ascending: false }),
        supabase.from('profiles').select('user_id, user_name').eq('is_active', true),
        supabase.from('brands').select('id, brand_name').eq('status', 'active'),
      ]);

      if (stagesRes.data) setStages(stagesRes.data);
      if (casesRes.data) setCases(casesRes.data as CrmCase[]);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchData();
  }, [hasAccess, fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('crm-cases-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_cases' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredCases = cases.filter(c => {
    if (searchTerm && !c.subject.toLowerCase().includes(searchTerm.toLowerCase()) && !c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) && !(c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterType !== 'all' && c.case_type !== filterType) return false;
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    return true;
  });

  const handleCreateCase = async () => {
    if (!newCase.subject.trim()) {
      toast.error(isRtl ? 'الموضوع مطلوب' : 'Subject is required');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const profile = profiles.find(p => p.user_id === user.id);
    const defaultStage = stages.find(s => s.stage_order === 1) || stages[0];

    const { error } = await supabase.from('crm_cases').insert({
      case_number: '',
      subject: newCase.subject,
      description: newCase.description || null,
      case_type: newCase.case_type,
      priority: newCase.priority,
      customer_name: newCase.customer_name || null,
      customer_phone: newCase.customer_phone || null,
      customer_email: newCase.customer_email || null,
      stage_id: defaultStage?.id || null,
      created_by: user.id,
      created_by_name: profile?.user_name || user.email || '',
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRtl ? 'تم إنشاء القضية بنجاح' : 'Case created successfully');
      setShowNewCaseDialog(false);
      setNewCase({ subject: '', description: '', case_type: 'support', priority: 'medium', customer_name: '', customer_phone: '', customer_email: '' });
      fetchData();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const caseItem = event.active.data.current?.caseItem;
    if (caseItem) setActiveCase(caseItem);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCase(null);
    const { active, over } = event;
    if (!over) return;

    const caseId = active.id as string;
    const newStageId = over.id as string;
    const caseItem = cases.find(c => c.id === caseId);
    if (!caseItem || caseItem.stage_id === newStageId) return;

    // Optimistic update
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, stage_id: newStageId } : c));

    const stage = stages.find(s => s.id === newStageId);
    const updates: any = { stage_id: newStageId };
    if (stage?.is_closed && stage.stage_name === 'Resolved') updates.resolved_at = new Date().toISOString();
    if (stage?.is_closed && stage.stage_name === 'Closed') updates.closed_at = new Date().toISOString();

    const { error } = await supabase.from('crm_cases').update(updates).eq('id', caseId);
    if (error) {
      toast.error(error.message);
      fetchData();
    } else {
      // Add activity note
      const { data: { user } } = await supabase.auth.getUser();
      const profile = profiles.find(p => p.user_id === user?.id);
      const oldStage = stages.find(s => s.id === caseItem.stage_id);
      await supabase.from('crm_case_notes').insert({
        case_id: caseId,
        note_type: 'status_change',
        content: `Stage changed from "${oldStage?.stage_name || 'Unknown'}" to "${stage?.stage_name || 'Unknown'}"`,
        created_by: user!.id,
        created_by_name: profile?.user_name || '',
      });
    }
  };

  if (accessLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-4 ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isRtl ? 'إدارة علاقات العملاء' : 'CRM - Case Management'}</h1>
          <p className="text-muted-foreground text-sm">{isRtl ? 'إدارة حالات المبيعات والدعم' : 'Manage sales and support cases'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('kanban')}>
            <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')}>
            <List className="h-4 w-4 mr-1" /> {isRtl ? 'قائمة' : 'List'}
          </Button>
          <Button onClick={() => setShowNewCaseDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> {isRtl ? 'قضية جديدة' : 'New Case'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isRtl ? 'بحث بالموضوع أو الرقم أو العميل...' : 'Search by subject, number, or customer...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRtl ? 'الكل' : 'All Types'}</SelectItem>
            <SelectItem value="sales">{isRtl ? 'مبيعات' : 'Sales'}</SelectItem>
            <SelectItem value="support">{isRtl ? 'دعم' : 'Support'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRtl ? 'كل الأولويات' : 'All Priorities'}</SelectItem>
            <SelectItem value="low">{isRtl ? 'منخفض' : 'Low'}</SelectItem>
            <SelectItem value="medium">{isRtl ? 'متوسط' : 'Medium'}</SelectItem>
            <SelectItem value="high">{isRtl ? 'عالي' : 'High'}</SelectItem>
            <SelectItem value="critical">{isRtl ? 'حرج' : 'Critical'}</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          {filteredCases.length} {isRtl ? 'قضية' : 'cases'}
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => {
              const stageCases = filteredCases.filter(c => c.stage_id === stage.id);
              return (
                <DroppableColumn key={stage.id} id={stage.id} color={stage.color} title={isRtl && stage.stage_name_ar ? stage.stage_name_ar : stage.stage_name} count={stageCases.length}>
                  {stageCases.map(caseItem => (
                    <DraggableCaseCard
                      key={caseItem.id}
                      caseItem={caseItem}
                      language={language}
                      onClick={() => navigate(`/crm/${caseItem.id}`)}
                    />
                  ))}
                </DroppableColumn>
              );
            })}
          </div>
          <DragOverlay>
            {activeCase && <CaseOverlayCard caseItem={activeCase} language={language} />}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الرقم' : 'Number'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الموضوع' : 'Subject'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'النوع' : 'Type'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'الأولوية' : 'Priority'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'المرحلة' : 'Stage'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'العميل' : 'Customer'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'المسؤول' : 'Assigned To'}</th>
                  <th className="text-start p-3 font-medium">{isRtl ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map(c => {
                  const stage = stages.find(s => s.id === c.stage_id);
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/crm/${c.id}`)}>
                      <td className="p-3 font-mono text-xs">{c.case_number}</td>
                      <td className="p-3 font-medium max-w-[200px] truncate">{c.subject}</td>
                      <td className="p-3">
                        <Badge variant={c.case_type === 'sales' ? 'default' : 'secondary'} className="text-xs">
                          {c.case_type === 'sales' ? (isRtl ? 'مبيعات' : 'Sales') : (isRtl ? 'دعم' : 'Support')}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs capitalize">{c.priority}</Badge>
                      </td>
                      <td className="p-3">
                        {stage && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                            <span className="text-xs">{isRtl && stage.stage_name_ar ? stage.stage_name_ar : stage.stage_name}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs">{c.customer_name || '-'}</td>
                      <td className="p-3 text-xs">{c.assigned_to_name || '-'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="p-3">{isRtl ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</td>
                    </tr>
                  );
                })}
                {filteredCases.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{isRtl ? 'لا توجد قضايا' : 'No cases found'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Case Dialog */}
      <Dialog open={showNewCaseDialog} onOpenChange={setShowNewCaseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isRtl ? 'قضية جديدة' : 'New Case'}</DialogTitle>
            <DialogDescription>{isRtl ? 'إنشاء قضية جديدة في نظام إدارة علاقات العملاء' : 'Create a new case in the CRM system'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRtl ? 'النوع' : 'Type'}</Label>
                <Select value={newCase.case_type} onValueChange={v => setNewCase(p => ({ ...p, case_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">{isRtl ? 'دعم' : 'Support'}</SelectItem>
                    <SelectItem value="sales">{isRtl ? 'مبيعات' : 'Sales'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isRtl ? 'الأولوية' : 'Priority'}</Label>
                <Select value={newCase.priority} onValueChange={v => setNewCase(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{isRtl ? 'منخفض' : 'Low'}</SelectItem>
                    <SelectItem value="medium">{isRtl ? 'متوسط' : 'Medium'}</SelectItem>
                    <SelectItem value="high">{isRtl ? 'عالي' : 'High'}</SelectItem>
                    <SelectItem value="critical">{isRtl ? 'حرج' : 'Critical'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{isRtl ? 'الموضوع' : 'Subject'} *</Label>
              <Input value={newCase.subject} onChange={e => setNewCase(p => ({ ...p, subject: e.target.value }))} placeholder={isRtl ? 'أدخل موضوع القضية' : 'Enter case subject'} />
            </div>
            <div>
              <Label>{isRtl ? 'الوصف' : 'Description'}</Label>
              <Textarea value={newCase.description} onChange={e => setNewCase(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>{isRtl ? 'اسم العميل' : 'Customer Name'}</Label>
                <Input value={newCase.customer_name} onChange={e => setNewCase(p => ({ ...p, customer_name: e.target.value }))} />
              </div>
              <div>
                <Label>{isRtl ? 'هاتف العميل' : 'Customer Phone'}</Label>
                <Input value={newCase.customer_phone} onChange={e => setNewCase(p => ({ ...p, customer_phone: e.target.value }))} />
              </div>
              <div>
                <Label>{isRtl ? 'بريد العميل' : 'Customer Email'}</Label>
                <Input value={newCase.customer_email} onChange={e => setNewCase(p => ({ ...p, customer_email: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCaseDialog(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleCreateCase}>{isRtl ? 'إنشاء' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRM;
