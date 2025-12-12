import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Settings2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskPhase {
  id: string;
  department_id: string;
  phase_key: string;
  phase_name: string;
  phase_name_ar: string | null;
  phase_order: number;
  phase_color: string;
  is_active: boolean;
}

interface SortablePhaseProps {
  phase: TaskPhase;
  language: string;
  onDelete: (id: string) => void;
}

const SortablePhase = ({ phase, language, onDelete }: SortablePhaseProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-muted rounded-lg"
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <div
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: phase.phase_color }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {language === 'ar' ? phase.phase_name_ar || phase.phase_name : phase.phase_name}
        </p>
        <p className="text-xs text-muted-foreground">{phase.phase_key}</p>
      </div>
      <Badge variant="outline" className="shrink-0">#{phase.phase_order + 1}</Badge>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(phase.id)}
        className="shrink-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

interface Props {
  departmentId: string;
  departmentName: string;
}

const DepartmentTaskPhases = ({ departmentId, departmentName }: Props) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [phases, setPhases] = useState<TaskPhase[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPhase, setNewPhase] = useState({
    phase_key: '',
    phase_name: '',
    phase_name_ar: '',
    phase_color: '#3B82F6',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchPhases = async () => {
    try {
      const { data, error } = await supabase
        .from("department_task_phases")
        .select("*")
        .eq("department_id", departmentId)
        .order("phase_order", { ascending: true });

      if (error) throw error;
      setPhases(data || []);
    } catch (error: any) {
      console.error("Error fetching phases:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPhases();
    }
  }, [open, departmentId]);

  const handleAddPhase = async () => {
    if (!newPhase.phase_key || !newPhase.phase_name) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields',
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.phase_order)) : -1;

      const { error } = await supabase
        .from("department_task_phases")
        .insert({
          department_id: departmentId,
          phase_key: newPhase.phase_key.toLowerCase().replace(/\s+/g, '_'),
          phase_name: newPhase.phase_name,
          phase_name_ar: newPhase.phase_name_ar || null,
          phase_color: newPhase.phase_color,
          phase_order: maxOrder + 1,
        });

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تمت إضافة المرحلة بنجاح' : 'Phase added successfully',
      });

      setNewPhase({ phase_key: '', phase_name: '', phase_name_ar: '', phase_color: '#3B82F6' });
      fetchPhases();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhase = async (phaseId: string) => {
    try {
      const { error } = await supabase
        .from("department_task_phases")
        .delete()
        .eq("id", phaseId);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم' : 'Success',
        description: language === 'ar' ? 'تم حذف المرحلة' : 'Phase deleted',
      });

      fetchPhases();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = phases.findIndex(p => p.id === active.id);
      const newIndex = phases.findIndex(p => p.id === over.id);

      const reorderedPhases = arrayMove(phases, oldIndex, newIndex);
      setPhases(reorderedPhases);

      try {
        const updates = reorderedPhases.map((phase, index) =>
          supabase
            .from('department_task_phases')
            .update({ phase_order: index })
            .eq('id', phase.id)
        );

        await Promise.all(updates);

        toast({
          title: language === 'ar' ? 'تم' : 'Success',
          description: language === 'ar' ? 'تم تحديث ترتيب المراحل' : 'Phase order updated',
        });
      } catch (error: any) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: error.message,
          variant: "destructive",
        });
        fetchPhases();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'مراحل المهام' : 'Task Phases'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? `مراحل المهام - ${departmentName}` : `Task Phases - ${departmentName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new phase form */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <h4 className="font-medium text-sm">
              {language === 'ar' ? 'إضافة مرحلة جديدة' : 'Add New Phase'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'المفتاح (بالإنجليزية)' : 'Key (English)'}
                </label>
                <Input
                  value={newPhase.phase_key}
                  onChange={(e) => setNewPhase({ ...newPhase, phase_key: e.target.value })}
                  placeholder="e.g. dev_testing"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'اللون' : 'Color'}
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="color"
                    value={newPhase.phase_color}
                    onChange={(e) => setNewPhase({ ...newPhase, phase_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={newPhase.phase_color}
                    onChange={(e) => setNewPhase({ ...newPhase, phase_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}
                </label>
                <Input
                  value={newPhase.phase_name}
                  onChange={(e) => setNewPhase({ ...newPhase, phase_name: e.target.value })}
                  placeholder="e.g. Dev Testing"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}
                </label>
                <Input
                  value={newPhase.phase_name_ar}
                  onChange={(e) => setNewPhase({ ...newPhase, phase_name_ar: e.target.value })}
                  placeholder="اختبار التطوير"
                  className="mt-1"
                  dir="rtl"
                />
              </div>
            </div>
            <Button onClick={handleAddPhase} disabled={loading} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {loading ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : (language === 'ar' ? 'إضافة' : 'Add Phase')}
            </Button>
          </div>

          {/* Existing phases */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">
              {language === 'ar' ? 'المراحل الحالية' : 'Current Phases'}
              <span className="text-muted-foreground font-normal"> ({phases.length})</span>
            </h4>
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {language === 'ar' ? 'لا توجد مراحل' : 'No phases configured'}
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={phases.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {phases.map((phase) => (
                      <SortablePhase
                        key={phase.id}
                        phase={phase}
                        language={language}
                        onDelete={handleDeletePhase}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentTaskPhases;
