import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Plus, FolderKanban, Calendar as CalendarIcon, Trash2, Edit, 
  GripVertical, Link, FileText, Video, X, Upload, Loader2, Play, Square, 
  Timer, History, Search, User, Flag, MoreHorizontal, CheckCircle2
} from "lucide-react";
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

interface FileAttachment {
  url: string;
  name: string;
  type: string;
}

interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

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
  start_time: string | null;
  end_time: string | null;
  ticket_id: string | null;
  created_at: string;
  external_links?: string[] | null;
  file_attachments?: FileAttachment[] | null;
  video_attachments?: FileAttachment[] | null;
  projects?: { name: string } | null;
  departments?: { department_name: string };
  profiles?: { user_name: string };
  time_entries?: TimeEntry[];
  total_time_minutes?: number;
  active_timer?: TimeEntry | null;
}

interface Department {
  id: string;
  department_name: string;
}

interface Profile {
  user_id: string;
  user_name: string;
  default_department_id: string | null;
  avatar_url?: string | null;
  departmentMemberships?: string[]; // Additional department IDs from department_members
}

interface UserDepartmentAccess {
  adminDepartments: string[];
  memberDepartments: string[];
  isSystemAdmin: boolean;
}

// Draggable Task Component
const DraggableTask = ({ task, children }: { task: Task; children: (props: { listeners: any }) => React.ReactNode }) => {
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
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners })}
    </div>
  );
};

// Droppable Column Component
const DroppableColumn = ({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-primary ring-offset-2 bg-primary/5")}>
      {children}
    </div>
  );
};

const ProjectsTasks = () => {
  const { language } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [accessibleDepartments, setAccessibleDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [taskPhases, setTaskPhases] = useState<TaskPhase[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userAccess, setUserAccess] = useState<UserDepartmentAccess>({ adminDepartments: [], memberDepartments: [], isSystemAdmin: false });
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runningTimers, setRunningTimers] = useState<Record<string, number>>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  
  // Dialog states
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [timeEntriesDialogOpen, setTimeEntriesDialogOpen] = useState(false);
  const [selectedTaskForTimeEntries, setSelectedTaskForTimeEntries] = useState<Task | null>(null);
  
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
    deadline: null as Date | null,
    start_time: '',
    end_time: '',
    external_links: [] as string[],
    file_attachments: [] as FileAttachment[],
    video_attachments: [] as FileAttachment[]
  });
  const [newLink, setNewLink] = useState('');
  const [uploading, setUploading] = useState(false);

  const translations = {
    ar: {
      pageTitle: 'المشاريع والمهام',
      projects: 'المشاريع',
      tasks: 'المهام',
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
      noTasks: 'لا توجد مهام',
      externalLinks: 'روابط خارجية',
      addLink: 'إضافة رابط',
      files: 'الملفات والمستندات',
      videos: 'الفيديوهات',
      uploadFiles: 'رفع ملفات',
      uploadVideos: 'رفع فيديوهات',
      uploading: 'جاري الرفع...',
      startTime: 'وقت البداية',
      endTime: 'وقت الانتهاء',
      startTimer: 'بدء التوقيت',
      stopTimer: 'إيقاف التوقيت',
      totalTime: 'الوقت الكلي',
      timeEntries: 'سجل الأوقات',
      noTimeEntries: 'لا يوجد سجل أوقات',
      hours: 'ساعة',
      minutes: 'دقيقة',
      timerRunning: 'المؤقت يعمل',
      search: 'بحث...',
      allProjects: 'كل المشاريع',
      allUsers: 'كل المستخدمين',
      filterByProject: 'تصفية حسب المشروع',
      filterByUser: 'تصفية حسب المستخدم'
    },
    en: {
      pageTitle: 'Projects & Tasks',
      projects: 'Projects',
      tasks: 'Tasks',
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
      noTasks: 'No tasks',
      externalLinks: 'External Links',
      addLink: 'Add Link',
      files: 'Files & Documents',
      videos: 'Videos',
      uploadFiles: 'Upload Files',
      uploadVideos: 'Upload Videos',
      uploading: 'Uploading...',
      startTime: 'Start Time',
      endTime: 'End Time',
      startTimer: 'Start Timer',
      stopTimer: 'Stop Timer',
      totalTime: 'Total Time',
      timeEntries: 'Time Entries',
      noTimeEntries: 'No time entries',
      hours: 'hours',
      minutes: 'minutes',
      timerRunning: 'Timer Running',
      search: 'Search...',
      allProjects: 'All Projects',
      allUsers: 'All Users',
      filterByProject: 'Filter by Project',
      filterByUser: 'Filter by User'
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const priorityConfig: Record<string, { color: string; label: string; labelAr: string }> = {
    low: { color: 'bg-slate-500', label: 'Low', labelAr: 'منخفضة' },
    medium: { color: 'bg-blue-500', label: 'Medium', labelAr: 'متوسطة' },
    high: { color: 'bg-orange-500', label: 'High', labelAr: 'عالية' },
    urgent: { color: 'bg-red-500', label: 'Urgent', labelAr: 'عاجلة' }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get user's department access (admin and member)
      const [adminDepsRes, memberDepsRes, userRolesRes, profileRes] = await Promise.all([
        supabase.from('department_admins').select('department_id').eq('user_id', user.id),
        supabase.from('department_members').select('department_id').eq('user_id', user.id),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('profiles').select('default_department_id').eq('user_id', user.id).single()
      ]);

      const adminDeptIds = (adminDepsRes.data || []).map(d => d.department_id);
      const memberDeptIds = (memberDepsRes.data || []).map(d => d.department_id);
      const isSystemAdmin = (userRolesRes.data || []).some(r => r.role === 'admin');
      const defaultDeptId = profileRes.data?.default_department_id;

      // Include default department in member departments
      const allMemberDepts = defaultDeptId && !memberDeptIds.includes(defaultDeptId) 
        ? [...memberDeptIds, defaultDeptId] 
        : memberDeptIds;

      setUserAccess({
        adminDepartments: adminDeptIds,
        memberDepartments: allMemberDepts,
        isSystemAdmin
      });

      // Get all accessible department IDs
      const accessibleDeptIds = isSystemAdmin 
        ? [] // Will fetch all for system admins
        : [...new Set([...adminDeptIds, ...allMemberDepts])];

      const [projectsRes, tasksRes, depsRes, usersRes, timeEntriesRes, phasesRes, deptMembersRes] = await Promise.all([
        supabase.from('projects').select('*, departments(department_name)').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*, projects(name), departments(department_name)').order('created_at', { ascending: false }),
        supabase.from('departments').select('id, department_name').eq('is_active', true),
        supabase.from('profiles').select('user_id, user_name, default_department_id, avatar_url').eq('is_active', true),
        supabase.from('task_time_entries').select('*').order('start_time', { ascending: false }),
        supabase.from('department_task_phases').select('*').eq('is_active', true).order('phase_order', { ascending: true }),
        supabase.from('department_members').select('department_id, user_id')
      ]);

      if (depsRes.data) {
        setDepartments(depsRes.data);
        
        // Filter accessible departments based on user access
        const filteredDeps = isSystemAdmin 
          ? depsRes.data 
          : depsRes.data.filter(d => accessibleDeptIds.includes(d.id));
        setAccessibleDepartments(filteredDeps);

        // Set default department
        if (filteredDeps.length > 0 && !selectedDepartment) {
          const defaultDep = defaultDeptId && filteredDeps.find(d => d.id === defaultDeptId);
          setSelectedDepartment(defaultDep ? defaultDep.id : filteredDeps[0].id);
        }
      }

      if (projectsRes.data) {
        // Filter projects based on accessible departments
        const filteredProjects = isSystemAdmin 
          ? projectsRes.data 
          : projectsRes.data.filter(p => accessibleDeptIds.includes(p.department_id));
        setProjects(filteredProjects);
      }
      
      // Enhance users with department membership info
      const deptMembers = deptMembersRes.data || [];
      if (usersRes.data) {
        const usersWithMemberships = usersRes.data.map(u => ({
          ...u,
          departmentMemberships: deptMembers
            .filter(dm => dm.user_id === u.user_id)
            .map(dm => dm.department_id)
        }));
        setUsers(usersWithMemberships);
      }
      if (phasesRes.data) setTaskPhases(phasesRes.data);

      if (tasksRes.data) {
        const timeEntries = (timeEntriesRes.data || []) as TimeEntry[];
        
        // Filter tasks based on user access
        const filteredTasks = tasksRes.data.filter(task => {
          // System admin sees all
          if (isSystemAdmin) return true;
          // Department admin sees all tasks in their departments
          if (adminDeptIds.includes(task.department_id)) return true;
          // Regular user sees only their own tasks in their department
          if (allMemberDepts.includes(task.department_id) && 
              (task.assigned_to === user.id || task.created_by === user.id)) return true;
          return false;
        });
        
        const tasksWithProfiles = filteredTasks.map(task => {
          const taskTimeEntries = timeEntries.filter(te => te.task_id === task.id);
          const activeTimer = taskTimeEntries.find(te => te.end_time === null);
          const totalMinutes = taskTimeEntries.reduce((sum, te) => {
            if (te.duration_minutes) return sum + te.duration_minutes;
            if (te.end_time) {
              const duration = Math.floor((new Date(te.end_time).getTime() - new Date(te.start_time).getTime()) / 60000);
              return sum + duration;
            }
            return sum;
          }, 0);
          
          return {
            ...task,
            file_attachments: (task.file_attachments as unknown as FileAttachment[]) || [],
            video_attachments: (task.video_attachments as unknown as FileAttachment[]) || [],
            external_links: task.external_links || [],
            profiles: usersRes.data?.find(u => u.user_id === task.assigned_to) || null,
            time_entries: taskTimeEntries,
            total_time_minutes: totalMinutes,
            active_timer: activeTimer || null
          };
        });
        setTasks(tasksWithProfiles as unknown as Task[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDepartment]);

  // Timer update effect
  useEffect(() => {
    const interval = setInterval(() => {
      const newRunningTimers: Record<string, number> = {};
      tasks.forEach(task => {
        if (task.active_timer) {
          const elapsed = Math.floor((Date.now() - new Date(task.active_timer.start_time).getTime()) / 1000);
          newRunningTimers[task.id] = elapsed;
        }
      });
      setRunningTimers(newRunningTimers);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [tasks]);

  const handleStartTimer = async (taskId: string) => {
    if (!currentUserId) return;
    
    try {
      const { error } = await supabase.from('task_time_entries').insert({
        task_id: taskId,
        user_id: currentUserId,
        start_time: new Date().toISOString()
      });
      
      if (error) throw error;
      toast({ title: language === 'ar' ? 'تم بدء المؤقت' : 'Timer started' });
      fetchData();
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleStopTimer = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task?.active_timer) return;
    
    try {
      const endTime = new Date();
      const startTime = new Date(task.active_timer.start_time);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      
      const { error } = await supabase.from('task_time_entries')
        .update({ 
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', task.active_timer.id);
      
      if (error) throw error;
      toast({ title: language === 'ar' ? 'تم إيقاف المؤقت' : 'Timer stopped' });
      fetchData();
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}${language === 'ar' ? 'س' : 'h'} ${minutes}${language === 'ar' ? 'د' : 'm'}`;
    }
    return `${minutes}${language === 'ar' ? 'د' : 'm'}`;
  };

  const formatRunningTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get phases for selected department
  const departmentPhases = taskPhases.filter(p => p.department_id === selectedDepartment);
  const defaultPhases = [
    { id: 'todo', phase_key: 'todo', phase_name: 'To Do', phase_name_ar: 'للتنفيذ', phase_order: 0, phase_color: '#6B7280', department_id: selectedDepartment, is_active: true },
    { id: 'in_progress', phase_key: 'in_progress', phase_name: 'In Progress', phase_name_ar: 'قيد التنفيذ', phase_order: 1, phase_color: '#3B82F6', department_id: selectedDepartment, is_active: true },
    { id: 'review', phase_key: 'review', phase_name: 'Review', phase_name_ar: 'مراجعة', phase_order: 2, phase_color: '#F59E0B', department_id: selectedDepartment, is_active: true },
    { id: 'done', phase_key: 'done', phase_name: 'Done', phase_name_ar: 'مكتمل', phase_order: 3, phase_color: '#22C55E', department_id: selectedDepartment, is_active: true }
  ];
  
  const activePhases = departmentPhases.length > 0 ? departmentPhases : defaultPhases;

  // Check if user is admin of selected department
  const isAdminOfSelectedDepartment = userAccess.isSystemAdmin || userAccess.adminDepartments.includes(selectedDepartment);

  // Filter users based on selected department (users in that department)
  const departmentUsers = users.filter(u => {
    // If system admin or department admin, show all users in the department
    if (isAdminOfSelectedDepartment) {
      return u.default_department_id === selectedDepartment || 
             userAccess.adminDepartments.includes(selectedDepartment);
    }
    // Regular users only see themselves
    return u.user_id === currentUserId;
  });

  // For task assignment, department admins can assign to any user in their departments
  const assignableUsers = isAdminOfSelectedDepartment 
    ? users.filter(u => u.default_department_id === selectedDepartment)
    : users.filter(u => u.user_id === currentUserId);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (task.department_id !== selectedDepartment) return false;
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (selectedProject !== 'all' && task.project_id !== selectedProject) return false;
    if (selectedUser !== 'all' && task.assigned_to !== selectedUser) return false;
    return true;
  });

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
      try {
        await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
        setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        toast({ title: language === 'ar' ? 'تم تحديث الحالة' : 'Status updated' });
      } catch (error) {
        console.error('Error updating task status:', error);
        toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
      }
    }
  };

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
        start_time: taskForm.start_time || null,
        end_time: taskForm.end_time || null,
        external_links: taskForm.external_links,
        file_attachments: taskForm.file_attachments as unknown as Json,
        video_attachments: taskForm.video_attachments as unknown as Json,
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

  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
      toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
      fetchData();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      // First check if project has any tasks
      const { data: projectTasks } = await supabase.from('tasks').select('id').eq('project_id', projectId);
      if (projectTasks && projectTasks.length > 0) {
        toast({ 
          title: language === 'ar' ? 'لا يمكن حذف المشروع' : 'Cannot delete project', 
          description: language === 'ar' ? 'يحتوي المشروع على مهام' : 'Project has tasks',
          variant: 'destructive' 
        });
        return;
      }
      
      await supabase.from('projects').delete().eq('id', projectId);
      toast({ title: language === 'ar' ? 'تم حذف المشروع' : 'Project deleted' });
      setProjectDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id || '',
      department_id: task.department_id,
      assigned_to: task.assigned_to,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? new Date(task.deadline) : null,
      start_time: task.start_time || '',
      end_time: task.end_time || '',
      external_links: task.external_links || [],
      file_attachments: task.file_attachments || [],
      video_attachments: task.video_attachments || []
    });
    setTaskDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
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

  const resetProjectForm = () => {
    setEditingProject(null);
    setProjectForm({ name: '', description: '', department_id: selectedDepartment, status: 'active', start_date: null, end_date: null });
  };

  const resetTaskForm = () => {
    setEditingTask(null);
    setTaskForm({
      title: '', description: '', project_id: '', department_id: selectedDepartment, assigned_to: '',
      status: activePhases[0]?.phase_key || 'todo', priority: 'medium', deadline: null, start_time: '', end_time: '',
      external_links: [], file_attachments: [], video_attachments: []
    });
  };

  const handleFileUpload = async (files: FileList, type: 'file' | 'video') => {
    setUploading(true);
    try {
      const uploadedFiles: FileAttachment[] = [];
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        const { data, error } = await supabase.functions.invoke('upload-to-cloudinary', {
          body: { 
            imageBase64: base64, 
            folder: type === 'video' ? 'Edara_Projects_Videos' : 'Edara_Projects_Files',
            resourceType: type === 'video' ? 'video' : 'raw'
          }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        uploadedFiles.push({ url: data.url, name: file.name, type: file.type });
      }
      
      if (type === 'file') {
        setTaskForm(prev => ({ ...prev, file_attachments: [...prev.file_attachments, ...uploadedFiles] }));
      } else {
        setTaskForm(prev => ({ ...prev, video_attachments: [...prev.video_attachments, ...uploadedFiles] }));
      }
      
      toast({ title: language === 'ar' ? 'تم الرفع بنجاح' : 'Upload successful' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: language === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className={`min-h-screen bg-background ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">{t.pageTitle}</h1>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              {/* Department Selector */}
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t.selectDepartment} />
                </SelectTrigger>
                <SelectContent>
                  {accessibleDepartments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Add buttons */}
              <Dialog open={projectDialogOpen} onOpenChange={(o) => { setProjectDialogOpen(o); if (!o) resetProjectForm(); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />{t.addProject}</Button>
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
                          {accessibleDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 justify-between">
                      {editingProject && (
                        <Button 
                          variant="destructive" 
                          onClick={() => handleDeleteProject(editingProject.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t.delete}
                        </Button>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>{t.cancel}</Button>
                        <Button onClick={handleSaveProject}>{t.save}</Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={taskDialogOpen} onOpenChange={(o) => { setTaskDialogOpen(o); if (!o) resetTaskForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t.addTask}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                        <Select value={taskForm.department_id} onValueChange={(v) => setTaskForm({ ...taskForm, department_id: v, assigned_to: '' })}>
                          <SelectTrigger><SelectValue placeholder={t.selectDepartment} /></SelectTrigger>
                          <SelectContent>
                            {accessibleDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
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
                          {(userAccess.isSystemAdmin || userAccess.adminDepartments.includes(taskForm.department_id)
                            ? users.filter(u => 
                                u.default_department_id === taskForm.department_id || 
                                (u.departmentMemberships && u.departmentMemberships.includes(taskForm.department_id))
                              )
                            : users.filter(u => u.user_id === currentUserId)
                          ).map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">{t.status}</label>
                        <Select value={taskForm.status} onValueChange={(v) => setTaskForm({ ...taskForm, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {activePhases.map(phase => (
                              <SelectItem key={phase.phase_key} value={phase.phase_key}>
                                {language === 'ar' ? phase.phase_name_ar || phase.phase_name : phase.phase_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                    
                    {/* External Links */}
                    <div>
                      <label className="text-sm font-medium">{t.externalLinks}</label>
                      <div className="flex gap-2 mt-1">
                        <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://..." />
                        <Button type="button" size="sm" onClick={() => { if (newLink) { setTaskForm(prev => ({ ...prev, external_links: [...prev.external_links, newLink] })); setNewLink(''); } }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {taskForm.external_links.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {taskForm.external_links.map((link, i) => (
                            <Badge key={i} variant="outline" className="gap-1">
                              <Link className="h-3 w-3" />
                              <span className="max-w-[150px] truncate">{link}</span>
                              <X className="h-3 w-3 cursor-pointer" onClick={() => setTaskForm(prev => ({ ...prev, external_links: prev.external_links.filter((_, idx) => idx !== i) }))} />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className="text-sm font-medium">{t.files}</label>
                      <div className="flex gap-2 mt-1">
                        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById('file-upload')?.click()}>
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          {t.uploadFiles}
                        </Button>
                        <input id="file-upload" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'file')} />
                      </div>
                      {taskForm.file_attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {taskForm.file_attachments.map((file, i) => (
                            <Badge key={i} variant="outline" className="gap-1">
                              <FileText className="h-3 w-3" />
                              <span className="max-w-[150px] truncate">{file.name}</span>
                              <X className="h-3 w-3 cursor-pointer" onClick={() => setTaskForm(prev => ({ ...prev, file_attachments: prev.file_attachments.filter((_, idx) => idx !== i) }))} />
                            </Badge>
                          ))}
                        </div>
                      )}
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

          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 mt-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder={t.search}
                className="pl-9"
              />
            </div>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t.filterByProject} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allProjects}</SelectItem>
                {projects.filter(p => p.department_id === selectedDepartment).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t.filterByUser} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allUsers}</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* User avatars */}
            <div className="flex -space-x-2">
              {users.slice(0, 5).map(u => (
                <Avatar key={u.user_id} className="h-8 w-8 border-2 border-background cursor-pointer hover:z-10">
                  <AvatarFallback className="text-xs bg-primary/10">
                    {u.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {users.length > 5 && (
                <Avatar className="h-8 w-8 border-2 border-background">
                  <AvatarFallback className="text-xs bg-muted">+{users.length - 5}</AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* Projects List */}
            {projects.filter(p => p.department_id === selectedDepartment).length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-muted-foreground">{t.projects}:</span>
                <div className="flex flex-wrap gap-2">
                  {projects.filter(p => p.department_id === selectedDepartment).map(project => (
                    <Badge 
                      key={project.id} 
                      variant="outline" 
                      className="gap-1 pr-1 cursor-pointer hover:bg-muted"
                      onClick={() => handleEditProject(project)}
                    >
                      <FolderKanban className="h-3 w-3" />
                      {project.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-4">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" style={{ minWidth: activePhases.length * 320 }}>
              {activePhases.map((phase) => {
                const phaseTasks = filteredTasks.filter(t => t.status === phase.phase_key);
                return (
                  <DroppableColumn 
                    key={phase.phase_key} 
                    id={phase.phase_key}
                    className="w-[300px] shrink-0 rounded-xl bg-muted/30 p-3 transition-colors"
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: phase.phase_color }}
                      />
                      <span className="font-medium text-sm">
                        {language === 'ar' ? phase.phase_name_ar || phase.phase_name : phase.phase_name}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                        {phaseTasks.length}
                      </Badge>
                    </div>

                    {/* Tasks */}
                    <div className="space-y-2 min-h-[200px]">
                      {phaseTasks.map((task) => (
                        <DraggableTask key={task.id} task={task}>
                          {({ listeners }) => (
                            <Card className="group hover:shadow-md transition-all cursor-pointer bg-card">
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <button {...listeners} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleEditTask(task)}>
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDeleteTask(task.id)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {task.projects?.name && (
                                      <Badge variant="outline" className="mt-1.5 text-xs h-5 px-1.5">
                                        {task.projects.name}
                                      </Badge>
                                    )}

                                    {task.description && (
                                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.description}</p>
                                    )}

                                    {/* Task metadata */}
                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                      {/* Priority */}
                                      <div className={cn("w-2 h-2 rounded-full", priorityConfig[task.priority]?.color)} title={priorityConfig[task.priority]?.label} />
                                      
                                      {/* Task ID */}
                                      <span className="text-xs text-muted-foreground font-mono">
                                        #{task.id.slice(0, 6)}
                                      </span>

                                      {/* Time */}
                                      {(task.total_time_minutes && task.total_time_minutes > 0) && (
                                        <Badge variant="secondary" className="text-xs h-5 gap-1 px-1.5">
                                          <Timer className="h-3 w-3" />
                                          {formatDuration(task.total_time_minutes)}
                                        </Badge>
                                      )}

                                      {/* Timer controls */}
                                      {task.active_timer ? (
                                        <Badge variant="destructive" className="text-xs h-5 gap-1 px-1.5 cursor-pointer" onClick={() => handleStopTimer(task.id)}>
                                          <Square className="h-3 w-3" />
                                          {formatRunningTime(runningTimers[task.id] || 0)}
                                        </Badge>
                                      ) : (
                                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => handleStartTimer(task.id)}>
                                          <Play className="h-3 w-3" />
                                        </Button>
                                      )}

                                      {/* Due date */}
                                      {task.deadline && (
                                        <Badge variant="outline" className="text-xs h-5 gap-1 px-1.5">
                                          <CalendarIcon className="h-3 w-3" />
                                          {format(new Date(task.deadline), 'MMM d')}
                                        </Badge>
                                      )}

                                      {/* Attachments count */}
                                      {(task.file_attachments?.length > 0 || task.external_links?.length > 0) && (
                                        <Badge variant="outline" className="text-xs h-5 gap-1 px-1.5">
                                          <FileText className="h-3 w-3" />
                                          {(task.file_attachments?.length || 0) + (task.external_links?.length || 0)}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Assignee */}
                                    <div className="flex items-center gap-2 mt-3">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs bg-primary/10">
                                          {task.profiles?.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-muted-foreground truncate">
                                        {task.profiles?.user_name || t.selectUser}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </DraggableTask>
                      ))}

                      {phaseTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-xs">{t.noTasks}</p>
                        </div>
                      )}
                    </div>
                  </DroppableColumn>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay>
            {activeTask && (
              <Card className="w-[280px] shadow-lg rotate-3">
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm">{activeTask.title}</h4>
                  {activeTask.projects?.name && (
                    <Badge variant="outline" className="mt-1.5 text-xs">{activeTask.projects.name}</Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Time Entries Dialog */}
      <Dialog open={timeEntriesDialogOpen} onOpenChange={setTimeEntriesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.timeEntries}</DialogTitle>
          </DialogHeader>
          {selectedTaskForTimeEntries?.time_entries?.length ? (
            <div className="space-y-2">
              {selectedTaskForTimeEntries.time_entries.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center p-2 bg-muted rounded">
                  <div>
                    <p className="text-sm">{format(new Date(entry.start_time), 'PPp')}</p>
                    {entry.end_time && <p className="text-xs text-muted-foreground">{format(new Date(entry.end_time), 'PPp')}</p>}
                  </div>
                  <Badge>{entry.duration_minutes ? formatDuration(entry.duration_minutes) : t.timerRunning}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">{t.noTimeEntries}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsTasks;
