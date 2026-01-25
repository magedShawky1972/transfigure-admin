import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Trash2, Search, FolderKanban, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Department {
  id: string;
  department_name: string;
}

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  profiles?: { user_name: string | null };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  departments?: { department_name: string };
  project_members?: ProjectMember[];
}

const ProjectSetup = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === 'ar';

  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [searchName, setSearchName] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    department_id: "",
    status: "active",
    start_date: "",
    end_date: ""
  });

  const t = {
    title: isRTL ? "إعداد المشاريع" : "Project Setup",
    subtitle: isRTL ? "إدارة وتعديل المشاريع" : "Manage and edit projects",
    searchPlaceholder: isRTL ? "بحث بالاسم..." : "Search by name...",
    allDepartments: isRTL ? "كل الأقسام" : "All Departments",
    allStatuses: isRTL ? "كل الحالات" : "All Statuses",
    projectName: isRTL ? "اسم المشروع" : "Project Name",
    department: isRTL ? "القسم" : "Department",
    status: isRTL ? "الحالة" : "Status",
    startDate: isRTL ? "تاريخ البداية" : "Start Date",
    endDate: isRTL ? "تاريخ النهاية" : "End Date",
    manager: isRTL ? "المدير" : "Manager",
    members: isRTL ? "الأعضاء" : "Members",
    actions: isRTL ? "الإجراءات" : "Actions",
    edit: isRTL ? "تعديل" : "Edit",
    delete: isRTL ? "حذف" : "Delete",
    editProject: isRTL ? "تعديل المشروع" : "Edit Project",
    description: isRTL ? "الوصف" : "Description",
    selectDepartment: isRTL ? "اختر القسم" : "Select Department",
    selectStatus: isRTL ? "اختر الحالة" : "Select Status",
    cancel: isRTL ? "إلغاء" : "Cancel",
    save: isRTL ? "حفظ" : "Save",
    saving: isRTL ? "جاري الحفظ..." : "Saving...",
    noData: isRTL ? "لا توجد مشاريع" : "No projects found",
    deleteConfirm: isRTL ? "هل أنت متأكد من حذف هذا المشروع؟" : "Are you sure you want to delete this project?",
    deleteWarning: isRTL ? "لا يمكن التراجع عن هذا الإجراء" : "This action cannot be undone",
    cannotDelete: isRTL ? "لا يمكن حذف المشروع" : "Cannot delete project",
    hasTasks: isRTL ? "يحتوي المشروع على مهام" : "Project has tasks",
    deleted: isRTL ? "تم حذف المشروع" : "Project deleted",
    updated: isRTL ? "تم تحديث المشروع" : "Project updated",
    error: isRTL ? "حدث خطأ" : "Error occurred",
    fillRequired: isRTL ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields",
    active: isRTL ? "نشط" : "Active",
    completed: isRTL ? "مكتمل" : "Completed",
    on_hold: isRTL ? "معلق" : "On Hold",
    cancelled: isRTL ? "ملغي" : "Cancelled",
    createdAt: isRTL ? "تاريخ الإنشاء" : "Created At",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-600 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    on_hold: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    cancelled: "bg-red-500/10 text-red-600 border-red-500/20"
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: t.active,
      completed: t.completed,
      on_hold: t.on_hold,
      cancelled: t.cancelled
    };
    return labels[status] || status;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, departmentsRes] = await Promise.all([
        supabase
          .from('projects')
          .select(`
            id, name, description, department_id, status, start_date, end_date, created_at,
            departments(department_name),
            project_members(id, user_id, role)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('departments').select('id, department_name').eq('is_active', true).order('department_name')
      ]);

      if (projectsRes.data) {
        // Fetch member profiles separately
        const projectsWithProfiles = await Promise.all(
          projectsRes.data.map(async (project) => {
            if (project.project_members && project.project_members.length > 0) {
              const userIds = project.project_members.map((m: { user_id: string }) => m.user_id);
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, user_name')
                .in('id', userIds);
              
              const membersWithProfiles = project.project_members.map((member: { id: string; user_id: string; role: string }) => ({
                ...member,
                profiles: profiles?.find(p => p.id === member.user_id) || { user_name: null }
              }));
              
              return { ...project, project_members: membersWithProfiles };
            }
            return project;
          })
        );
        setProjects(projectsWithProfiles as Project[]);
      }
      if (departmentsRes.data) setDepartments(departmentsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || "",
      department_id: project.department_id,
      status: project.status,
      start_date: project.start_date || "",
      end_date: project.end_date || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.department_id) {
      toast({ title: t.fillRequired, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        department_id: formData.department_id,
        status: formData.status,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null
      };

      await supabase.from('projects').update(payload).eq('id', editingProject!.id);

      toast({ title: t.updated });
      setDialogOpen(false);
      setEditingProject(null);
      fetchData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({ title: t.error, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    try {
      // Check if project has tasks
      const { data: projectTasks } = await supabase.from('tasks').select('id').eq('project_id', projectId);
      if (projectTasks && projectTasks.length > 0) {
        toast({ 
          title: t.cannotDelete, 
          description: t.hasTasks,
          variant: 'destructive' 
        });
        return;
      }
      
      // Delete project members first
      await supabase.from('project_members').delete().eq('project_id', projectId);
      
      // Delete project
      await supabase.from('projects').delete().eq('id', projectId);
      
      toast({ title: t.deleted });
      fetchData();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ title: t.error, variant: 'destructive' });
    }
  };

  const getManager = (project: Project) => {
    const manager = project.project_members?.find(m => m.role === 'manager');
    return manager?.profiles?.user_name || '-';
  };

  const getMemberCount = (project: Project) => {
    return project.project_members?.filter(m => m.role === 'member').length || 0;
  };

  const filteredProjects = projects.filter(project => {
    const matchesName = project.name.toLowerCase().includes(searchName.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || project.department_id === filterDepartment;
    const matchesStatus = filterStatus === "all" || project.status === filterStatus;
    return matchesName && matchesDepartment && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`container mx-auto p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <FolderKanban className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>{t.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t.allDepartments} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allDepartments}</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.allStatuses} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStatuses}</SelectItem>
                <SelectItem value="active">{t.active}</SelectItem>
                <SelectItem value="completed">{t.completed}</SelectItem>
                <SelectItem value="on_hold">{t.on_hold}</SelectItem>
                <SelectItem value="cancelled">{t.cancelled}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.projectName}</TableHead>
                  <TableHead>{t.department}</TableHead>
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.manager}</TableHead>
                  <TableHead>{t.members}</TableHead>
                  <TableHead>{t.startDate}</TableHead>
                  <TableHead>{t.endDate}</TableHead>
                  <TableHead>{t.createdAt}</TableHead>
                  <TableHead className="text-center">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>{project.departments?.department_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[project.status]}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getManager(project)}</TableCell>
                      <TableCell>{getMemberCount(project)}</TableCell>
                      <TableCell>
                        {project.start_date ? format(new Date(project.start_date), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell>
                        {project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(project.created_at), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(project)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t.deleteConfirm}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t.deleteWarning}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(project.id)}>
                                  {t.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.editProject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.projectName} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.department} *</Label>
              <Select 
                value={formData.department_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectDepartment} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.status}</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectStatus} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t.active}</SelectItem>
                  <SelectItem value="completed">{t.completed}</SelectItem>
                  <SelectItem value="on_hold">{t.on_hold}</SelectItem>
                  <SelectItem value="cancelled">{t.cancelled}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.startDate}</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.endDate}</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t.saving}
                </>
              ) : (
                t.save
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectSetup;
