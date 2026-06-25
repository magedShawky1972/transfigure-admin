import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Plus,
  Trash2,
  GripVertical,
  Users,
  Loader2,
  Shield,
  Building2,
} from "lucide-react";

interface BusinessUnit {
  id: string;
  name: string;
  name_ar?: string | null;
}

interface HRManager {
  id: string;
  user_id: string;
  admin_order: number;
  is_active: boolean;
  created_at: string;
  profiles?: {
    user_name: string;
    email: string;
  };
  business_units?: BusinessUnit[];
}

interface Profile {
  user_id: string;
  user_name: string;
  email: string;
}

interface SortableHRItemProps {
  manager: HRManager;
  language: string;
  onToggleActive: (id: string, isActive: boolean) => void;
  onRemove: (id: string) => void;
  onManageUnits: (manager: HRManager) => void;
}

const SortableHRItem = ({ manager, language, onToggleActive, onRemove, onManageUnits }: SortableHRItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: manager.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const unitLabel = (u: BusinessUnit) => (language === 'ar' ? (u.name_ar || u.name) : u.name);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 p-4 rounded-lg border ${
        manager.is_active ? 'bg-background' : 'bg-muted opacity-60'
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            className="cursor-grab active:cursor-grabbing touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </button>
          <Badge variant="outline" className="font-mono">
            {language === 'ar' ? 'مستوى' : 'Level'} {manager.admin_order}
          </Badge>
          <div>
            <p className="font-medium">{manager.profiles?.user_name || 'Unknown'}</p>
            <p className="text-sm text-muted-foreground">{manager.profiles?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => onManageUnits(manager)}>
            <Building2 className="h-4 w-4 mr-1" />
            {language === 'ar' ? 'وحدات العمل' : 'Business Units'}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {language === 'ar' ? 'نشط' : 'Active'}
            </span>
            <Switch
              checked={manager.is_active}
              onCheckedChange={(checked) => onToggleActive(manager.id, checked)}
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => onRemove(manager.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 pl-12">
        {(!manager.business_units || manager.business_units.length === 0) ? (
          <Badge variant="secondary" className="text-xs">
            {language === 'ar' ? 'جميع الوحدات (بدون قيود)' : 'All Units (no restriction)'}
          </Badge>
        ) : (
          manager.business_units.map(u => (
            <Badge key={u.id} variant="default" className="text-xs">
              {unitLabel(u)}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
};

const HRManagerSetup = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<HRManager[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  // Business unit assignment dialog
  const [unitsDialogOpen, setUnitsDialogOpen] = useState(false);
  const [unitsTarget, setUnitsTarget] = useState<HRManager | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [savingUnits, setSavingUnits] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [managersRes, unitsRes] = await Promise.all([
        supabase.from('hr_managers').select('*').order('admin_order', { ascending: true }),
        supabase.from('business_units').select('id, name, name_ar').order('name'),
      ]);

      if (managersRes.error) throw managersRes.error;
      setBusinessUnits(unitsRes.data || []);

      const managersData = managersRes.data || [];

      if (managersData.length > 0) {
        const userIds = managersData.map(m => m.user_id);
        const managerIds = managersData.map(m => m.id);
        const [{ data: profilesData }, { data: linksData }] = await Promise.all([
          supabase.from('profiles').select('user_id, user_name, email').in('user_id', userIds),
          supabase.from('hr_manager_business_units').select('hr_manager_id, business_unit_id').in('hr_manager_id', managerIds),
        ]);

        const unitMap = new Map((unitsRes.data || []).map(u => [u.id, u]));
        const linksByManager = new Map<string, BusinessUnit[]>();
        (linksData || []).forEach((l: any) => {
          const unit = unitMap.get(l.business_unit_id);
          if (!unit) return;
          if (!linksByManager.has(l.hr_manager_id)) linksByManager.set(l.hr_manager_id, []);
          linksByManager.get(l.hr_manager_id)!.push(unit);
        });

        const managersWithProfiles = managersData.map(m => ({
          ...m,
          profiles: profilesData?.find(p => p.user_id === m.user_id),
          business_units: linksByManager.get(m.id) || [],
        }));
        setManagers(managersWithProfiles);
      } else {
        setManagers([]);
      }

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, user_name, email')
        .eq('is_active', true)
        .order('user_name');
      setProfiles(allProfiles || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddManager = async () => {
    if (!selectedUserId) return;
    if (managers.some(m => m.user_id === selectedUserId)) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'هذا المستخدم مدير HR بالفعل' : 'User is already an HR manager',
        variant: 'destructive',
      });
      return;
    }

    try {
      const maxOrder = managers.length > 0 ? Math.max(...managers.map(m => m.admin_order)) : -1;
      const { error } = await supabase
        .from('hr_managers')
        .insert({
          user_id: selectedUserId,
          admin_order: maxOrder + 1,
          is_active: true,
        });
      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تمت إضافة مدير HR بنجاح' : 'HR manager added successfully',
      });

      setDialogOpen(false);
      setSelectedUserId('');
      fetchData();
    } catch (error: any) {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('hr_managers').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar'
          ? `تم ${isActive ? 'تفعيل' : 'إلغاء تفعيل'} المدير`
          : `Manager ${isActive ? 'activated' : 'deactivated'}`,
      });
      fetchData();
    } catch (error: any) {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase.from('hr_managers').delete().eq('id', id);
      if (error) throw error;
      const remaining = managers.filter(m => m.id !== id);
      const updates = remaining.map((m, index) =>
        supabase.from('hr_managers').update({ admin_order: index }).eq('id', m.id)
      );
      await Promise.all(updates);
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تمت إزالة مدير HR' : 'HR manager removed',
      });
      fetchData();
    } catch (error: any) {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = managers.findIndex(m => m.id === active.id);
      const newIndex = managers.findIndex(m => m.id === over.id);
      const reordered = arrayMove(managers, oldIndex, newIndex);
      setManagers(reordered);
      try {
        const updates = reordered.map((m, index) =>
          supabase.from('hr_managers').update({ admin_order: index }).eq('id', m.id)
        );
        await Promise.all(updates);
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث الترتيب' : 'Order updated',
        });
      } catch (error: any) {
        toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
        fetchData();
      }
    }
  };

  const openUnitsDialog = (manager: HRManager) => {
    setUnitsTarget(manager);
    setSelectedUnitIds(new Set((manager.business_units || []).map(u => u.id)));
    setUnitsDialogOpen(true);
  };

  const handleSaveUnits = async () => {
    if (!unitsTarget) return;
    setSavingUnits(true);
    try {
      // Replace all links
      await supabase.from('hr_manager_business_units').delete().eq('hr_manager_id', unitsTarget.id);
      const toInsert = Array.from(selectedUnitIds).map(business_unit_id => ({
        hr_manager_id: unitsTarget.id,
        business_unit_id,
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('hr_manager_business_units').insert(toInsert);
        if (error) throw error;
      }
      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم حفظ وحدات العمل' : 'Business units saved',
      });
      setUnitsDialogOpen(false);
      setUnitsTarget(null);
      fetchData();
    } catch (error: any) {
      toast({ title: language === 'ar' ? 'خطأ' : 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingUnits(false);
    }
  };

  const toggleUnit = (unitId: string, checked: boolean) => {
    setSelectedUnitIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(unitId);
      else next.delete(unitId);
      return next;
    });
  };

  const availableProfiles = profiles.filter(p => !managers.some(m => m.user_id === p.user_id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {language === 'ar' ? 'إعداد مديري الموارد البشرية' : 'HR Manager Setup'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar'
              ? 'إدارة المستخدمين المخولين باعتماد طلبات الموظفين على مستوى HR'
              : 'Manage users authorized to approve employee requests at HR level'
            }
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'إضافة مدير HR' : 'Add HR Manager'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'إضافة مدير موارد بشرية' : 'Add HR Manager'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر مستخدم' : 'Select user'} />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.user_name} ({profile.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={handleAddManager} disabled={!selectedUserId}>
                {language === 'ar' ? 'إضافة' : 'Add'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {language === 'ar' ? 'مديرو الموارد البشرية' : 'HR Managers'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'اسحب وأفلت لإعادة ترتيب مستويات الاعتماد. اربط كل مدير بوحدات العمل لتقييد رؤية الموظفين.'
              : 'Drag and drop to reorder approval levels. Link each manager to Business Units to restrict employee visibility.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {managers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{language === 'ar' ? 'لا يوجد مديرو HR' : 'No HR managers configured'}</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={managers.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {managers.map((manager) => (
                      <SortableHRItem
                        key={manager.id}
                        manager={manager}
                        language={language}
                        onToggleActive={handleToggleActive}
                        onRemove={handleRemove}
                        onManageUnits={openUnitsDialog}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Business Units Dialog */}
      <Dialog open={unitsDialogOpen} onOpenChange={setUnitsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {language === 'ar' ? 'وحدات العمل المخصصة' : 'Assigned Business Units'}
            </DialogTitle>
            <DialogDescription>
              {unitsTarget?.profiles?.user_name} —{' '}
              {language === 'ar'
                ? 'اختر الوحدات. إذا لم تختر أيًا منها، يرى المدير جميع الموظفين.'
                : 'Select units. If none selected, the manager sees all employees.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] py-2">
            <div className="space-y-2">
              {businessUnits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {language === 'ar' ? 'لا توجد وحدات عمل مُعرَّفة' : 'No business units defined'}
                </p>
              ) : (
                businessUnits.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 p-2 rounded border hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUnitIds.has(u.id)}
                      onCheckedChange={(c) => toggleUnit(u.id, !!c)}
                    />
                    <span className="text-sm">
                      {language === 'ar' ? (u.name_ar || u.name) : u.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitsDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveUnits} disabled={savingUnits}>
              {savingUnits && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">
            {language === 'ar' ? 'كيف يعمل سير الاعتماد' : 'How the Approval Workflow Works'}
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>{language === 'ar' ? 'الموظف يقدم الطلب' : 'Employee submits request'}</li>
            <li>{language === 'ar' ? 'مدير القسم (المستوى 0 ثم 1...) يعتمد الطلب' : 'Department Manager (Level 0 then 1...) approves'}</li>
            <li>{language === 'ar' ? 'مديرو HR (المستوى 0 ثم 1...) يعتمدون نهائياً' : 'HR Managers (Level 0 then 1...) give final approval'}</li>
            <li>{language === 'ar' ? 'يرى كل مدير HR فقط الموظفين التابعين لوحدات العمل المخصصة له' : 'Each HR Manager sees only employees belonging to their assigned Business Units'}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default HRManagerSetup;
