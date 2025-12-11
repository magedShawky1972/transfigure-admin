import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Plus, FolderKanban, GanttChart, Calendar as CalendarIcon, Trash2, Edit, CheckCircle2, Clock, AlertCircle, Circle, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from "@dnd-kit/core";

interface Project {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  departments?: { department_name: string };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  department_id: string;
  assigned_to: string;
  created_by: string;
  status: string;
  priority: string;
  deadline: string | null;
  ticket_id: string | null;
  created_at: string;
  projects?: { name: string } | null;
  departments?: { department_name: string };
  profiles?: { user_name: string };
}

interface Department {
  id: string;
  department_name: string;
}

interface Profile {
  user_id: string;
  user_name: string;
}

// Draggable Task Component
const DraggableTask = ({ task, children }: { task: Task; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task }
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1
  } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

// Droppable Column Component
const DroppableColumn = ({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-primary ring-offset-2")}>
      {children}
    </div>
  );
};

const ProjectsTasks = () => {
  const { language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'kanban' | 'gantt'>('kanban');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  // Dialog states
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Form states
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    department_id: '',
    status: 'active',
    start_date: null as Date | null,
    end_date: null as Date | null
  });
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    project_id: '',
    department_id: '',
    assigned_to: '',
    status: 'todo',
    priority: 'medium',
    deadline: null as Date | null
  });

  const translations = {
    ar: {
      pageTitle: 'المشاريع والمهام',
      projects: 'المشاريع',
      tasks: 'المهام',
      kanbanView: 'عرض كانبان',
      ganttView: 'مخطط جانت',
      addProject: 'إضافة مشروع',
      addTask: 'إضافة مهمة',
      projectName: 'اسم المشروع',
      taskTitle: 'عنوان المهمة',
      description: 'الوصف',
      department: 'القسم',
      assignedTo: 'مسند إلى',
      status: 'الحالة',
      priority: 'الأولوية',
      deadline: 'الموعد النهائي',
      startDate: 'تاريخ البداية',
      endDate: 'تاريخ الانتهاء',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      todo: 'للتنفيذ',
      inProgress: 'قيد التنفيذ',
      review: 'مراجعة',
      done: 'مكتمل',
      active: 'نشط',
      completed: 'مكتمل',
      onHold: 'معلق',
      cancelled: 'ملغى',
      low: 'منخفضة',
      medium: 'متوسطة',
      high: 'عالية',
      urgent: 'عاجلة',
      noProject: 'بدون مشروع',
      selectDepartment: 'اختر القسم',
      selectProject: 'اختر المشروع',
      selectUser: 'اختر المستخدم',
      selectDate: 'اختر التاريخ',
      fromTicket: 'من تذكرة',
      noTasks: 'لا توجد مهام'
    },
    en: {
      pageTitle: 'Projects & Tasks',
      projects: 'Projects',
      tasks: 'Tasks',
      kanbanView: 'Kanban View',
      ganttView: 'Gantt Chart',
      addProject: 'Add Project',
      addTask: 'Add Task',
      projectName: 'Project Name',
      taskTitle: 'Task Title',
      description: 'Description',
      department: 'Department',
      assignedTo: 'Assigned To',
      status: 'Status',
      priority: 'Priority',
      deadline: 'Deadline',
      startDate: 'Start Date',
      endDate: 'End Date',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      todo: 'To Do',
      inProgress: 'In Progress',
      review: 'Review',
      done: 'Done',
      active: 'Active',
      completed: 'Completed',
      onHold: 'On Hold',
      cancelled: 'Cancelled',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
      noProject: 'No Project',
      selectDepartment: 'Select Department',
      selectProject: 'Select Project',
      selectUser: 'Select User',
      selectDate: 'Select Date',
      fromTicket: 'From Ticket',
      noTasks: 'No tasks'
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const statusColumns = [
    { key: 'todo', label: t.todo, icon: Circle, color: 'bg-muted' },
    { key: 'in_progress', label: t.inProgress, icon: Clock, color: 'bg-blue-500/20' },
    { key: 'review', label: t.review, icon: AlertCircle, color: 'bg-yellow-500/20' },
    { key: 'done', label: t.done, icon: CheckCircle2, color: 'bg-green-500/20' }
  ];

  const priorityColors: Record<string, string> = {
    low: 'bg-slate-500',
    medium: 'bg-blue-500',
    high: 'bg-orange-500',
    urgent: 'bg-red-500'
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const [projectsRes, tasksRes, depsRes, usersRes] = await Promise.all([
        supabase.from('projects').select('*, departments(department_name)').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*, projects(name), departments(department_name)').order('created_at', { ascending: false }),
        supabase.from('departments').select('id, department_name').eq('is_active', true),
        supabase.from('profiles').select('user_id, user_name').eq('is_active', true)
      ]);

      if (projectsRes.data) setProjects(projectsRes.data);
      if (tasksRes.data) {
        // Map tasks with user names from profiles
        const tasksWithProfiles = tasksRes.data.map(task => ({
          ...task,
          profiles: usersRes.data?.find(u => u.user_id === task.assigned_to) || null
        }));
        setTasks(tasksWithProfiles as Task[]);
      }
      if (depsRes.data) setDepartments(depsRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveProject = async () => {
    if (!projectForm.name || !projectForm.department_id) {
      toast({ title: language === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        name: projectForm.name,
        description: projectForm.description || null,
        department_id: projectForm.department_id,
        status: projectForm.status,
        start_date: projectForm.start_date ? format(projectForm.start_date, 'yyyy-MM-dd') : null,
        end_date: projectForm.end_date ? format(projectForm.end_date, 'yyyy-MM-dd') : null,
        created_by: currentUserId!
      };

      if (editingProject) {
        await supabase.from('projects').update(payload).eq('id', editingProject.id);
      } else {
        await supabase.from('projects').insert(payload);
      }

      toast({ title: language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully' });
      setProjectDialogOpen(false);
      resetProjectForm();
      fetchData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !taskForm.department_id || !taskForm.assigned_to) {
      toast({ title: language === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        title: taskForm.title,
        description: taskForm.description || null,
        project_id: taskForm.project_id || null,
        department_id: taskForm.department_id,
        assigned_to: taskForm.assigned_to,
        status: taskForm.status,
        priority: taskForm.priority,
        deadline: taskForm.deadline ? taskForm.deadline.toISOString() : null,
        created_by: currentUserId!
      };

      if (editingTask) {
        await supabase.from('tasks').update(payload).eq('id', editingTask.id);
      } else {
        await supabase.from('tasks').insert(payload);
      }

      toast({ title: language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully' });
      setTaskDialogOpen(false);
      resetTaskForm();
      fetchData();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await supabase.from('projects').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    fetchData();
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    fetchData();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;
    
    const taskId = active.id as string;
    const newStatus = over.id as string;
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== newStatus) {
      // Optimistically update UI
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    }
  };

  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  const resetProjectForm = () => {
    setProjectForm({ name: '', description: '', department_id: '', status: 'active', start_date: null, end_date: null });
    setEditingProject(null);
  };

  const resetTaskForm = () => {
    setTaskForm({ title: '', description: '', project_id: '', department_id: '', assigned_to: '', status: 'todo', priority: 'medium', deadline: null });
    setEditingTask(null);
  };

  const openEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      description: project.description || '',
      department_id: project.department_id,
      status: project.status,
      start_date: project.start_date ? new Date(project.start_date) : null,
      end_date: project.end_date ? new Date(project.end_date) : null
    });
    setProjectDialogOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id || '',
      department_id: task.department_id,
      assigned_to: task.assigned_to,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? new Date(task.deadline) : null
    });
    setTaskDialogOpen(true);
  };

  const getPriorityLabel = (priority: string) => {
    const labels: Record<string, string> = { low: t.low, medium: t.medium, high: t.high, urgent: t.urgent };
    return labels[priority] || priority;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = { todo: t.todo, in_progress: t.inProgress, review: t.review, done: t.done };
    return labels[status] || status;
  };

  // Gantt Chart Component
  const GanttChartView = () => {
    const tasksWithDeadline = tasks.filter(t => t.deadline);
    if (tasksWithDeadline.length === 0) {
      return <div className="text-center py-8 text-muted-foreground">{t.noTasks}</div>;
    }

    const minDate = new Date(Math.min(...tasksWithDeadline.map(t => new Date(t.created_at).getTime())));
    const maxDate = new Date(Math.max(...tasksWithDeadline.map(t => new Date(t.deadline!).getTime())));
    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header with dates */}
          <div className="flex border-b pb-2 mb-4">
            <div className="w-48 shrink-0 font-medium">{t.tasks}</div>
            <div className="flex-1 flex">
              {Array.from({ length: Math.min(totalDays, 30) }).map((_, i) => {
                const date = new Date(minDate);
                date.setDate(date.getDate() + i);
                return (
                  <div key={i} className="flex-1 text-center text-xs text-muted-foreground min-w-[30px]">
                    {format(date, 'dd')}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Tasks */}
          {tasksWithDeadline.map(task => {
            const taskStart = new Date(task.created_at);
            const taskEnd = new Date(task.deadline!);
            const startOffset = Math.max(0, Math.ceil((taskStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
            const duration = Math.ceil((taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const widthPercent = (duration / Math.min(totalDays, 30)) * 100;
            const leftPercent = (startOffset / Math.min(totalDays, 30)) * 100;

            return (
              <div key={task.id} className="flex items-center mb-2">
                <div className="w-48 shrink-0 text-sm truncate pr-2">{task.title}</div>
                <div className="flex-1 relative h-6">
                  <div
                    className={cn("absolute h-full rounded", priorityColors[task.priority])}
                    style={{ left: `${leftPercent}%`, width: `${Math.min(widthPercent, 100 - leftPercent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className={`container mx-auto p-4 md:p-6 ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{t.pageTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <Dialog open={projectDialogOpen} onOpenChange={(o) => { setProjectDialogOpen(o); if (!o) resetProjectForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-1" />{t.addProject}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingProject ? t.edit : t.addProject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t.projectName} *</label>
                  <Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t.description}</label>
                  <Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t.department} *</label>
                  <Select value={projectForm.department_id} onValueChange={(v) => setProjectForm({ ...projectForm, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t.selectDepartment} /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">{t.startDate}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {projectForm.start_date ? format(projectForm.start_date, 'PPP', { locale: language === 'ar' ? ar : undefined }) : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={projectForm.start_date || undefined} onSelect={(d) => setProjectForm({ ...projectForm, start_date: d || null })} /></PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t.endDate}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {projectForm.end_date ? format(projectForm.end_date, 'PPP', { locale: language === 'ar' ? ar : undefined }) : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={projectForm.end_date || undefined} onSelect={(d) => setProjectForm({ ...projectForm, end_date: d || null })} /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>{t.cancel}</Button>
                  <Button onClick={handleSaveProject}>{t.save}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={taskDialogOpen} onOpenChange={(o) => { setTaskDialogOpen(o); if (!o) resetTaskForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />{t.addTask}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTask ? t.edit : t.addTask}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t.taskTitle} *</label>
                  <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">{t.description}</label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">{t.department} *</label>
                    <Select value={taskForm.department_id} onValueChange={(v) => setTaskForm({ ...taskForm, department_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t.selectDepartment} /></SelectTrigger>
                      <SelectContent>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t.projects}</label>
                    <Select value={taskForm.project_id || 'none'} onValueChange={(v) => setTaskForm({ ...taskForm, project_id: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder={t.selectProject} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t.noProject}</SelectItem>
                        {projects.filter(p => !taskForm.department_id || p.department_id === taskForm.department_id).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t.assignedTo} *</label>
                  <Select value={taskForm.assigned_to} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: v })}>
                    <SelectTrigger><SelectValue placeholder={t.selectUser} /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">{t.priority}</label>
                    <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t.low}</SelectItem>
                        <SelectItem value="medium">{t.medium}</SelectItem>
                        <SelectItem value="high">{t.high}</SelectItem>
                        <SelectItem value="urgent">{t.urgent}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t.deadline}</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          {taskForm.deadline ? format(taskForm.deadline, 'PPP', { locale: language === 'ar' ? ar : undefined }) : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={taskForm.deadline || undefined} onSelect={(d) => setTaskForm({ ...taskForm, deadline: d || null })} /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>{t.cancel}</Button>
                  <Button onClick={handleSaveTask}>{t.save}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Projects Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5" />{t.projects}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <Card key={project.id} className="relative">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">{project.departments?.department_name}</p>
                      {project.description && <p className="text-sm mt-1 line-clamp-2">{project.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditProject(project)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status === 'active' ? t.active : project.status === 'completed' ? t.completed : project.status === 'on_hold' ? t.onHold : t.cancelled}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {tasks.filter(t => t.project_id === project.id).length} {t.tasks}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tasks Section with Views */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">{t.tasks}</CardTitle>
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'kanban' | 'gantt')}>
              <TabsList>
                <TabsTrigger value="kanban"><FolderKanban className="h-4 w-4 mr-1" />{t.kanbanView}</TabsTrigger>
                <TabsTrigger value="gantt"><GanttChart className="h-4 w-4 mr-1" />{t.ganttView}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {activeView === 'kanban' ? (
            <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statusColumns.map(column => (
                  <DroppableColumn key={column.key} id={column.key} className={cn("rounded-lg p-4 min-h-[200px] transition-all", column.color)}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <column.icon className="h-4 w-4" />
                      {column.label}
                      <Badge variant="outline" className="ml-auto">{tasks.filter(t => t.status === column.key).length}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {tasks.filter(t => t.status === column.key).map(task => (
                        <DraggableTask key={task.id} task={task}>
                          <Card className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  <h4 className="font-medium text-sm">{task.title}</h4>
                                </div>
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTask(task)}><Edit className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTask(task.id)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                <Badge className={cn("text-xs text-white", priorityColors[task.priority])}>{getPriorityLabel(task.priority)}</Badge>
                                {task.ticket_id && <Badge variant="outline" className="text-xs">{t.fromTicket}</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {task.profiles?.user_name && <p>{t.assignedTo}: {task.profiles.user_name}</p>}
                                {task.deadline && <p>{t.deadline}: {format(new Date(task.deadline), 'PP', { locale: language === 'ar' ? ar : undefined })}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        </DraggableTask>
                      ))}
                    </div>
                  </DroppableColumn>
                ))}
              </div>
              <DragOverlay>
                {activeTask && (
                  <Card className="cursor-grabbing shadow-xl rotate-3">
                    <CardContent className="p-3">
                      <h4 className="font-medium text-sm">{activeTask.title}</h4>
                      <Badge className={cn("text-xs text-white mt-2", priorityColors[activeTask.priority])}>{getPriorityLabel(activeTask.priority)}</Badge>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            <GanttChartView />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectsTasks;
