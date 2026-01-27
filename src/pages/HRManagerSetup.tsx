import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "lucide-react";

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
}

const SortableHRItem = ({ manager, language, onToggleActive, onRemove }: SortableHRItemProps) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex justify-between items-center p-4 rounded-lg border ${
        manager.is_active ? 'bg-background' : 'bg-muted opacity-60'
      }`}
    >
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
  );
};

const HRManagerSetup = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<HRManager[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

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
      // Fetch HR managers
      const { data: managersData, error: managersError } = await supabase
        .from('hr_managers')
        .select('*')
        .order('admin_order', { ascending: true });

      if (managersError) throw managersError;

      // Fetch profiles for managers
      if (managersData && managersData.length > 0) {
        const userIds = managersData.map(m => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, user_name, email')
          .in('user_id', userIds);

        const managersWithProfiles = managersData.map(m => ({
          ...m,
          profiles: profilesData?.find(p => p.user_id === m.user_id)
        }));

        setManagers(managersWithProfiles);
      } else {
        setManagers([]);
      }

      // Fetch all active profiles for adding new managers
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

    // Check if already an HR manager
    if (managers.some(m => m.user_id === selectedUserId)) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'هذا المستخدم مدير HR بالفعل' : 'User is already an HR manager',
        variant: 'destructive',
      });
      return;
    }

    try {
      const maxOrder = managers.length > 0 
        ? Math.max(...managers.map(m => m.admin_order)) 
        : -1;

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
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('hr_managers')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' 
          ? `تم ${isActive ? 'تفعيل' : 'إلغاء تفعيل'} المدير`
          : `Manager ${isActive ? 'activated' : 'deactivated'}`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hr_managers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Recalculate order for remaining managers
      const remaining = managers.filter(m => m.id !== id);
      const updates = remaining.map((m, index) =>
        supabase
          .from('hr_managers')
          .update({ admin_order: index })
          .eq('id', m.id)
      );

      await Promise.all(updates);

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تمت إزالة مدير HR' : 'HR manager removed',
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message,
        variant: 'destructive',
      });
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
          supabase
            .from('hr_managers')
            .update({ admin_order: index })
            .eq('id', m.id)
        );

        await Promise.all(updates);

        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث الترتيب' : 'Order updated',
        });
      } catch (error: any) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: error.message,
          variant: 'destructive',
        });
        fetchData(); // Revert on error
      }
    }
  };

  // Filter out users who are already HR managers
  const availableProfiles = profiles.filter(
    p => !managers.some(m => m.user_id === p.user_id)
  );

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
              <Button 
                className="w-full" 
                onClick={handleAddManager}
                disabled={!selectedUserId}
              >
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
              ? 'اسحب وأفلت لإعادة ترتيب مستويات الاعتماد. المستوى 0 هو أول معتمد.'
              : 'Drag and drop to reorder approval levels. Level 0 is the first approver.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {managers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{language === 'ar' ? 'لا يوجد مديرو HR' : 'No HR managers configured'}</p>
              <p className="text-sm">
                {language === 'ar' 
                  ? 'أضف مستخدمين ليتمكنوا من اعتماد طلبات الموظفين'
                  : 'Add users to enable them to approve employee requests'
                }
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={managers.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {managers.map((manager) => (
                      <SortableHRItem
                        key={manager.id}
                        manager={manager}
                        language={language}
                        onToggleActive={handleToggleActive}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">
            {language === 'ar' ? 'كيف يعمل سير الاعتماد' : 'How the Approval Workflow Works'}
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              {language === 'ar' 
                ? 'الموظف يقدم الطلب'
                : 'Employee submits request'
              }
            </li>
            <li>
              {language === 'ar' 
                ? 'مدير القسم (المستوى 0 ثم 1...) يعتمد الطلب'
                : 'Department Manager (Level 0 then 1...) approves'
              }
            </li>
            <li>
              {language === 'ar' 
                ? 'مديرو HR (المستوى 0 ثم 1...) يعتمدون نهائياً'
                : 'HR Managers (Level 0 then 1...) give final approval'
              }
            </li>
            <li>
              {language === 'ar' 
                ? 'الطلب يُعتمد ويُنفذ (مثل خصم رصيد الإجازة)'
                : 'Request is approved and executed (e.g., vacation balance deducted)'
              }
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default HRManagerSetup;
