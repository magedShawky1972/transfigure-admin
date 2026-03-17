import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, GripVertical } from "lucide-react";
import { toast } from "sonner";

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

const CRMSetup = () => {
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/crm-setup");
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [form, setForm] = useState({
    stage_name: '',
    stage_name_ar: '',
    stage_type: 'both',
    color: '#3b82f6',
    is_active: true,
    is_closed: false,
  });

  const fetchStages = async () => {
    const { data } = await supabase.from('crm_pipeline_stages').select('*').order('stage_order');
    if (data) setStages(data);
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) fetchStages();
  }, [hasAccess]);

  const handleSave = async () => {
    if (!form.stage_name.trim()) {
      toast.error(isRtl ? 'اسم المرحلة مطلوب' : 'Stage name is required');
      return;
    }

    if (editingStage) {
      const { error } = await supabase.from('crm_pipeline_stages').update({
        stage_name: form.stage_name,
        stage_name_ar: form.stage_name_ar || null,
        stage_type: form.stage_type,
        color: form.color,
        is_active: form.is_active,
        is_closed: form.is_closed,
      }).eq('id', editingStage.id);

      if (error) toast.error(error.message);
      else toast.success(isRtl ? 'تم التحديث' : 'Updated');
    } else {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.stage_order)) : 0;
      const { error } = await supabase.from('crm_pipeline_stages').insert({
        stage_name: form.stage_name,
        stage_name_ar: form.stage_name_ar || null,
        stage_order: maxOrder + 1,
        stage_type: form.stage_type,
        color: form.color,
        is_active: form.is_active,
        is_closed: form.is_closed,
      });

      if (error) toast.error(error.message);
      else toast.success(isRtl ? 'تم الإنشاء' : 'Created');
    }

    setShowDialog(false);
    setEditingStage(null);
    fetchStages();
  };

  const openEdit = (stage: PipelineStage) => {
    setEditingStage(stage);
    setForm({
      stage_name: stage.stage_name,
      stage_name_ar: stage.stage_name_ar || '',
      stage_type: stage.stage_type,
      color: stage.color,
      is_active: stage.is_active,
      is_closed: stage.is_closed,
    });
    setShowDialog(true);
  };

  const openNew = () => {
    setEditingStage(null);
    setForm({ stage_name: '', stage_name_ar: '', stage_type: 'both', color: '#3b82f6', is_active: true, is_closed: false });
    setShowDialog(true);
  };

  if (accessLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isRtl ? 'إعداد CRM' : 'CRM Setup'}</h1>
          <p className="text-muted-foreground text-sm">{isRtl ? 'إدارة مراحل سير العمل' : 'Manage pipeline stages'}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> {isRtl ? 'مرحلة جديدة' : 'New Stage'}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{isRtl ? 'مراحل سير العمل' : 'Pipeline Stages'}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{isRtl ? 'اللون' : 'Color'}</TableHead>
                <TableHead>{isRtl ? 'الاسم (إنجليزي)' : 'Name (EN)'}</TableHead>
                <TableHead>{isRtl ? 'الاسم (عربي)' : 'Name (AR)'}</TableHead>
                <TableHead>{isRtl ? 'النوع' : 'Type'}</TableHead>
                <TableHead>{isRtl ? 'مغلقة' : 'Closed'}</TableHead>
                <TableHead>{isRtl ? 'نشطة' : 'Active'}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map(stage => (
                <TableRow key={stage.id}>
                  <TableCell className="text-muted-foreground">{stage.stage_order}</TableCell>
                  <TableCell><div className="w-6 h-6 rounded" style={{ backgroundColor: stage.color }} /></TableCell>
                  <TableCell className="font-medium">{stage.stage_name}</TableCell>
                  <TableCell>{stage.stage_name_ar || '-'}</TableCell>
                  <TableCell className="capitalize">{stage.stage_type}</TableCell>
                  <TableCell>{stage.is_closed ? '✓' : '-'}</TableCell>
                  <TableCell>{stage.is_active ? '✓' : '✗'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(stage)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? (isRtl ? 'تعديل المرحلة' : 'Edit Stage') : (isRtl ? 'مرحلة جديدة' : 'New Stage')}</DialogTitle>
            <DialogDescription>{isRtl ? 'تعريف مرحلة سير العمل' : 'Define pipeline stage properties'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRtl ? 'الاسم (إنجليزي)' : 'Name (EN)'} *</Label>
                <Input value={form.stage_name} onChange={e => setForm(p => ({ ...p, stage_name: e.target.value }))} />
              </div>
              <div>
                <Label>{isRtl ? 'الاسم (عربي)' : 'Name (AR)'}</Label>
                <Input value={form.stage_name_ar} onChange={e => setForm(p => ({ ...p, stage_name_ar: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRtl ? 'النوع' : 'Type'}</Label>
                <Select value={form.stage_type} onValueChange={v => setForm(p => ({ ...p, stage_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">{isRtl ? 'الكل' : 'Both'}</SelectItem>
                    <SelectItem value="sales">{isRtl ? 'مبيعات' : 'Sales'}</SelectItem>
                    <SelectItem value="support">{isRtl ? 'دعم' : 'Support'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isRtl ? 'اللون' : 'Color'}</Label>
                <Input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} className="h-10" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                <Label>{isRtl ? 'نشطة' : 'Active'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_closed} onCheckedChange={v => setForm(p => ({ ...p, is_closed: v }))} />
                <Label>{isRtl ? 'مرحلة إغلاق' : 'Closing Stage'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{isRtl ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSave}>{isRtl ? 'حفظ' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMSetup;
