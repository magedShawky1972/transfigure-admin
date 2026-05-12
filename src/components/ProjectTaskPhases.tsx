import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Phase {
  id: string;
  project_id: string;
  phase_key: string;
  phase_name: string;
  phase_name_ar: string | null;
  phase_color: string;
  phase_order: number;
  is_active: boolean;
}

interface Props {
  projectId: string;
  language?: 'en' | 'ar';
}

const DEFAULT_PHASES = [
  { phase_key: 'todo', phase_name: 'To Do', phase_name_ar: 'للتنفيذ', phase_color: '#6B7280' },
  { phase_key: 'in_progress', phase_name: 'In Progress', phase_name_ar: 'قيد التنفيذ', phase_color: '#3B82F6' },
  { phase_key: 'review', phase_name: 'Review', phase_name_ar: 'مراجعة', phase_color: '#F59E0B' },
  { phase_key: 'done', phase_name: 'Done', phase_name_ar: 'مكتمل', phase_color: '#22C55E' },
];

export default function ProjectTaskPhases({ projectId, language = 'en' }: Props) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [newP, setNewP] = useState({ phase_name: '', phase_name_ar: '', phase_color: '#3B82F6' });

  const t = {
    title: language === 'ar' ? 'مراحل مهام المشروع' : 'Project Task Phases',
    note: language === 'ar' ? 'إذا تركت فارغًا، سيتم استخدام مراحل القسم الافتراضية.' : 'If empty, the department default phases are used.',
    name: language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)',
    nameAr: language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)',
    color: language === 'ar' ? 'اللون' : 'Color',
    add: language === 'ar' ? 'إضافة مرحلة' : 'Add Phase',
    seed: language === 'ar' ? 'استخدام الافتراضي' : 'Seed defaults',
    empty: language === 'ar' ? 'لا توجد مراحل خاصة بالمشروع' : 'No project-specific phases',
  };

  const load = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from('project_task_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('phase_order', { ascending: true });
    setPhases((data as Phase[]) || []);
  };

  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!newP.phase_name.trim()) return;
    const phase_key = newP.phase_name.toLowerCase().replace(/\s+/g, '_');
    const { error } = await supabase.from('project_task_phases').insert({
      project_id: projectId,
      phase_key,
      phase_name: newP.phase_name.trim(),
      phase_name_ar: newP.phase_name_ar.trim() || null,
      phase_color: newP.phase_color,
      phase_order: phases.length,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setNewP({ phase_name: '', phase_name_ar: '', phase_color: '#3B82F6' });
    load();
  };

  const seed = async () => {
    const inserts = DEFAULT_PHASES.map((p, i) => ({ ...p, project_id: projectId, phase_order: i }));
    const { error } = await supabase.from('project_task_phases').insert(inserts);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('project_task_phases').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= phases.length) return;
    const a = phases[idx], b = phases[target];
    await supabase.from('project_task_phases').update({ phase_order: b.phase_order }).eq('id', a.id);
    await supabase.from('project_task_phases').update({ phase_order: a.phase_order }).eq('id', b.id);
    load();
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{t.title}</div>
          <div className="text-xs text-muted-foreground">{t.note}</div>
        </div>
        {phases.length === 0 && (
          <Button type="button" size="sm" variant="outline" onClick={seed}>{t.seed}</Button>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-3">{t.empty}</div>
      ) : (
        <div className="space-y-1.5">
          {phases.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 bg-card border rounded px-2 py-1.5">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.phase_color }} />
              <span className="text-sm flex-1 truncate">{p.phase_name}{p.phase_name_ar ? ` / ${p.phase_name_ar}` : ''}</span>
              <Badge variant="outline" className="text-[10px]">{p.phase_key}</Badge>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === phases.length - 1}>
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => remove(p.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-5">
          <label className="text-xs">{t.name}</label>
          <Input value={newP.phase_name} onChange={(e) => setNewP({ ...newP, phase_name: e.target.value })} className="h-8" />
        </div>
        <div className="col-span-4">
          <label className="text-xs">{t.nameAr}</label>
          <Input value={newP.phase_name_ar} onChange={(e) => setNewP({ ...newP, phase_name_ar: e.target.value })} className="h-8" />
        </div>
        <div className="col-span-2">
          <label className="text-xs">{t.color}</label>
          <Input type="color" value={newP.phase_color} onChange={(e) => setNewP({ ...newP, phase_color: e.target.value })} className="h-8 p-1" />
        </div>
        <Button type="button" size="sm" onClick={add} className="col-span-1 h-8" disabled={!newP.phase_name.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
