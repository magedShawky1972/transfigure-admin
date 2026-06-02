import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, subMonths, parse, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Plus, FolderKanban, Calendar as CalendarIcon, Trash2, Edit, 
  GripVertical, Link, FileText, Video, X, Upload, Loader2, Play, Square, 
  Timer, History, Search, User, UserPlus, Flag, MoreHorizontal, CheckCircle2, Users, Milestone,
  GanttChart, FileSpreadsheet, BarChart3, Eye, Download, Image as ImageIcon, Archive, ArchiveRestore,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Bell, AlertTriangle, Share2, Copy, Send
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import { downloadFile } from "@/lib/fileDownload";
import { ProjectTaskExcelImport } from "@/components/ProjectTaskExcelImport";
import { ProjectSummaryDialog } from "@/components/ProjectSummaryDialog";
import { PdfPreview } from "@/components/PdfPreview";
import { ProjectSummaryDialogLoader } from "@/components/ProjectSummaryDialogLoader";
import { cn } from "@/lib/utils";
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import TaskMessages from "@/components/TaskMessages";
import ProjectTaskPhases from "@/components/ProjectTaskPhases";
import WireframeBoard, { type Wireframe } from "@/components/WireframeBoard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InviteGuestButton from "@/components/InviteGuestButton";

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

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
  members?: ProjectMember[];
  department_ids?: string[];
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
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  ticket_id: string | null;
  created_at: string;
  seq_number?: number;
  external_links?: string[] | null;
  file_attachments?: FileAttachment[] | null;
  video_attachments?: FileAttachment[] | null;
  dependency_task_id?: string | null;
  is_milestone?: boolean;
  projects?: { name: string } | null;
  departments?: { department_name: string };
  profiles?: { user_name: string };
  time_entries?: TimeEntry[];
  total_time_minutes?: number;
  active_timer?: TimeEntry | null;
  dependency_task?: { title: string } | null;
  assignees?: string[];
  is_archived?: boolean;
  archived_at?: string | null;
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
  job_position_id?: string | null;
  position_level?: number | null; // Position hierarchy level (0 = highest)
  departmentMemberships?: string[]; // Additional department IDs from department_members
}

interface UserDepartmentAccess {
  adminDepartments: string[];
  memberDepartments: string[];
  isSystemAdmin: boolean;
  managedProjectIds: string[]; // Projects where user is a manager
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [accessibleDepartments, setAccessibleDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [allProjectUsers, setAllProjectUsers] = useState<Profile[]>([]);
  const [taskPhases, setTaskPhases] = useState<TaskPhase[]>([]);
  const [projectPhases, setProjectPhases] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserPositionLevel, setCurrentUserPositionLevel] = useState<number | null>(null);
  const [isExternalGuest, setIsExternalGuest] = useState(false);
  const [guestProjectId, setGuestProjectId] = useState<string | null>(null);
  const [guestRole, setGuestRole] = useState<"editor" | "viewer" | null>(null);
  const [userAccess, setUserAccess] = useState<UserDepartmentAccess>({ adminDepartments: [], memberDepartments: [], isSystemAdmin: false, managedProjectIds: [] });
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runningTimers, setRunningTimers] = useState<Record<string, number>>({});
  const [selectedDepartment, setSelectedDepartment] = useState<string>(searchParams.get('departmentId') || "");
  // Refs to keep fetchData stable (prevents double-refetch when searchParams / selectedDepartment change)
  const searchParamsRef = useRef(searchParams);
  const selectedDepartmentRef = useRef(selectedDepartment);
  const setSearchParamsRef = useRef(setSearchParams);
  const kanbanWrapperRef = useRef<HTMLDivElement>(null);

  const scrollKanban = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (dir === 'up') { window.scrollBy({ top: -300, behavior: 'smooth' }); return; }
    if (dir === 'down') { window.scrollBy({ top: 300, behavior: 'smooth' }); return; }
    const viewport = kanbanWrapperRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  }, []);
  useEffect(() => { searchParamsRef.current = searchParams; }, [searchParams]);
  useEffect(() => { selectedDepartmentRef.current = selectedDepartment; }, [selectedDepartment]);
  useEffect(() => { setSearchParamsRef.current = setSearchParams; }, [setSearchParams]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>(searchParams.get('projectId') || "all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateMode, setDateMode] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);
  const [phaseSearchTerms, setPhaseSearchTerms] = useState<Record<string, string>>({});
  const [forceLoadAll, setForceLoadAll] = useState(false);
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({});
  const DEFAULT_COLUMN_LIMIT = 25;
  
  // Dialog states
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [timeEntriesDialogOpen, setTimeEntriesDialogOpen] = useState(false);
  const [selectedTaskForTimeEntries, setSelectedTaskForTimeEntries] = useState<Task | null>(null);
  const [summaryProject, setSummaryProject] = useState<Project | null>(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type?: string } | null>(null);
  const [excelImportDialogOpen, setExcelImportDialogOpen] = useState(false);
  const [selectedTaskForAttachments, setSelectedTaskForAttachments] = useState<Task | null>(null);
  const [inlineCreatePhase, setInlineCreatePhase] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineAssignees, setInlineAssignees] = useState<string[]>([]);
  const [inlineSaving, setInlineSaving] = useState(false);
  const [kanbanGroupBy, setKanbanGroupBy] = useState<'phase' | 'department' | 'employee'>(
    (['phase','department','employee'].includes(searchParams.get('groupBy') || '')
      ? (searchParams.get('groupBy') as any)
      : 'phase')
  );
  const [showArchived, setShowArchived] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareRecipients, setShareRecipients] = useState<string[]>([]);
  const [shareNote, setShareNote] = useState('');
  const [shareSending, setShareSending] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [assignEmailDialogOpen, setAssignEmailDialogOpen] = useState(false);
  const [assignEmailRecipients, setAssignEmailRecipients] = useState<string[]>([]);
  const [assignEmailSearch, setAssignEmailSearch] = useState('');
  const [assignEmailSending, setAssignEmailSending] = useState(false);


  // Compute Nth weekday(s) of month for recurring tasks
  // weeks: array of week numbers (1..4, 5=last) — can select multiple weeks
  const computeRecurringDates = (year: number, months: number[], weeks: number[], day: number): Date[] => {
    const out: Date[] = [];
    for (const m of months) {
      for (const week of weeks) {
        if (week === 5) {
          const last = new Date(year, m, 0); // last day of month m (1-12)
          const offset = (last.getDay() - day + 7) % 7;
          out.push(new Date(year, m - 1, last.getDate() - offset));
        } else {
          const first = new Date(year, m - 1, 1);
          const offset = (day - first.getDay() + 7) % 7;
          const date = 1 + offset + (week - 1) * 7;
          const daysInMonth = new Date(year, m, 0).getDate();
          if (date <= daysInMonth) out.push(new Date(year, m - 1, date));
        }
      }
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  };

  // Form states
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    department_id: '',
    department_ids: [] as string[],
    status: 'active',
    start_date: null as Date | null,
    end_date: null as Date | null,
    manager_id: '' as string,
    member_ids: [] as string[]
  });
  
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    project_id: '',
    department_id: '',
    assigned_to: [] as string[], // Changed to array for multi-user
    status: 'todo',
    priority: 'medium',
    dependency_task_id: '' as string,
    is_milestone: false,
    start_date: null as Date | null,
    deadline: null as Date | null,
    start_time: '',
    end_time: '',
    external_links: [] as string[],
    file_attachments: [] as FileAttachment[],
    video_attachments: [] as FileAttachment[],
    seq_number: null as number | null,
    wireframes: [] as Wireframe[],
    figma_link: '' as string,
    is_recurring: false,
    recurrence_months: [] as number[],
    recurrence_weeks: [1] as number[], // 1..4, 5 = last — can select multiple
    recurrence_day: 1, // 0=Sun..6=Sat
    recurrence_year: new Date().getFullYear(),
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
      allDepartments: 'كل الأقسام',
      groupBy: 'تجميع حسب',
      groupByPhase: 'المرحلة',
      groupByDepartment: 'القسم',
      groupByEmployee: 'الموظف',
      unassigned: 'غير معين',
      filterByProject: 'تصفية حسب المشروع',
      filterByUser: 'تصفية حسب المستخدم',
      projectManager: 'مدير المشروع',
      projectMembers: 'أعضاء المشروع',
      selectManager: 'اختر مدير المشروع',
      noManager: 'بدون مدير',
      dependency: 'المهمة المعتمد عليها',
      noDependency: 'بدون تبعية',
      milestone: 'علامة فارقة',
      selectDependency: 'اختر المهمة المعتمد عليها',
      seqNumber: 'الرقم التسلسلي',
      includeArchive: 'تضمين الأرشيف'
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
      allDepartments: 'All Departments',
      groupBy: 'Group by',
      groupByPhase: 'Phase',
      groupByDepartment: 'Department',
      groupByEmployee: 'Employee',
      unassigned: 'Unassigned',
      filterByProject: 'Filter by Project',
      filterByUser: 'Filter by User',
      projectManager: 'Project Manager',
      projectMembers: 'Project Members',
      selectManager: 'Select Manager',
      noManager: 'No Manager',
      dependency: 'Dependency',
      noDependency: 'No Dependency',
      milestone: 'Milestone',
      selectDependency: 'Select dependency task',
      seqNumber: 'Seq. Number',
      includeArchive: 'Include Archive'
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const priorityConfig: Record<string, { color: string; label: string; labelAr: string }> = {
    low: { color: 'bg-slate-500', label: 'Low', labelAr: 'منخفضة' },
    medium: { color: 'bg-blue-500', label: 'Medium', labelAr: 'متوسطة' },
    high: { color: 'bg-orange-500', label: 'High', labelAr: 'عالية' },
    urgent: { color: 'bg-red-500', label: 'Urgent', labelAr: 'عاجلة' }
  };

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const searchParams = searchParamsRef.current;
      const setSearchParams = setSearchParamsRef.current;
      const selectedDepartment = selectedDepartmentRef.current;
      const forcedProjectId = searchParams.get('projectId');

      const [{ data: profileRow }, { data: guestRows }] = await Promise.all([
        supabase.from('profiles').select('is_external_guest').eq('user_id', user.id).maybeSingle(),
        supabase.from('project_guests').select('project_id, role, accepted_at').eq('user_id', user.id).not('accepted_at', 'is', null)
      ]);

      const externalGuest = !!profileRow?.is_external_guest;
      const activeGuest = guestRows?.[0] || null;
      setIsExternalGuest(externalGuest);
      setGuestProjectId(activeGuest?.project_id || null);
      setGuestRole((activeGuest?.role as "editor" | "viewer" | null) || null);

      if (externalGuest) {
        if (activeGuest?.project_id && forcedProjectId !== activeGuest.project_id) {
          setSearchParams({ projectId: activeGuest.project_id });
          setSelectedProject(activeGuest.project_id);
        } else if (activeGuest?.project_id) {
          setSelectedProject(activeGuest.project_id);
        }
      }

      if (externalGuest && activeGuest?.project_id) {
        const [{ data: guestProject }, { data: guestTasks }, { data: guestProjectMembers }] = await Promise.all([
          supabase.from('projects').select('*, departments(department_name)').eq('id', activeGuest.project_id).maybeSingle(),
          supabase.from('tasks').select('*, projects(name), departments(department_name)').eq('project_id', activeGuest.project_id).order('seq_number', { ascending: true }),
          supabase.from('project_members').select('*').eq('project_id', activeGuest.project_id)
        ]);

        if (guestProject) {
          setProjects([{ ...guestProject, members: (guestProjectMembers || []) as ProjectMember[] }] as Project[]);
          setSelectedDepartment(guestProject.department_id);
          setAccessibleDepartments(guestProject.departments ? [{
            id: guestProject.department_id,
            department_name: (guestProject.departments as any).department_name,
          }] as Department[] : []);
        } else {
          setProjects([]);
          setAccessibleDepartments([]);
        }

        setDepartments([]);
        setAllProjectUsers([]);
        setUsers([{ user_id: user.id, user_name: user.email || 'Guest User', default_department_id: guestProject?.department_id || '', avatar_url: null, job_position_id: null, position_level: null, departmentMemberships: guestProject?.department_id ? [guestProject.department_id] : [] }] as Profile[]);
        setTaskPhases([]);
        setUserAccess({ adminDepartments: [], memberDepartments: guestProject?.department_id ? [guestProject.department_id] : [], isSystemAdmin: false, managedProjectIds: [] });
        setCurrentUserPositionLevel(null);
        setTasks(((guestTasks || []) as any[]).map(task => ({
          ...task,
          file_attachments: (task.file_attachments as unknown as FileAttachment[]) || [],
          video_attachments: (task.video_attachments as unknown as FileAttachment[]) || [],
          external_links: task.external_links || [],
          profiles: null,
          time_entries: [],
          total_time_minutes: 0,
          active_timer: null,
          assignees: task.assigned_to ? [task.assigned_to] : []
        })) as unknown as Task[]);
        return;
      }

      // Get user's department access (admin and member)
      const [adminDepsRes, memberDepsRes, userRolesRes, profileRes, allDepsRes] = await Promise.all([
        supabase.from('department_admins').select('department_id').eq('user_id', user.id),
        supabase.from('department_members').select('department_id').eq('user_id', user.id),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('profiles').select('default_department_id').eq('user_id', user.id).single(),
        supabase.from('departments').select('id, department_name, parent_department_id').eq('is_active', true)
      ]);

      const allDepartments = allDepsRes.data || [];
      
      // Helper function to get all child departments recursively
      const getChildDepartments = (parentId: string): string[] => {
        const children = allDepartments
          .filter(d => d.parent_department_id === parentId)
          .map(d => d.id);
        const grandChildren = children.flatMap(childId => getChildDepartments(childId));
        return [...children, ...grandChildren];
      };

      const directAdminDeptIds = (adminDepsRes.data || []).map(d => d.department_id);
      // Include child departments for each admin department
      const adminDeptIds = [...new Set([
        ...directAdminDeptIds,
        ...directAdminDeptIds.flatMap(id => getChildDepartments(id))
      ])];
      
      const memberDeptIds = (memberDepsRes.data || []).map(d => d.department_id);
      const defaultDeptId = profileRes.data?.default_department_id;

      // Include default department in member departments
      const allMemberDepts = defaultDeptId && !memberDeptIds.includes(defaultDeptId) 
        ? [...memberDeptIds, defaultDeptId] 
        : memberDeptIds;

      // Check if user is a system admin
      const isAdmin = (userRolesRes.data || []).some(r => r.role === 'admin');

      // Get all accessible department IDs - admins get all departments
      const accessibleDeptIds = isAdmin 
        ? allDepartments.map(d => d.id)
        : [...new Set([...adminDeptIds, ...allMemberDepts])];

      // Fetch users with job positions to determine department from organizational chart
      // Fetch tasks with pagination to avoid PostgREST max_rows limit (1000)
      const fetchAllTasks = async () => {
        const allTasks: any[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await supabase
            .from('tasks')
            .select('*, projects(name), departments(department_name)')
            .order('seq_number', { ascending: true })
            .range(from, to);
          if (error) throw error;
          if (data && data.length > 0) {
            allTasks.push(...data);
            if (data.length < pageSize) hasMore = false;
            else page++;
          } else {
            hasMore = false;
          }
        }
        return { data: allTasks, error: null };
      };

      const fetchAllTaskAssignees = async () => {
        const all: { task_id: string; user_id: string }[] = [];
        const pageSize = 1000;
        let page = 0;
        while (true) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data, error } = await supabase.from('task_assignees').select('task_id, user_id').range(from, to);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < pageSize) break;
          page++;
        }
        return { data: all, error: null };
      };

      const [projectsRes, tasksRes, usersRes, timeEntriesRes, phasesRes, jobPositionsRes, projectMembersRes, allDeptMembersRes, taskAssigneesRes, employeesRes, projectDepartmentsRes] = await Promise.all([
        supabase.from('projects').select('*, departments(department_name)').order('created_at', { ascending: false }),
        fetchAllTasks(),
        supabase.from('profiles').select('user_id, user_name, default_department_id, avatar_url, job_position_id').eq('is_active', true),
        supabase.from('task_time_entries').select('*').order('start_time', { ascending: false }),
        supabase.from('department_task_phases').select('*').eq('is_active', true).order('phase_order', { ascending: true }),
        supabase.from('job_positions').select('id, department_id, position_level').eq('is_active', true),
        supabase.from('project_members').select('*'),
        supabase.from('department_members').select('user_id, department_id'),
        fetchAllTaskAssignees(),
        supabase.from('employees').select('user_id, first_name, last_name, photo_url, employment_status').eq('employment_status', 'active' as any),
        supabase.from('project_departments').select('project_id, department_id')
      ]);

      // Build map of project_id -> department_ids[]
      const projectDeptMap = new Map<string, string[]>();
      ((projectDepartmentsRes.data || []) as { project_id: string; department_id: string }[]).forEach(pd => {
        if (!projectDeptMap.has(pd.project_id)) projectDeptMap.set(pd.project_id, []);
        projectDeptMap.get(pd.project_id)!.push(pd.department_id);
      });

      // Build map of taskId -> assignee user_ids
      const assigneesMap = new Map<string, string[]>();
      (taskAssigneesRes.data || []).forEach((ta: { task_id: string; user_id: string }) => {
        if (!assigneesMap.has(ta.task_id)) assigneesMap.set(ta.task_id, []);
        assigneesMap.get(ta.task_id)!.push(ta.user_id);
      });

      // Map of user_id -> employee record (only active employees with a linked user_id)
      const employeeMap = new Map<string, { full_name: string; photo_url: string | null }>();
      (employeesRes.data || []).forEach((e: any) => {
        if (e.user_id) {
          employeeMap.set(e.user_id, {
            full_name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
            photo_url: e.photo_url || null,
          });
        }
      });

      // Get project IDs where user is a manager
      const projectMembers = ((projectMembersRes.data || []) as ProjectMember[]).sort((a, b) => {
        if (a.role !== b.role) return a.role === 'manager' ? -1 : 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      const managedProjectIds = projectMembers
        .filter(pm => pm.user_id === user.id && pm.role === 'manager')
        .map(pm => pm.project_id);

      setUserAccess({
        adminDepartments: adminDeptIds,
        memberDepartments: allMemberDepts,
        isSystemAdmin: isAdmin,
        managedProjectIds
      });

      // Use allDepartments from the initial fetch
      setDepartments(allDepartments as Department[]);
      
      // Admins see all departments, others see filtered
      const filteredDeps = isAdmin ? allDepartments : allDepartments.filter(d => accessibleDeptIds.includes(d.id));
      setAccessibleDepartments(filteredDeps as Department[]);

      // Set default department (only if not already set from URL params)
      const urlDeptId = searchParams.get('departmentId');
      if (filteredDeps.length > 0 && !selectedDepartment) {
        if (urlDeptId && filteredDeps.find(d => d.id === urlDeptId)) {
          setSelectedDepartment(urlDeptId);
        } else {
          const defaultDep = defaultDeptId && filteredDeps.find(d => d.id === defaultDeptId);
          setSelectedDepartment(defaultDep ? defaultDep.id : filteredDeps[0].id);
        }
      }

      const projectMemberProjectIds = projectMembers.filter(pm => pm.user_id === user.id).map(pm => pm.project_id);

      if (projectsRes.data) {
        // Admins see all projects, others see filtered (including projects where user is a member)
        const baseProjects = isAdmin 
          ? projectsRes.data 
          : projectsRes.data.filter(p => {
              const deptIds = projectDeptMap.get(p.id) || [p.department_id];
              return deptIds.some(d => accessibleDeptIds.includes(d)) || 
                projectMemberProjectIds.includes(p.id);
            });

        const filteredProjects = externalGuest && activeGuest?.project_id
          ? baseProjects.filter(p => p.id === activeGuest.project_id)
          : baseProjects;
        
        // Attach members + department_ids to projects
        const projectsWithMembers = filteredProjects.map(p => ({
          ...p,
          members: projectMembers.filter(pm => pm.project_id === p.id),
          department_ids: projectDeptMap.get(p.id) || [p.department_id],
        }));
        
        setProjects(projectsWithMembers);
      }
      
      // Build job position maps from organizational chart
      const jobPositions = jobPositionsRes.data || [];
      const jobToDeptMap = new Map<string, string>();
      const jobToLevelMap = new Map<string, number>();
      jobPositions.forEach((jp: { id: string; department_id: string | null; position_level: number | null }) => {
        if (jp.department_id) {
          jobToDeptMap.set(jp.id, jp.department_id);
        }
        if (jp.position_level !== null) {
          jobToLevelMap.set(jp.id, jp.position_level);
        }
      });
      
      // Get current user's position level
      const currentUserProfile = usersRes.data?.find((u: any) => u.user_id === user.id);
      if (currentUserProfile?.job_position_id && jobToLevelMap.has(currentUserProfile.job_position_id)) {
        setCurrentUserPositionLevel(jobToLevelMap.get(currentUserProfile.job_position_id)!);
      } else {
        setCurrentUserPositionLevel(null);
      }
      
      // Build a map of user_id -> department_ids from department_members table
      const deptMembersData = allDeptMembersRes.data || [];
      const userDeptMembershipMap = new Map<string, string[]>();
      deptMembersData.forEach((dm: { user_id: string; department_id: string }) => {
        if (!userDeptMembershipMap.has(dm.user_id)) {
          userDeptMembershipMap.set(dm.user_id, []);
        }
        userDeptMembershipMap.get(dm.user_id)!.push(dm.department_id);
      });
      
      // Enhance users with department info and position level from organizational chart
      if (usersRes.data) {
        const usersWithDepts = usersRes.data.map((u: any) => {
          const deptIds: string[] = [];
          let positionLevel: number | null = null;
          
          // Add department and position level from job position (organizational chart)
          if (u.job_position_id) {
            if (jobToDeptMap.has(u.job_position_id)) {
              deptIds.push(jobToDeptMap.get(u.job_position_id)!);
            }
            if (jobToLevelMap.has(u.job_position_id)) {
              positionLevel = jobToLevelMap.get(u.job_position_id)!;
            }
          }
          // Also add default department if different
          if (u.default_department_id && !deptIds.includes(u.default_department_id)) {
            deptIds.push(u.default_department_id);
          }
          // Add departments from department_members table
          const memberDepts = userDeptMembershipMap.get(u.user_id) || [];
          memberDepts.forEach(deptId => {
            if (!deptIds.includes(deptId)) {
              deptIds.push(deptId);
            }
          });
          const emp = employeeMap.get(u.user_id);
          return {
            user_id: u.user_id,
            user_name: emp?.full_name || u.user_name,
            default_department_id: u.default_department_id,
            avatar_url: emp?.photo_url || u.avatar_url,
            job_position_id: u.job_position_id,
            position_level: positionLevel,
            departmentMemberships: deptIds,
            isEmployee: !!emp,
          };
        });
        
        setAllProjectUsers(usersWithDepts);

        // Only employees can be assigned tasks
        const employeeOnly = usersWithDepts.filter(u => u.isEmployee);
        // Admins see all employees, others see filtered by accessible departments
        const filteredUsers = externalGuest
          ? employeeOnly.filter(u => u.user_id === user.id)
          : isAdmin ? employeeOnly : employeeOnly.filter(u => 
          u.departmentMemberships.some(deptId => accessibleDeptIds.includes(deptId))
        );
        
        setUsers(filteredUsers);
      }
      if (phasesRes.data) setTaskPhases(phasesRes.data);

      if (tasksRes.data) {
        const timeEntries = (timeEntriesRes.data || []) as TimeEntry[];
        
        // Filter tasks based on user access - admins see all tasks
        const filteredTasks = externalGuest && activeGuest?.project_id
          ? tasksRes.data.filter(task => task.project_id === activeGuest.project_id)
          : isAdmin ? tasksRes.data : tasksRes.data.filter(task => {
          const taskAssignees = assigneesMap.get(task.id) || [];
          // Any member of the task's project can see all tasks in that project
          if (task.project_id && projectMemberProjectIds.includes(task.project_id)) return true;
          // Department admin sees all tasks in their departments
          if (adminDeptIds.includes(task.department_id)) return true;
          // Regular user sees tasks they're assigned to (single or multi) or created
          if (allMemberDepts.includes(task.department_id) &&
              (task.assigned_to === user.id || taskAssignees.includes(user.id) || task.created_by === user.id)) return true;
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
          
          const assignees = assigneesMap.get(task.id) || (task.assigned_to ? [task.assigned_to] : []);
          return {
            ...task,
            file_attachments: (task.file_attachments as unknown as FileAttachment[]) || [],
            video_attachments: (task.video_attachments as unknown as FileAttachment[]) || [],
            external_links: task.external_links || [],
            profiles: usersRes.data?.find(u => u.user_id === task.assigned_to) || null,
            time_entries: taskTimeEntries,
            total_time_minutes: totalMinutes,
            active_timer: activeTimer || null,
            assignees
          };
        });
        setTasks(tasksWithProfiles as unknown as Task[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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
      fetchData(true);
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
      fetchData(true);
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

  // Auto-open New Project dialog when ?newProject=1 is in the URL
  useEffect(() => {
    if (searchParams.get('newProject') === '1') {
      resetProjectForm();
      setProjectDialogOpen(true);
      const sp = new URLSearchParams(searchParams);
      sp.delete('newProject');
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset filters when department changes (but respect URL params on first load)
  useEffect(() => {
    const urlProjectId = searchParams.get('projectId');
    const urlDeptId = searchParams.get('departmentId');
    
    // Only reset if not from URL params
    if (!urlProjectId && !urlDeptId) {
      setSelectedUser('all');
      setSelectedProject('all');
      setSearchTerm('');
    }
    
    // Clear URL params after first use
    if (urlProjectId || urlDeptId) {
      setSearchParams({}, { replace: true });
    }
  }, [selectedDepartment]);

  // Load project-specific phases when a single project is selected
  useEffect(() => {
    if (selectedProject === 'all') { setProjectPhases([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('project_task_phases')
        .select('*')
        .eq('project_id', selectedProject)
        .eq('is_active', true)
        .order('phase_order', { ascending: true });
      if (!cancelled) setProjectPhases(data || []);
    })();
    return () => { cancelled = true; };
  }, [selectedProject, projectDialogOpen]);

  // Get phases for selected department
  const departmentPhases = taskPhases.filter(p => p.department_id === selectedDepartment);
  const defaultPhases = [
    { id: 'todo', phase_key: 'todo', phase_name: 'To Do', phase_name_ar: 'للتنفيذ', phase_order: 0, phase_color: '#6B7280', department_id: selectedDepartment, is_active: true },
    { id: 'in_progress', phase_key: 'in_progress', phase_name: 'In Progress', phase_name_ar: 'قيد التنفيذ', phase_order: 1, phase_color: '#3B82F6', department_id: selectedDepartment, is_active: true },
    { id: 'review', phase_key: 'review', phase_name: 'Review', phase_name_ar: 'مراجعة', phase_order: 2, phase_color: '#F59E0B', department_id: selectedDepartment, is_active: true },
    { id: 'done', phase_key: 'done', phase_name: 'Done', phase_name_ar: 'مكتمل', phase_order: 3, phase_color: '#22C55E', department_id: selectedDepartment, is_active: true }
  ];
  
  const activePhases = (selectedProject !== 'all' && projectPhases.length > 0)
    ? projectPhases.map((p: any) => ({ ...p, department_id: selectedDepartment }))
    : (departmentPhases.length > 0 ? departmentPhases : defaultPhases);

  // Auto-revert kanbanGroupBy when 'department' selected but no project chosen
  useEffect(() => {
    if (kanbanGroupBy === 'department' && selectedProject === 'all') {
      setKanbanGroupBy('phase');
    }
  }, [kanbanGroupBy, selectedProject]);

  // Check if user is admin of selected department or project manager
  const isAdminOfSelectedDepartment = selectedDepartment === 'all' 
    ? userAccess.isSystemAdmin 
    : userAccess.isSystemAdmin || userAccess.adminDepartments.includes(selectedDepartment);

  // Helper: does a project belong to the given department (primary or linked)
  const projectInDept = (p: Project, deptId: string) =>
    deptId === 'all' || (p.department_ids && p.department_ids.length > 0 ? p.department_ids : [p.department_id]).includes(deptId);

  const getProjectRelevantDepartmentIds = (project: Project | null) => {
    if (!project) return [] as string[];

    const taskDepartmentIds = tasks
      .filter((task) => task.project_id === project.id)
      .map((task) => task.department_id);

    const involvedDepartmentIds = project.department_ids && project.department_ids.length > 0
      ? project.department_ids
      : [project.department_id];

    // Union of involved departments + departments that already have tasks
    return Array.from(new Set([...involvedDepartmentIds, ...taskDepartmentIds].filter(Boolean)));
  };

  const taskBelongsToDepartment = (task: Task, departmentId: string) => {
    if (departmentId === 'all') return true;

    const taskAssigneeIds = [task.assigned_to, ...(task.assignees || [])].filter(Boolean) as string[];
    const assigneeInDept = taskAssigneeIds.some((uid) => {
      const user = users.find((u) => u.user_id === uid);
      if (!user) return false;

      return user.default_department_id === departmentId
        || (user.departmentMemberships || []).includes(departmentId);
    });

    return task.department_id === departmentId || assigneeInDept;
  };

  const filteredDepartmentOptions = selectedProject !== 'all'
    ? accessibleDepartments.filter((department) => {
        const project = projects.find((p) => p.id === selectedProject);
        return project ? getProjectRelevantDepartmentIds(project).includes(department.id) : true;
      })
    : accessibleDepartments;
  
  // Check if user is a project manager for any project in this department
  const isProjectManagerInDepartment = projects.some(p => 
    projectInDept(p, selectedDepartment) && 
    p.members?.some(m => m.user_id === currentUserId && m.role === 'manager')
  );
  
  // Can assign tasks if admin, dept admin, or project manager
  const canAssignTasks = isAdminOfSelectedDepartment || isProjectManagerInDepartment;
  const guestCanEdit = isExternalGuest && guestRole === 'editor';
  const canManageProjects = !isExternalGuest;
  const canCreateOrEditTasks = isExternalGuest ? guestCanEdit : true;
  const canReassignTasks = !isExternalGuest;

  // Filter users based on selected department (users in that department)
  const departmentUsers = users.filter(u => {
    if (isExternalGuest) return u.user_id === currentUserId;
    if (selectedDepartment === 'all') return true;
    // If system admin, department admin, or project manager, show all users in the department
    if (canAssignTasks) {
      return u.default_department_id === selectedDepartment || 
             (u.departmentMemberships && u.departmentMemberships.includes(selectedDepartment));
    }
    // Regular users only see themselves
    return u.user_id === currentUserId;
  });

  // For task assignment, admins and project managers can assign to any user in their departments
  const assignableUsers = isExternalGuest
    ? users.filter(u => u.user_id === currentUserId)
    : selectedDepartment === 'all'
    ? users
    : canAssignTasks 
    ? users.filter(u => u.default_department_id === selectedDepartment || (u.departmentMemberships && u.departmentMemberships.includes(selectedDepartment)))
    : users.filter(u => u.user_id === currentUserId);

  const assigneeSourceUsers = Array.from(
    new Map([...allProjectUsers, ...users].map((user) => [user.user_id, user])).values()
  );

  // Eligible users for task assignment:
  // - when a project is selected: only that project's members
  // - otherwise: users in the selected department
  const getEligibleAssignees = (deptId: string, projectId: string) => {
    const project = projectId ? projects.find(p => p.id === projectId) : null;
    const projectMemberIds = new Set((project?.members || []).map(m => m.user_id));
    const seen = new Set<string>();
    return assigneeSourceUsers.filter(u => {
      if (seen.has(u.user_id)) return false;
      const match = project
        ? projectMemberIds.has(u.user_id)
        : deptId === 'all' ? true : !!(
            (u.default_department_id && u.default_department_id === deptId)
            || ((u as any).departmentMemberships && (u as any).departmentMemberships.includes(deptId))
          );
      if (match) { seen.add(u.user_id); return true; }
      return false;
    });
  };

  // When "ALL" department is selected, use the first accessible department for forms
  const effectiveDeptId = selectedDepartment === 'all' ? (accessibleDepartments[0]?.id || '') : selectedDepartment;

  useEffect(() => {
    if (selectedProject === 'all' || selectedDepartment === 'all') return;

    const project = projects.find((p) => p.id === selectedProject);
    if (!project) return;

    if (selectedUser !== 'all') {
      const projectMemberIds = new Set((project.members || []).map((member) => member.user_id));
      if (!projectMemberIds.has(selectedUser)) {
        setSelectedUser('all');
      }
    }
  }, [selectedProject, projects, tasks, selectedDepartment, accessibleDepartments, selectedUser]);

  // Kanban columns based on groupBy mode
  type KanbanColumn = {
    id: string;
    key: string;
    name: string;
    color: string;
    matches: (task: Task) => boolean;
  };
  const kanbanColumns: KanbanColumn[] = (() => {
    if (kanbanGroupBy === 'department' && selectedProject !== 'all') {
      const project = projects.find(p => p.id === selectedProject);
      const deptIds = project ? getProjectRelevantDepartmentIds(project) : [];
      return deptIds
        .map((did) => {
          const dep = departments.find(d => d.id === did);
          if (!dep && !did) return null;
          return {
            id: `dept:${did}`,
            key: did,
            name: dep ? (dep as any).department_name : did,
            color: '#6366F1',
            matches: (task: Task) => taskBelongsToDepartment(task, did),
          } as KanbanColumn;
        })
        .filter(Boolean) as KanbanColumn[];
    }
    if (kanbanGroupBy === 'employee') {
      let userList: any[] = [];
      if (selectedProject !== 'all') {
        const project = projects.find(p => p.id === selectedProject);
        const memberIds = new Set((project?.members || []).map((m: any) => m.user_id));
        userList = assigneeSourceUsers.filter(u => memberIds.has(u.user_id));
      } else {
        userList = departmentUsers;
      }
      const cols: KanbanColumn[] = userList.map(u => ({
        id: `user:${u.user_id}`,
        key: u.user_id,
        name: u.user_name,
        color: '#10B981',
        matches: (task: Task) => task.assigned_to === u.user_id || (task.assignees || []).includes(u.user_id),
      }));
      cols.push({
        id: 'user:unassigned',
        key: 'unassigned',
        name: t.unassigned,
        color: '#9CA3AF',
        matches: (task: Task) => !task.assigned_to && !(task.assignees && task.assignees.length > 0),
      });
      return cols;
    }
    // default: by phase
    return activePhases.map((phase: any) => ({
      id: phase.phase_key,
      key: phase.phase_key,
      name: language === 'ar' ? (phase.phase_name_ar || phase.phase_name) : phase.phase_name,
      color: phase.phase_color,
      matches: (task: Task) => task.status === phase.phase_key,
    }));
  })();

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (selectedDepartment !== 'all') {
      if (!taskBelongsToDepartment(task, selectedDepartment)) return false;
    }
    if (!showArchived && task.is_archived) return false;
    if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    if (selectedProject !== 'all' && task.project_id !== selectedProject) return false;
    if (selectedUser !== 'all' && task.assigned_to !== selectedUser && !(task.assignees || []).includes(selectedUser)) return false;
    
    // Date filter - use start_date if available, otherwise created_at; for done tasks use updated_at
    if (dateMode !== 'all') {
      const dateField = task.start_date || (task.status === 'done' ? (task as any).updated_at : task.created_at);
      const taskDate = dateField ? parseISO(dateField) : null;
      if (!taskDate) return false;
      const now = new Date();
      let rangeStart: Date | null = null;
      let rangeEnd: Date | null = null;
      switch (dateMode) {
        case 'this_month':
          rangeStart = startOfMonth(now);
          rangeEnd = endOfMonth(now);
          break;
        case 'last_month': {
          const last = subMonths(now, 1);
          rangeStart = startOfMonth(last);
          rangeEnd = endOfMonth(last);
          break;
        }
        case 'select_month':
          if (selectedMonth) {
            const d = parse(selectedMonth + "-01", "yyyy-MM-dd", new Date());
            rangeStart = startOfMonth(d);
            rangeEnd = endOfMonth(d);
          }
          break;
        case 'specific_date':
          if (specificDate) {
            rangeStart = startOfDay(specificDate);
            rangeEnd = endOfDay(specificDate);
          }
          break;
        case 'date_range':
          if (dateFrom) rangeStart = startOfDay(parseISO(dateFrom));
          if (dateTo) rangeEnd = endOfDay(parseISO(dateTo));
          break;
      }
      if (rangeStart && taskDate < rangeStart) return false;
      if (rangeEnd && taskDate > rangeEnd) return false;
    }
    
    return true;
  }).sort((a, b) => {
    const dateA = a.start_date || a.created_at || '';
    const dateB = b.start_date || b.created_at || '';
    return dateA.localeCompare(dateB);
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      // Group by Department: dropping moves task to that department
      if (overId.startsWith('dept:')) {
        const newDeptId = overId.slice('dept:'.length);
        if (task.department_id === newDeptId) return;
        await supabase.from('tasks').update({ department_id: newDeptId }).eq('id', taskId);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, department_id: newDeptId } : t));
        toast({ title: language === 'ar' ? 'تم تحديث القسم' : 'Department updated' });
        return;
      }

      // Group by Employee: dropping reassigns task to that user (or unassigns)
      if (overId.startsWith('user:')) {
        const newUserId = overId.slice('user:'.length);
        if (newUserId === 'unassigned') {
          await supabase.from('task_assignees').delete().eq('task_id', taskId);
          await supabase.from('tasks').update({ assigned_to: null }).eq('id', taskId);
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigned_to: '', assignees: [] } : t));
          toast({ title: language === 'ar' ? 'تم إلغاء التعيين' : 'Unassigned' });
          return;
        }
        if (task.assigned_to === newUserId && (task.assignees || []).length <= 1) return;
        await supabase.from('task_assignees').delete().eq('task_id', taskId);
        await supabase.from('task_assignees').insert([{ task_id: taskId, user_id: newUserId }]);
        await supabase.from('tasks').update({ assigned_to: newUserId }).eq('id', taskId);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigned_to: newUserId, assignees: [newUserId] } : t));
        toast({ title: language === 'ar' ? 'تم تحديث المعين' : 'Assignee updated' });
        return;
      }

      // Default: phase grouping → update status
      const newStatus = overId;
      if (task.status === newStatus) return;
      await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast({ title: language === 'ar' ? 'تم تحديث الحالة' : 'Status updated' });

      // If task is marked as done, notify department admins
      if (newStatus === 'done') {
        const currentUser = users.find(u => u.user_id === currentUserId);
        try {
          await supabase.functions.invoke('send-task-notification', {
            body: {
              type: 'task_completed',
              taskId: task.id,
              taskTitle: task.title,
              departmentId: task.department_id,
              completedByUserId: currentUserId,
              completedByUserName: currentUser?.user_name || 'Unknown'
            }
          });
        } catch (notifyError) {
          console.error('Error sending task completion notification:', notifyError);
        }
      }
    } catch (error) {
      console.error('Error updating task on drag:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleSaveProject = async () => {
    const deptIds = projectForm.department_ids.length > 0
      ? projectForm.department_ids
      : (projectForm.department_id ? [projectForm.department_id] : []);
    if (!projectForm.name || deptIds.length === 0) {
      toast({ title: language === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', variant: 'destructive' });
      return;
    }

    try {
      const primaryDept = deptIds[0];
      const payload = {
        name: projectForm.name,
        description: projectForm.description || null,
        department_id: primaryDept,
        status: projectForm.status,
        start_date: projectForm.start_date ? format(projectForm.start_date, 'yyyy-MM-dd') : null,
        end_date: projectForm.end_date ? format(projectForm.end_date, 'yyyy-MM-dd') : null,
        created_by: currentUserId!
      };

      let projectId: string;

      if (editingProject) {
        await supabase.from('projects').update(payload).eq('id', editingProject.id);
        projectId = editingProject.id;

        // Delete existing project members
        await supabase.from('project_members').delete().eq('project_id', projectId);
      } else {
        const { data: newProject, error } = await supabase.from('projects').insert(payload).select().single();
        if (error) throw error;
        projectId = newProject.id;
      }

      // Sync project_departments join rows
      await supabase.from('project_departments').delete().eq('project_id', projectId);
      const pdInserts = deptIds.map(did => ({ project_id: projectId, department_id: did }));
      if (pdInserts.length > 0) {
        await supabase.from('project_departments').insert(pdInserts);
      }

      // Add project manager
      if (projectForm.manager_id) {
        await supabase.from('project_members').insert({
          project_id: projectId,
          user_id: projectForm.manager_id,
          role: 'manager'
        });
      }

      // Add project members
      if (projectForm.member_ids.length > 0) {
        const memberInserts = projectForm.member_ids
          .filter(id => id !== projectForm.manager_id) // Don't duplicate manager
          .map(userId => ({
            project_id: projectId,
            user_id: userId,
            role: 'member'
          }));
        if (memberInserts.length > 0) {
          await supabase.from('project_members').insert(memberInserts);
        }
      }

      toast({ title: language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully' });
      setProjectDialogOpen(false);
      resetProjectForm();
      fetchData(true);
    } catch (error) {
      console.error('Error saving project:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleSaveTask = async () => {
    if (!taskForm.title || !taskForm.department_id || taskForm.assigned_to.length === 0) {
      toast({ title: language === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields', variant: 'destructive' });
      return;
    }

    try {
      if (editingTask) {
        // When editing, only update the single task (use first user if array)
        const payload: Record<string, unknown> = {
          title: taskForm.title,
          description: taskForm.description || null,
          project_id: taskForm.project_id || null,
          department_id: taskForm.department_id,
          assigned_to: taskForm.assigned_to[0],
          status: taskForm.status,
          priority: taskForm.priority,
          dependency_task_id: taskForm.project_id && taskForm.dependency_task_id ? taskForm.dependency_task_id : null,
          is_milestone: taskForm.project_id ? taskForm.is_milestone : false,
          start_date: taskForm.start_date ? format(taskForm.start_date, 'yyyy-MM-dd') : null,
          deadline: taskForm.deadline ? taskForm.deadline.toISOString() : null,
          start_time: taskForm.start_time || null,
          end_time: taskForm.end_time || null,
          external_links: taskForm.external_links,
          file_attachments: taskForm.file_attachments as unknown as Json,
          video_attachments: taskForm.video_attachments as unknown as Json,
          wireframe_data: taskForm.wireframes as unknown as Json,
          figma_link: taskForm.figma_link || null,
          created_by: currentUserId!
        };
        // Only include seq_number if it was changed
        if (taskForm.seq_number !== null && taskForm.seq_number !== editingTask.seq_number) {
          payload.seq_number = taskForm.seq_number;
        }
        await supabase.from('tasks').update(payload).eq('id', editingTask.id);

        // Sync multi-assignees: replace existing rows with new selection
        await supabase.from('task_assignees').delete().eq('task_id', editingTask.id);
        if (taskForm.assigned_to.length > 0) {
          await supabase.from('task_assignees').insert(
            taskForm.assigned_to.map(uid => ({ task_id: editingTask.id, user_id: uid }))
          );
        }

        // If status changed to "done", notify department admins
        if (taskForm.status === 'done' && editingTask.status !== 'done') {
          const currentUser = users.find(u => u.user_id === currentUserId);
          try {
            await supabase.functions.invoke('send-task-notification', {
              body: {
                type: 'task_completed',
                taskId: editingTask.id,
                taskTitle: taskForm.title,
                departmentId: taskForm.department_id,
                completedByUserId: currentUserId,
                completedByUserName: currentUser?.user_name || 'Unknown'
              }
            });
          } catch (notifyError) {
            console.error('Error sending task completion notification:', notifyError);
          }
        }

        // If recurring was checked while editing, generate additional occurrence tasks
        if (taskForm.is_recurring && taskForm.recurrence_months.length > 0) {
          const dates = computeRecurringDates(taskForm.recurrence_year, taskForm.recurrence_months, taskForm.recurrence_weeks, taskForm.recurrence_day);
          for (const d of dates) {
            const monthLabel = d.toLocaleString(language === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' });
            const { data: newTask, error: recErr } = await supabase.from('tasks').insert({
              title: `${taskForm.title} - ${monthLabel}`,
              description: taskForm.description || null,
              project_id: taskForm.project_id || null,
              department_id: taskForm.department_id,
              assigned_to: taskForm.assigned_to[0],
              status: taskForm.status,
              priority: taskForm.priority,
              start_date: taskForm.start_date ? format(taskForm.start_date, 'yyyy-MM-dd') : null,
              deadline: d.toISOString(),
              start_time: taskForm.start_time || null,
              end_time: taskForm.end_time || null,
              external_links: taskForm.external_links,
              file_attachments: taskForm.file_attachments as unknown as Json,
              video_attachments: taskForm.video_attachments as unknown as Json,
              wireframe_data: taskForm.wireframes as unknown as Json,
              figma_link: taskForm.figma_link || null,
              created_by: currentUserId!,
            }).select().single();
            if (recErr) throw recErr;
            if (newTask && taskForm.assigned_to.length) {
              await supabase.from('task_assignees').insert(
                taskForm.assigned_to.map(uid => ({ task_id: newTask.id, user_id: uid }))
              );
            }
          }
        }
      } else {
        // Create ONE task with the first user as primary assignee, then add all assignees in join table
        const newTaskPayload = {
          title: taskForm.title,
          description: taskForm.description || null,
          project_id: taskForm.project_id || null,
          department_id: taskForm.department_id,
          assigned_to: taskForm.assigned_to[0],
          status: taskForm.status,
          priority: taskForm.priority,
          dependency_task_id: taskForm.project_id && taskForm.dependency_task_id ? taskForm.dependency_task_id : null,
          is_milestone: taskForm.project_id ? taskForm.is_milestone : false,
          start_date: taskForm.start_date ? format(taskForm.start_date, 'yyyy-MM-dd') : null,
          deadline: taskForm.deadline ? taskForm.deadline.toISOString() : null,
          start_time: taskForm.start_time || null,
          end_time: taskForm.end_time || null,
          external_links: taskForm.external_links,
          file_attachments: taskForm.file_attachments as unknown as Json,
          video_attachments: taskForm.video_attachments as unknown as Json,
          wireframe_data: taskForm.wireframes as unknown as Json,
          figma_link: taskForm.figma_link || null,
          created_by: currentUserId!
        };

        // Build list of (title, deadline) — single occurrence by default, or many for recurring
        const occurrences: { title: string; deadline: string | null }[] = [];
        if (taskForm.is_recurring && taskForm.recurrence_months.length > 0) {
          const dates = computeRecurringDates(taskForm.recurrence_year, taskForm.recurrence_months, taskForm.recurrence_weeks, taskForm.recurrence_day);
          if (dates.length === 0) {
            toast({ title: language === 'ar' ? 'لا توجد تواريخ متكررة صالحة' : 'No valid recurring dates', variant: 'destructive' });
            return;
          }
          for (const d of dates) {
            const monthLabel = d.toLocaleString(language === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' });
            occurrences.push({ title: `${taskForm.title} - ${monthLabel}`, deadline: d.toISOString() });
          }
        } else {
          occurrences.push({ title: taskForm.title, deadline: newTaskPayload.deadline });
        }

        for (const occ of occurrences) {
          const { data: insertedTask, error: insertError } = await supabase
            .from('tasks')
            .insert({ ...newTaskPayload, title: occ.title, deadline: occ.deadline })
            .select()
            .single();
          if (insertError) throw insertError;

          if (insertedTask) {
            await supabase.from('task_assignees').insert(
              taskForm.assigned_to.map(uid => ({ task_id: insertedTask.id, user_id: uid }))
            );
          }
        }

        // Send notification to each assigned user
        for (const userId of taskForm.assigned_to) {
          if (userId !== currentUserId) {
            // Create in-app notification
            await supabase.from('notifications').insert({
              user_id: userId,
              title: language === 'ar' ? 'مهمة جديدة' : 'New Task',
              message: language === 'ar' 
                ? `تم تعيين مهمة جديدة لك: ${taskForm.title}`
                : `A new task has been assigned to you: ${taskForm.title}`,
              type: 'task_assigned',
              is_read: false
            });

            // Send push notification
            try {
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  userId: userId,
                  title: language === 'ar' ? 'مهمة جديدة' : 'New Task',
                  body: language === 'ar' 
                    ? `تم تعيين مهمة جديدة لك: ${taskForm.title}`
                    : `A new task has been assigned to you: ${taskForm.title}`,
                  data: { type: 'task_assigned' }
                }
              });
            } catch (pushErr) {
              console.error('Push notification error:', pushErr);
            }
          }
        }
      }

      toast({ title: language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully' });
      setTaskDialogOpen(false);
      resetTaskForm();
      fetchData(true);
    } catch (error) {
      console.error('Error saving task:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!canCreateOrEditTasks) return;
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
      toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
      fetchData(true);
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleArchiveTask = async (taskId: string, archive: boolean) => {
    if (!canCreateOrEditTasks) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          is_archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          archived_by: archive ? currentUserId : null,
        } as any)
        .eq('id', taskId)
        .select();
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === taskId
        ? { ...t, is_archived: archive, archived_at: archive ? new Date().toISOString() : null }
        : t
      ));
      toast({ title: archive
        ? (language === 'ar' ? 'تمت الأرشفة' : 'Archived')
        : (language === 'ar' ? 'تم استعادة المهمة' : 'Task restored') });
    } catch (error) {
      console.error('Error archiving task:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };


  const handleAssignTask = async (taskId: string, userIds: string[]) => {
    if (!canReassignTasks) return;
    const finalIds = userIds.length > 0 ? userIds : [];
    // Optimistic local update so the popover stays open and UI updates immediately
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, assignees: finalIds, assigned_to: finalIds[0] ?? t.assigned_to }
      : t
    ));
    try {
      if (finalIds.length > 0) {
        const { error } = await supabase.from('tasks').update({ assigned_to: finalIds[0] }).eq('id', taskId).select();
        if (error) throw error;
      }
      await supabase.from('task_assignees').delete().eq('task_id', taskId);
      if (finalIds.length > 0) {
        await supabase.from('task_assignees').insert(finalIds.map(uid => ({ task_id: taskId, user_id: uid })));
      }
    } catch (error: any) {
      console.error('Error assigning task:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', description: error?.message, variant: 'destructive' });
      // Revert by silently refetching
      fetchData(true);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!canManageProjects) return;
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
      fetchData(true);
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({ title: language === 'ar' ? 'حدث خطأ' : 'Error occurred', variant: 'destructive' });
    }
  };

  const handleInlineCreateTask = async (phaseKey: string) => {
    if (!canCreateOrEditTasks) return;
    const title = inlineTitle.trim();
    if (!title || !currentUserId || !selectedDepartment || !effectiveDeptId) return;
    const assignees = inlineAssignees.length > 0 ? inlineAssignees : [currentUserId];
    setInlineSaving(true);
    try {
      const { data: insertedTask, error } = await supabase.from('tasks').insert({
        title,
        description: null,
        project_id: selectedProject !== 'all' ? selectedProject : null,
        department_id: effectiveDeptId,
        assigned_to: assignees[0],
        status: phaseKey,
        priority: 'medium',
        created_by: currentUserId,
      }).select().single();
      if (error) throw error;
      if (insertedTask) {
        await supabase.from('task_assignees').insert(
          assignees.map(uid => ({ task_id: insertedTask.id, user_id: uid }))
        );
      }
      setInlineTitle("");
      setInlineAssignees([]);
      setInlineCreatePhase(null);
      fetchData(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setInlineSaving(false);
    }
  };

  const handleEditTask = (task: Task) => {
    if (!canCreateOrEditTasks) return;
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id || '',
      department_id: task.department_id,
      assigned_to: task.assignees && task.assignees.length > 0 ? task.assignees : [task.assigned_to],
      status: task.status,
      priority: task.priority,
      dependency_task_id: task.dependency_task_id || '',
      is_milestone: task.is_milestone || false,
      start_date: task.start_date ? new Date(task.start_date) : null,
      deadline: task.deadline ? new Date(task.deadline) : null,
      start_time: task.start_time || '',
      end_time: task.end_time || '',
      external_links: task.external_links || [],
      file_attachments: task.file_attachments || [],
      video_attachments: task.video_attachments || [],
      seq_number: task.seq_number || null,
      wireframes: ((task as unknown as { wireframe_data?: Wireframe[] }).wireframe_data as Wireframe[]) || [],
      figma_link: ((task as unknown as { figma_link?: string }).figma_link) || '',
      is_recurring: false,
      recurrence_months: [],
      recurrence_weeks: [1],
      recurrence_day: 1,
      recurrence_year: new Date().getFullYear(),
    });
    setTaskDialogOpen(true);
  };

  const handleEditProject = async (project: Project) => {
    if (!canManageProjects) return;
    setEditingProject(project);
    const manager = project.members?.find(m => m.role === 'manager');
    const memberIds = project.members?.filter(m => m.role === 'member').map(m => m.user_id) || [];

    // Load all departments linked to this project
    const { data: pdRows } = await supabase
      .from('project_departments')
      .select('department_id')
      .eq('project_id', project.id);
    const deptIds = (pdRows && pdRows.length > 0)
      ? pdRows.map((r: { department_id: string }) => r.department_id)
      : [project.department_id];

    setProjectForm({
      name: project.name,
      description: project.description || '',
      department_id: project.department_id,
      department_ids: deptIds,
      status: project.status,
      start_date: project.start_date ? new Date(project.start_date) : null,
      end_date: project.end_date ? new Date(project.end_date) : null,
      manager_id: manager?.user_id || '',
      member_ids: memberIds
    });
    setProjectDialogOpen(true);
  };

  const resetProjectForm = () => {
    setEditingProject(null);
    setProjectForm({ name: '', description: '', department_id: effectiveDeptId, department_ids: effectiveDeptId ? [effectiveDeptId] : [], status: 'active', start_date: null, end_date: null, manager_id: '', member_ids: [] });
  };

  const resetTaskForm = () => {
    setEditingTask(null);
    setTaskForm({
      title: '', description: '', project_id: selectedProject !== 'all' ? selectedProject : '', department_id: effectiveDeptId, assigned_to: [],
      status: activePhases[0]?.phase_key || 'todo', priority: 'medium', dependency_task_id: '', is_milestone: false,
      start_date: null, deadline: null, start_time: '', end_time: '',
      external_links: [], file_attachments: [], video_attachments: [], seq_number: null, wireframes: [], figma_link: '',
      is_recurring: false, recurrence_months: [], recurrence_weeks: [1], recurrence_day: 1, recurrence_year: new Date().getFullYear(),
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
      
      let newFileList = taskForm.file_attachments;
      let newVideoList = taskForm.video_attachments;
      if (type === 'file') {
        newFileList = [...taskForm.file_attachments, ...uploadedFiles];
        setTaskForm(prev => ({ ...prev, file_attachments: newFileList }));
      } else {
        newVideoList = [...taskForm.video_attachments, ...uploadedFiles];
        setTaskForm(prev => ({ ...prev, video_attachments: newVideoList }));
      }

      // Auto-save to DB if editing an existing task
      if (editingTask?.id) {
        const { error: updErr } = await supabase
          .from('tasks')
          .update({
            file_attachments: newFileList as unknown as Json,
            video_attachments: newVideoList as unknown as Json,
          })
          .eq('id', editingTask.id);
        if (updErr) throw updErr;
        await fetchData(true);
      }

      toast({ title: language === 'ar' ? 'تم الرفع بنجاح' : 'Upload successful' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: language === 'ar' ? 'فشل الرفع' : 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (type: 'file' | 'video', index: number) => {
    const currentList = type === 'file' ? taskForm.file_attachments : taskForm.video_attachments;
    const newList = currentList.filter((_, idx) => idx !== index);
    if (type === 'file') setTaskForm(prev => ({ ...prev, file_attachments: newList }));
    else setTaskForm(prev => ({ ...prev, video_attachments: newList }));
    if (editingTask?.id) {
      const payload = type === 'file'
        ? { file_attachments: newList as unknown as Json }
        : { video_attachments: newList as unknown as Json };
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
      if (error) {
        toast({ title: language === 'ar' ? 'فشل الحذف' : 'Remove failed', variant: 'destructive' });
        return;
      }
      await fetchData(true);
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
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={isExternalGuest}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t.selectDepartment} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allDepartments}</SelectItem>
                  {filteredDepartmentOptions.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Import from Excel */}
              {!isExternalGuest && <Button variant="outline" size="sm" onClick={() => setExcelImportDialogOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />{language === 'ar' ? 'استيراد Excel' : 'Import Excel'}
              </Button>}

              {/* Send reminders */}
              {!isExternalGuest && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Bell className="h-4 w-4 mr-1" />{language === 'ar' ? 'تذكيرات المهام' : 'Task Reminders'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>{language === 'ar' ? 'إرسال تذكير الآن' : 'Send Reminder Now'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={async () => {
                      toast({ title: language === 'ar' ? 'جاري الإرسال...' : 'Sending...' });
                      const { data, error } = await supabase.functions.invoke('send-task-reminders', { body: { mode: 'daily_due' } });
                      if (error) toast({ title: language === 'ar' ? 'فشل الإرسال' : 'Failed', description: error.message, variant: 'destructive' });
                      else toast({ title: language === 'ar' ? `تم إرسال التذكير إلى ${data?.sent ?? 0} موظف` : `Reminder sent to ${data?.sent ?? 0} users` });
                    }}>
                      <Bell className="h-4 w-4 mr-2 text-blue-600" />
                      {language === 'ar' ? 'مهام مستحقة اليوم' : 'Tasks due today'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={async () => {
                      toast({ title: language === 'ar' ? 'جاري الإرسال...' : 'Sending...' });
                      const { data, error } = await supabase.functions.invoke('send-task-reminders', { body: { mode: 'end_of_day_overdue' } });
                      if (error) toast({ title: language === 'ar' ? 'فشل الإرسال' : 'Failed', description: error.message, variant: 'destructive' });
                      else toast({ title: language === 'ar' ? `تم إرسال التذكير إلى ${data?.sent ?? 0} موظف` : `Reminder sent to ${data?.sent ?? 0} users` });
                    }}>
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                      {language === 'ar' ? 'المهام المتأخرة' : 'Overdue tasks'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={selectedProject === 'all'}
                      onClick={async () => {
                      if (selectedProject === 'all') {
                        toast({ title: language === 'ar' ? 'يرجى اختيار مشروع أولاً' : 'Please select a project first', variant: 'destructive' });
                        return;
                      }
                      toast({ title: language === 'ar' ? 'جاري الإرسال...' : 'Sending...' });
                      const { data, error } = await supabase.functions.invoke('send-task-reminders', { body: { mode: 'all_scheduled', projectId: selectedProject } });
                      if (error) toast({ title: language === 'ar' ? 'فشل الإرسال' : 'Failed', description: error.message, variant: 'destructive' });
                      else toast({ title: language === 'ar' ? `تم إرسال التذكير إلى ${data?.sent ?? 0} موظف` : `Reminder sent to ${data?.sent ?? 0} users` });
                    }}>
                      <CalendarIcon className="h-4 w-4 mr-2 text-green-600" />
                      {language === 'ar' ? 'كل المهام المجدولة للمشروع المحدد' : 'All scheduled tasks (selected project)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={selectedProject === 'all'}
                      onClick={() => {
                        if (selectedProject === 'all') {
                          toast({ title: language === 'ar' ? 'يرجى اختيار مشروع أولاً' : 'Please select a project first', variant: 'destructive' });
                          return;
                        }
                        setAssignEmailRecipients([]);
                        setAssignEmailSearch('');
                        setAssignEmailDialogOpen(true);
                      }}
                    >
                      <Send className="h-4 w-4 mr-2 text-purple-600" />
                      {language === 'ar' ? 'إرسال مهام المشروع لموظفين محددين' : 'Send project tasks to selected employees'}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                      {language === 'ar'
                        ? 'الجدولة التلقائية: 8 صباحاً (مستحقة) و 6 مساءً (متأخرة) بتوقيت الرياض'
                        : 'Auto schedule: 8 AM (due) & 6 PM (overdue) KSA time'}
                    </DropdownMenuLabel>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Share current view */}
              {!isExternalGuest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShareRecipients([]); setShareNote(''); setShareSearch(''); setShareDialogOpen(true); }}
                  title={language === 'ar' ? 'مشاركة هذا العرض' : 'Share this view'}
                >
                  <Share2 className="h-4 w-4 mr-1" />{language === 'ar' ? 'مشاركة العرض' : 'Share View'}
                </Button>
              )}



              {/* Add buttons */}
              {canManageProjects && <Dialog open={projectDialogOpen} onOpenChange={(o) => { setProjectDialogOpen(o); if (!o) resetProjectForm(); }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />{t.addProject}</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                      <label className="text-sm font-medium">{t.department} * {projectForm.department_ids.length > 0 && <span className="text-xs text-muted-foreground">({projectForm.department_ids.length})</span>}</label>
                      <div className="border rounded-md p-2 max-h-[160px] overflow-y-auto space-y-1">
                        {accessibleDepartments.map(d => {
                          const checked = projectForm.department_ids.includes(d.id);
                          return (
                            <div key={d.id} className="flex items-center gap-2 py-0.5">
                              <Checkbox
                                id={`project-dept-${d.id}`}
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const next = c
                                    ? [...projectForm.department_ids, d.id]
                                    : projectForm.department_ids.filter(x => x !== d.id);
                                  setProjectForm({
                                    ...projectForm,
                                    department_ids: next,
                                    department_id: next[0] || '',
                                    manager_id: '',
                                    member_ids: []
                                  });
                                }}
                              />
                              <label htmlFor={`project-dept-${d.id}`} className="text-sm cursor-pointer">{d.department_name}</label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Start and End Date */}
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
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={projectForm.start_date || undefined} onSelect={(d) => setProjectForm({ ...projectForm, start_date: d || null })} />
                          </PopoverContent>
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
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={projectForm.end_date || undefined} onSelect={(d) => setProjectForm({ ...projectForm, end_date: d || null })} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Project Manager */}
                    <div>
                      <label className="text-sm font-medium">{t.projectManager}</label>
                      <Select value={projectForm.manager_id || 'none'} onValueChange={(v) => setProjectForm({ ...projectForm, manager_id: v === 'none' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder={t.selectManager} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.noManager}</SelectItem>
                          {users.filter(u =>
                            (u.default_department_id && projectForm.department_ids.includes(u.default_department_id)) ||
                            (u.departmentMemberships && u.departmentMemberships.some(d => projectForm.department_ids.includes(d)))
                          ).map(u => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Project Members */}
                    <div>
                      <label className="text-sm font-medium">{t.projectMembers}</label>
                      <div className="border rounded-md p-2 max-h-[150px] overflow-y-auto">
                        {Array.from(
                          new Map(
                            [...users, ...allProjectUsers]
                              .filter((u) =>
                                (((u.default_department_id && projectForm.department_ids.includes(u.default_department_id)) ||
                                  (u.departmentMemberships && u.departmentMemberships.some(d => projectForm.department_ids.includes(d)))) ||
                                  projectForm.member_ids.includes(u.user_id)) &&
                                u.user_id !== projectForm.manager_id
                              )
                              .map((u) => [u.user_id, u])
                          ).values()
                        ).map(u => (
                          <div key={u.user_id} className="flex items-center gap-2 py-1">
                            <Checkbox 
                              id={`project-member-${u.user_id}`}
                              checked={projectForm.member_ids.includes(u.user_id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setProjectForm({ ...projectForm, member_ids: Array.from(new Set([...projectForm.member_ids, u.user_id])) });
                                } else {
                                  setProjectForm({ ...projectForm, member_ids: projectForm.member_ids.filter(id => id !== u.user_id) });
                                }
                              }}
                            />
                            <label htmlFor={`project-member-${u.user_id}`} className="text-sm cursor-pointer">{u.user_name}</label>
                          </div>
                        ))}
                        {projectForm.member_ids.length > 0 && (
                          <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                            {projectForm.member_ids.map(userId => {
                              const user = allProjectUsers.find(u => u.user_id === userId) || users.find(u => u.user_id === userId);
                              return user ? (
                                <Badge key={userId} variant="secondary" className="text-xs">
                                  {user.user_name}
                                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setProjectForm({ ...projectForm, member_ids: projectForm.member_ids.filter(id => id !== userId) })} />
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {editingProject && (
                      <ProjectTaskPhases
                        projectId={editingProject.id}
                        language={language as 'en' | 'ar'}
                      />
                    )}

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
              </Dialog>}

              {canCreateOrEditTasks && <Dialog open={taskDialogOpen} onOpenChange={(o) => { setTaskDialogOpen(o); if (!o) resetTaskForm(); }}>
                 <Button size="sm" onClick={() => { resetTaskForm(); setTaskDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />{t.addTask}</Button>
                <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-y-auto">  
                  <DialogHeader>
                    <DialogTitle>{editingTask ? t.edit : t.addTask}</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="details" className="w-full">
                    <TabsList>
                      <TabsTrigger value="details">{language === 'ar' ? 'التفاصيل' : 'Details'}</TabsTrigger>
                      <TabsTrigger value="wireframe">{language === 'ar' ? 'مخطط/رسم' : 'Wireframe'}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="space-y-4 mt-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="col-span-3">
                        <label className="text-sm font-medium">{t.taskTitle} *</label>
                        <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
                      </div>
                      {editingTask && (
                        <div className="col-span-1">
                          <label className="text-sm font-medium">{t.seqNumber}</label>
                          <Input 
                            type="number" 
                            value={taskForm.seq_number || ''} 
                            onChange={(e) => setTaskForm({ ...taskForm, seq_number: e.target.value ? parseInt(e.target.value) : null })}
                            min={1}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t.description}</label>
                      <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">{t.department} *</label>
                        <Select value={taskForm.department_id} onValueChange={(v) => setTaskForm({ ...taskForm, department_id: v, assigned_to: [] })}>
                          <SelectTrigger><SelectValue placeholder={t.selectDepartment} /></SelectTrigger>
                          <SelectContent>
                            {accessibleDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">{t.projects}</label>
                        <Select value={taskForm.project_id || 'none'} onValueChange={(v) => setTaskForm({ ...taskForm, project_id: v === 'none' ? '' : v, dependency_task_id: '', is_milestone: false })}>
                          <SelectTrigger><SelectValue placeholder={t.selectProject} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t.noProject}</SelectItem>
                            {projects.filter(p => {
                              if (selectedProject !== 'all' && p.id !== selectedProject) return false;
                              if (!taskForm.department_id) return true;
                              const deptIds = (p as any).department_ids || [p.department_id];
                              return deptIds.includes(taskForm.department_id);
                            }).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t.assignedTo} * {!editingTask && <span className="text-xs text-muted-foreground">({language === 'ar' ? 'يمكن اختيار عدة مستخدمين' : 'Multi-select'})</span>}</label>
                      {editingTask ? (
                        // Single select for editing
                        <Select value={taskForm.assigned_to[0] || ''} onValueChange={(v) => setTaskForm({ ...taskForm, assigned_to: [v] })}>
                          <SelectTrigger><SelectValue placeholder={t.selectUser} /></SelectTrigger>
                          <SelectContent>
                             {(() => {
                               // Include department members + project members (across all project departments) when a project is selected
                               const deptUsers = getEligibleAssignees(taskForm.department_id, taskForm.project_id);
                              
                              // System admin or department admin: show all users in department
                              if (userAccess.isSystemAdmin || userAccess.adminDepartments.includes(taskForm.department_id)) {
                                return deptUsers;
                              }
                              
                              // Regular user with position level: show users with lower hierarchy (higher level number)
                              // Users without position_level are treated as lowest rank (can be assigned by anyone with a level)
                              if (currentUserPositionLevel !== null) {
                                return deptUsers.filter(u => 
                                  u.position_level === null || u.position_level > currentUserPositionLevel
                                );
                              }
                              
                              // User without position level: can only assign to themselves
                              return users.filter(u => u.user_id === currentUserId);
                            })().map(u => <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        // Multi-select for new task
                        <div className="border rounded-md p-2 max-h-[150px] overflow-y-auto">
                          {(() => {
                            // Include department members + project members (across all project departments) when a project is selected
                            const deptUsers = getEligibleAssignees(taskForm.department_id, taskForm.project_id);
                            
                            // System admin or department admin: show all users in department
                            if (userAccess.isSystemAdmin || userAccess.adminDepartments.includes(taskForm.department_id)) {
                              return deptUsers;
                            }
                            
                            // Regular user with position level: show users with lower hierarchy (higher level number)
                            // Users without position_level are treated as lowest rank (can be assigned by anyone with a level)
                            // ALWAYS include current user (self-assignment is always allowed)
                            if (currentUserPositionLevel !== null) {
                              return deptUsers.filter(u => 
                                u.user_id === currentUserId || // Always allow self-assignment
                                u.position_level === null || 
                                u.position_level > currentUserPositionLevel
                              );
                            }
                            
                            // User without position level: can only assign to themselves
                            return deptUsers.filter(u => u.user_id === currentUserId);
                          })().map(u => (
                            <div key={u.user_id} className="flex items-center gap-2 py-1">
                              <Checkbox 
                                id={`user-${u.user_id}`}
                                checked={taskForm.assigned_to.includes(u.user_id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setTaskForm({ ...taskForm, assigned_to: [...taskForm.assigned_to, u.user_id] });
                                  } else {
                                    setTaskForm({ ...taskForm, assigned_to: taskForm.assigned_to.filter(id => id !== u.user_id) });
                                  }
                                }}
                              />
                              <label htmlFor={`user-${u.user_id}`} className="text-sm cursor-pointer">{u.user_name}</label>
                            </div>
                          ))}
                          {taskForm.assigned_to.length > 0 && (
                            <div className="mt-2 pt-2 border-t flex flex-wrap gap-1">
                              {taskForm.assigned_to.map(userId => {
                              const user = allProjectUsers.find(u => u.user_id === userId) || users.find(u => u.user_id === userId);
                                return user ? (
                                  <Badge key={userId} variant="secondary" className="text-xs">
                                    {user.user_name}
                                    <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setTaskForm({ ...taskForm, assigned_to: taskForm.assigned_to.filter(id => id !== userId) })} />
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      )}
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">{t.startDate}</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="h-4 w-4 mr-2" />
                              {taskForm.start_date ? format(taskForm.start_date, 'PPP', { locale: language === 'ar' ? ar : undefined }) : t.selectDate}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={taskForm.start_date || undefined} onSelect={(d) => setTaskForm({ ...taskForm, start_date: d || null })} /></PopoverContent>
                        </Popover>
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

                    {/* Recurring task */}
                    {(

                      <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="is_recurring"
                            checked={taskForm.is_recurring}
                            onCheckedChange={(c) => setTaskForm({ ...taskForm, is_recurring: c === true })}
                          />
                          <label htmlFor="is_recurring" className="text-sm font-medium cursor-pointer">
                            {language === 'ar' ? 'مهمة متكررة' : 'Recurring task'}
                          </label>
                        </div>
                        {taskForm.is_recurring && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium">{language === 'ar' ? 'الأشهر' : 'Months'}</label>
                              <div className="grid grid-cols-6 gap-1 mt-1">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                                  const monthName = new Date(2000, m - 1, 1).toLocaleString(language === 'ar' ? 'ar' : 'en', { month: 'short' });
                                  const checked = taskForm.recurrence_months.includes(m);
                                  return (
                                    <button
                                      type="button"
                                      key={m}
                                      onClick={() => {
                                        setTaskForm({
                                          ...taskForm,
                                          recurrence_months: checked
                                            ? taskForm.recurrence_months.filter((x) => x !== m)
                                            : [...taskForm.recurrence_months, m].sort((a, b) => a - b),
                                        });
                                      }}
                                      className={`text-xs px-2 py-1 rounded border ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                                    >
                                      {monthName}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs font-medium">{language === 'ar' ? 'السنة' : 'Year'}</label>
                                <Input
                                  type="number"
                                  value={taskForm.recurrence_year}
                                  onChange={(e) => setTaskForm({ ...taskForm, recurrence_year: parseInt(e.target.value) || new Date().getFullYear() })}
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-xs font-medium">{language === 'ar' ? 'الأسابيع' : 'Weeks'}</label>
                                <div className="grid grid-cols-5 gap-1 mt-1">
                                  {[
                                    { val: 1, label: language === 'ar' ? '1' : '1st' },
                                    { val: 2, label: language === 'ar' ? '2' : '2nd' },
                                    { val: 3, label: language === 'ar' ? '3' : '3rd' },
                                    { val: 4, label: language === 'ar' ? '4' : '4th' },
                                    { val: 5, label: language === 'ar' ? 'آخر' : 'Last' },
                                  ].map((w) => {
                                    const checked = taskForm.recurrence_weeks.includes(w.val);
                                    return (
                                      <button
                                        type="button"
                                        key={w.val}
                                        onClick={() => {
                                          setTaskForm({
                                            ...taskForm,
                                            recurrence_weeks: checked
                                              ? taskForm.recurrence_weeks.filter((x) => x !== w.val)
                                              : [...taskForm.recurrence_weeks, w.val].sort((a, b) => a - b),
                                          });
                                        }}
                                        className={`text-xs px-2 py-1 rounded border ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                                      >
                                        {w.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium">{language === 'ar' ? 'اليوم' : 'Day'}</label>
                              <Select value={String(taskForm.recurrence_day)} onValueChange={(v) => setTaskForm({ ...taskForm, recurrence_day: parseInt(v) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {language === 'ar' ? ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][i] : d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {taskForm.recurrence_months.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {language === 'ar' ? 'سيتم إنشاء' : 'Will create'} {computeRecurringDates(taskForm.recurrence_year, taskForm.recurrence_months, taskForm.recurrence_weeks, taskForm.recurrence_day).length} {language === 'ar' ? 'مهام في:' : 'task(s) on:'}
                                <div className="mt-1">
                                  {computeRecurringDates(taskForm.recurrence_year, taskForm.recurrence_months, taskForm.recurrence_weeks, taskForm.recurrence_day).map((d) => (
                                    <Badge key={d.toISOString()} variant="outline" className="mr-1 mb-1">{d.toLocaleDateString()}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dependency and Milestone - only show when project is selected */}
                    {taskForm.project_id && (

                      <>
                        <div>
                          <label className="text-sm font-medium">{t.dependency}</label>
                          <Select 
                            value={taskForm.dependency_task_id || 'none'} 
                            onValueChange={(v) => setTaskForm({ ...taskForm, dependency_task_id: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger><SelectValue placeholder={t.selectDependency} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t.noDependency}</SelectItem>
                              {tasks
                                .filter(task => 
                                  task.project_id === taskForm.project_id && 
                                  task.id !== editingTask?.id
                                )
                                .map(task => (
                                  <SelectItem key={task.id} value={task.id}>
                                    {task.is_milestone && <Milestone className="h-3 w-3 inline mr-1 text-primary" />}
                                    {task.title}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        {taskForm.dependency_task_id && (() => {
                          const depTask = tasks.find(tk => tk.id === taskForm.dependency_task_id);
                          const depEnd = depTask?.deadline ? new Date(depTask.deadline) : null;
                          let currentDuration = '';
                          if (depEnd && taskForm.deadline) {
                            const start = taskForm.start_date || new Date(depEnd.getTime() + 86400000);
                            const diff = Math.round((taskForm.deadline.getTime() - start.getTime()) / 86400000) + 1;
                            if (diff > 0) currentDuration = String(diff);
                          }
                          return (
                            <div>
                              <label className="text-sm font-medium">
                                {language === 'ar' ? 'المدة (أيام) بعد المهمة المعتمد عليها' : 'Duration (days) after dependency'}
                              </label>
                              {depEnd ? (
                                <>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={currentDuration}
                                    onChange={(e) => {
                                      const days = parseInt(e.target.value);
                                      if (!days || days < 1 || !depEnd) return;
                                      const start = new Date(depEnd.getTime() + 86400000);
                                      const end = new Date(start.getTime() + (days - 1) * 86400000);
                                      setTaskForm({ ...taskForm, start_date: start, deadline: end });
                                    }}
                                    placeholder={language === 'ar' ? 'عدد الأيام' : 'Number of days'}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {language === 'ar' ? 'تنتهي المهمة المعتمد عليها في' : 'Dependency ends on'}: {depEnd.toLocaleDateString()}
                                  </p>
                                </>
                              ) : (
                                <p className="text-xs text-destructive">
                                  {language === 'ar' ? 'المهمة المعتمد عليها بدون تاريخ انتهاء' : 'Dependency task has no deadline'}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <Checkbox 
                            id="is_milestone" 
                            checked={taskForm.is_milestone}
                            onCheckedChange={(checked) => setTaskForm({ ...taskForm, is_milestone: checked === true })}
                          />
                          <label htmlFor="is_milestone" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                            <Milestone className="h-4 w-4 text-primary" />
                            {t.milestone}
                          </label>
                        </div>
                      </>
                    )}
                    
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          {taskForm.file_attachments.map((file, i) => {
                            const ft = (file.type || '').toLowerCase();
                            const nm = (file.name || '').toLowerCase();
                            const url = (file.url || '').toLowerCase();
                            const isImg = ft.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url) || /\.(png|jpe?g|gif|webp|svg)$/i.test(nm);
                            const isPdf = ft.includes('pdf') || /\.pdf($|\?)/i.test(url) || nm.endsWith('.pdf');
                            const canPreview = isImg || isPdf;
                            return (
                              <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors group">
                                <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                  {isImg ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                                </div>
                                <span className="flex-1 text-sm truncate" title={file.name}>{file.name}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {canPreview && (
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title={language === 'ar' ? 'معاينة' : 'Preview'}
                                      onClick={() => setPreviewFile({ url: file.url, name: file.name, type: file.type })}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title={language === 'ar' ? 'تنزيل' : 'Download'}
                                    onClick={() => downloadFile(file.url, file.name || 'attachment')}>
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title={language === 'ar' ? 'حذف' : 'Remove'}
                                    onClick={() => removeAttachment('file', i)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {editingTask && (
                      <TaskMessages
                        taskId={editingTask.id}
                        currentUserId={currentUserId}
                        users={(() => {
                          if (!editingTask.project_id) return users as any;
                          const project = projects.find(p => p.id === editingTask.project_id);
                          if (!project?.members?.length) return users as any;
                          const memberIds = new Set(project.members.map(member => member.user_id));
                          return allProjectUsers
                            .filter(user => memberIds.has(user.user_id))
                            .map(user => ({
                              user_id: user.user_id,
                              user_name: user.user_name,
                              avatar_url: user.avatar_url,
                            })) as any;
                        })()}
                        language={language as 'en' | 'ar'}
                      />
                    )}
                    </TabsContent>
                    <TabsContent value="wireframe" className="mt-4 space-y-4">
                      <div>
                        <label className="text-sm font-medium flex items-center gap-1">
                          <Link className="h-4 w-4" /> Figma Link
                        </label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            type="url"
                            value={taskForm.figma_link}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, figma_link: e.target.value }))}
                            placeholder="https://www.figma.com/file/..."
                          />
                          {taskForm.figma_link && (
                            <Button type="button" variant="outline" size="sm" asChild>
                              <a href={taskForm.figma_link} target="_blank" rel="noopener noreferrer">
                                {language === 'ar' ? 'فتح' : 'Open'}
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                      <WireframeBoard
                        value={taskForm.wireframes}
                        onChange={(next) => setTaskForm(prev => ({ ...prev, wireframes: next }))}
                        language={language as 'en' | 'ar'}
                      />
                    </TabsContent>
                  </Tabs>

                    <div className="flex gap-2 justify-end mt-4">
                      <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>{t.cancel}</Button>
                      <Button onClick={handleSaveTask}>{t.save}</Button>
                    </div>
                </DialogContent>
              </Dialog>}
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
              <Select value={selectedProject} onValueChange={(value) => {
                setSelectedProject(value);

                if (value === 'all') {
                  return;
                }

                const project = projects.find((p) => p.id === value);
                if (!project) return;

                if (selectedUser !== 'all') {
                  const projectMemberIds = new Set((project.members || []).map((member) => member.user_id));
                  if (!projectMemberIds.has(selectedUser)) {
                    setSelectedUser('all');
                  }
                }
              }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t.filterByProject} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allProjects}</SelectItem>
                {projects.filter(p => projectInDept(p, selectedDepartment)).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProject !== 'all' && (
              <InviteGuestButton
                projectId={selectedProject}
                projectName={projects.find(p => p.id === selectedProject)?.name || ''}
              />
            )}
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t.filterByUser} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allUsers}</SelectItem>
                {departmentUsers.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Kanban Group By */}
            <Select value={kanbanGroupBy} onValueChange={(v) => setKanbanGroupBy(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t.groupBy} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phase">{t.groupBy}: {t.groupByPhase}</SelectItem>
                {selectedProject !== 'all' && (
                  <SelectItem value="department">{t.groupBy}: {t.groupByDepartment}</SelectItem>
                )}
                <SelectItem value="employee">{t.groupBy}: {t.groupByEmployee}</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateMode} onValueChange={setDateMode}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={language === 'ar' ? 'فلتر التاريخ' : 'Date Filter'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All Dates'}</SelectItem>
                <SelectItem value="this_month">{language === 'ar' ? 'هذا الشهر' : 'This Month'}</SelectItem>
                <SelectItem value="last_month">{language === 'ar' ? 'الشهر الماضي' : 'Last Month'}</SelectItem>
                <SelectItem value="select_month">{language === 'ar' ? 'اختر شهر' : 'Select Month'}</SelectItem>
                <SelectItem value="specific_date">{language === 'ar' ? 'تاريخ محدد' : 'Specific Date'}</SelectItem>
                <SelectItem value="date_range">{language === 'ar' ? 'نطاق تاريخ' : 'Date Range'}</SelectItem>
              </SelectContent>
            </Select>

            {dateMode === "select_month" && (
              <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[160px]" />
            )}

            {dateMode === "specific_date" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !specificDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {specificDate ? format(specificDate, "yyyy-MM-dd") : (language === 'ar' ? 'اختر تاريخ' : 'Pick date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={specificDate} onSelect={setSpecificDate} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            )}

            {dateMode === "date_range" && (
              <>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px]" />
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px]" />
              </>
            )}

            {/* Include archive checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-archive"
                checked={showArchived}
                onCheckedChange={(c) => setShowArchived(!!c)}
              />
              <label htmlFor="include-archive" className="text-sm cursor-pointer">
                {t.includeArchive}
              </label>
            </div>
            

            
            {/* User avatars - shows project members when a project is selected, otherwise department users */}
            {(() => {
              const selectedProj = selectedProject !== 'all' ? projects.find(p => p.id === selectedProject) : null;
              const orderedProjectMembers = selectedProj?.members
                ? [...selectedProj.members].sort((a, b) => {
                    if (a.role !== b.role) return a.role === 'manager' ? -1 : 1;
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                  })
                : [];
              const managerIds = new Set(orderedProjectMembers.filter(m => m.role === 'manager').map(m => m.user_id));
              const projectMemberIds = orderedProjectMembers.map(m => m.user_id);
              const projectMemberOrder = new Map(projectMemberIds.map((userId, index) => [userId, index]));
              const rawUsers = selectedProj
                ? projectMemberIds
                    .map(memberId => allProjectUsers.find(u => u.user_id === memberId) || users.find(u => u.user_id === memberId))
                    .filter(Boolean)
                : departmentUsers;
              // Dedupe by user_id (same user may appear as both manager and member)
              const seen = new Set<string>();
              const uniqueUsers = rawUsers.filter((u): u is Profile => {
                if (!u || seen.has(u.user_id)) return false;
                seen.add(u.user_id);
                return true;
              });
              const avatarUsers = selectedProj
                ? [...uniqueUsers].sort(
                    (a, b) =>
                      (projectMemberOrder.get(a.user_id) ?? Number.MAX_SAFE_INTEGER) -
                      (projectMemberOrder.get(b.user_id) ?? Number.MAX_SAFE_INTEGER)
                  )
                : uniqueUsers;
              const managerRing = "ring-2 ring-amber-500 ring-offset-2 ring-offset-background";
              return (
                <div className="flex -space-x-2">
                  {avatarUsers.slice(0, 5).map(u => {
                    const isManager = managerIds.has(u.user_id);
                    return (
                      <Tooltip key={u.user_id}>
                        <TooltipTrigger asChild>
                          <Avatar className={cn("h-8 w-8 border-2 border-background cursor-pointer hover:z-10", isManager && managerRing)}>
                            {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.user_name} />}
                            <AvatarFallback className="text-xs bg-primary/10">
                              {u.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          {u.user_name}{isManager && (language === 'ar' ? ' (مدير المشروع)' : ' (Project Manager)')}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {avatarUsers.length > 5 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 border-2 border-background cursor-pointer">
                          <AvatarFallback className="text-xs bg-muted">+{avatarUsers.length - 5}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                          {avatarUsers.slice(5).map(u => {
                            const isManager = managerIds.has(u.user_id);
                            return (
                              <div key={u.user_id} className="flex items-center gap-2">
                                <Avatar className={cn("h-5 w-5", isManager && "ring-2 ring-amber-500")}>
                                  {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.user_name} />}
                                  <AvatarFallback className="text-[9px]">{u.user_name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{u.user_name}{isManager && (language === 'ar' ? ' (مدير)' : ' (Manager)')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })()}

            {/* Projects List - hidden when All Departments + All Projects to keep page fast */}
            {!(selectedDepartment === 'all' && selectedProject === 'all') && projects.filter(p => projectInDept(p, selectedDepartment) && (selectedProject === 'all' || p.id === selectedProject)).length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm text-muted-foreground">{t.projects}:</span>
                <div className="flex flex-wrap gap-2">
                  {projects.filter(p => projectInDept(p, selectedDepartment) && (selectedProject === 'all' || p.id === selectedProject)).map(project => (
                    <div key={project.id} className="inline-flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={cn("gap-1 pr-1", canManageProjects && "cursor-pointer hover:bg-muted")}
                        onClick={() => canManageProjects && handleEditProject(project)}
                      >
                        <FolderKanban className="h-3 w-3" />
                        {project.name}
                        {canManageProjects && <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 hover:bg-destructive/20 hover:text-destructive ml-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-primary border-primary/40 hover:bg-primary/10"
                        onClick={() => setSummaryProject(project)}
                        title={language === 'ar' ? 'الملخص' : 'Summary'}
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-xs font-medium">{language === 'ar' ? 'الملخص' : 'Summary'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-primary border-primary/40 hover:bg-primary/10"
                        onClick={() => navigate(`/project-gantt?projectId=${project.id}&departmentId=${selectedDepartment}`)}
                        title={language === 'ar' ? 'مخطط جانت' : 'Timeline'}
                      >
                        <GanttChart className="h-4 w-4" />
                        <span className="text-xs font-medium">{language === 'ar' ? 'الجدول الزمني' : 'Timeline'}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="p-4 relative" ref={kanbanWrapperRef}>
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {selectedDepartment === 'all' && selectedProject === 'all' && !forceLoadAll ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {language === 'ar' ? 'اختر قسماً أو مشروعاً' : 'Select a Department or Project'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                {language === 'ar'
                  ? 'لتحسين الأداء، يتم تحميل المهام فقط عند اختيار قسم أو مشروع محدد.'
                  : 'For better performance, tasks are loaded only when you pick a specific department or project.'}
              </p>
              <Button variant="outline" size="sm" onClick={() => setForceLoadAll(true)}>
                {language === 'ar' ? 'عرض كل المهام على أي حال' : 'Load all tasks anyway'}
              </Button>
            </div>
          ) : (
          <ScrollArea className="w-full" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex gap-4 pb-4" dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minWidth: kanbanColumns.length * 320 }}>

              {kanbanColumns.map((column) => {
                const phaseSearch = phaseSearchTerms[column.key] || '';
                const allPhaseTasks = filteredTasks.filter(t => {
                  if (!column.matches(t)) return false;
                  if (phaseSearch && !t.title.toLowerCase().includes(phaseSearch.toLowerCase()) && 
                      !(t.profiles?.user_name || '').toLowerCase().includes(phaseSearch.toLowerCase()) &&
                      !(t.projects?.name || '').toLowerCase().includes(phaseSearch.toLowerCase())) return false;
                  return true;
                });
                const limit = columnLimits[column.key] ?? DEFAULT_COLUMN_LIMIT;
                const phaseTasks = allPhaseTasks.slice(0, limit);
                const hasMore = allPhaseTasks.length > phaseTasks.length;
                const defaultStatusForColumn = kanbanGroupBy === 'phase' ? column.key : (activePhases[0]?.phase_key || 'todo');
                const defaultDeptForColumn = kanbanGroupBy === 'department' ? column.key : effectiveDeptId;
                const defaultAssigneesForColumn = kanbanGroupBy === 'employee' && column.key !== 'unassigned' ? [column.key] : [];
                return (
                  <DroppableColumn 
                    key={column.id} 
                    id={column.id}
                    className="w-[300px] shrink-0 rounded-xl bg-muted/30 p-3 transition-colors"
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: column.color }}
                      />
                      <span className="font-medium text-sm">
                        {column.name}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                        {phaseTasks.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title={t.addTask}
                        onClick={() => {
                          resetTaskForm();
                          setTaskForm(prev => ({
                            ...prev,
                            status: defaultStatusForColumn,
                            department_id: defaultDeptForColumn,
                            project_id: selectedProject !== 'all' ? selectedProject : prev.project_id,
                            assigned_to: defaultAssigneesForColumn.length ? defaultAssigneesForColumn : prev.assigned_to,
                          }));
                          setTaskDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Phase Search */}
                    <div className="relative mb-3 px-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input 
                        value={phaseSearch}
                        onChange={(e) => setPhaseSearchTerms(prev => ({ ...prev, [column.key]: e.target.value }))}
                        placeholder={t.search}
                        className="h-7 text-xs pl-7 bg-background/50"
                      />
                    </div>

                    {/* Tasks */}
                    <div className="space-y-2 min-h-[200px]">
                      {phaseTasks.map((task) => (
                        <DraggableTask key={task.id} task={task}>
                          {({ listeners }) => (
                            <Card className={cn("group transition-all bg-card", canCreateOrEditTasks && "hover:shadow-md cursor-pointer")} onDoubleClick={() => canCreateOrEditTasks && handleEditTask(task)}>
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <button {...listeners} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {canCreateOrEditTasks && <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleEditTask(task)}>
                                          <Edit className="h-3 w-3" />
                                        </Button>}
                                        {canCreateOrEditTasks && task.status === 'done' && !task.is_archived && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" title={language === 'ar' ? 'أرشفة' : 'Archive'} onClick={() => handleArchiveTask(task.id, true)}>
                                            <Archive className="h-3 w-3" />
                                          </Button>
                                        )}
                                        {canCreateOrEditTasks && task.is_archived && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" title={language === 'ar' ? 'استعادة' : 'Restore'} onClick={() => handleArchiveTask(task.id, false)}>
                                            <ArchiveRestore className="h-3 w-3" />
                                          </Button>
                                        )}
                                        {canCreateOrEditTasks && <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDeleteTask(task.id)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>}
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
                                      
                                      {/* Seq Number */}
                                      <span className="text-xs text-muted-foreground font-mono font-semibold">
                                        #{task.seq_number || task.id.slice(0, 6)}
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

                                      {/* Attachments count - clickable */}
                                      {(task.file_attachments?.length > 0 || task.external_links?.length > 0) && (
                                        <Badge 
                                          variant="outline" 
                                          className="text-xs h-5 gap-1 px-1.5 cursor-pointer hover:bg-primary/10 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTaskForAttachments(task);
                                            setAttachmentsDialogOpen(true);
                                          }}
                                        >
                                          <FileText className="h-3 w-3" />
                                          {(task.file_attachments?.length || 0) + (task.external_links?.length || 0)}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Assignees (multi) */}
                                    <div className="flex items-center gap-2 mt-3">
                                      <div className="flex -space-x-2">
                                        {(task.assignees && task.assignees.length > 0 ? task.assignees : [task.assigned_to]).slice(0, 3).map((uid, idx) => {
                                          const u = users.find(x => x.user_id === uid);
                                          return (
                                            <Avatar key={uid + idx} className="h-6 w-6 border-2 border-background">
                                              {u?.avatar_url && <AvatarImage src={u.avatar_url} alt={u.user_name} />}
                                              <AvatarFallback className="text-xs bg-primary/10">
                                                {u?.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                              </AvatarFallback>
                                            </Avatar>
                                          );
                                        })}
                                        {((task.assignees?.length || 0) > 3) && (
                                          <div className="h-6 w-6 rounded-full border-2 border-background bg-muted text-[10px] flex items-center justify-center">
                                            +{(task.assignees!.length - 3)}
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground truncate flex-1">
                                        {(() => {
                                          const ids = task.assignees && task.assignees.length > 0 ? task.assignees : [task.assigned_to];
                                          const names = ids.map(id => users.find(u => u.user_id === id)?.user_name).filter(Boolean) as string[];
                                          return names.length > 0 ? names.join(', ') : t.selectUser;
                                        })()}
                                      </span>
                                      {canReassignTasks && <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            title={language === 'ar' ? 'تعيين مستخدمين' : 'Assign users'}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <UserPlus className="h-3.5 w-3.5" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-0" align="end" onClick={(e) => e.stopPropagation()}>
                                          <div className="p-2 border-b text-xs font-medium">
                                            {language === 'ar' ? 'تعيين إلى' : 'Assign to (multiple)'}
                                          </div>
                                          <div className="max-h-64 overflow-y-auto p-1">
                                               {(() => {
                                                  const filtered = getEligibleAssignees(task.department_id, task.project_id || '');
                                                 return filtered.map(u => {
                                                  const current = task.assignees && task.assignees.length > 0 ? task.assignees : [task.assigned_to];
                                                  const checked = current.includes(u.user_id);
                                                  return (
                                                    <button
                                                      key={u.user_id}
                                                      type="button"
                                                      onClick={() => {
                                                        const next = checked
                                                          ? current.filter(id => id !== u.user_id)
                                                          : [...current, u.user_id];
                                                        handleAssignTask(task.id, next);
                                                      }}
                                                      className={cn(
                                                        "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted text-left",
                                                        checked && "bg-primary/10"
                                                      )}
                                                    >
                                                      <Checkbox checked={checked} className="pointer-events-none" />
                                                      <Avatar className="h-5 w-5">
                                                        {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.user_name} />}
                                                        <AvatarFallback className="text-[10px] bg-primary/10">
                                                          {u.user_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                                        </AvatarFallback>
                                                      </Avatar>
                                                      <span className="truncate">{u.user_name}</span>
                                                    </button>
                                                  );
                                                 });
                                               })()}
                                          </div>
                                        </PopoverContent>
                                      </Popover>}
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

                      {/* Inline Add Task at end of phase */}
                      {canCreateOrEditTasks && inlineCreatePhase === column.key ? (
                        <Card className="border-dashed border-primary/50">
                          <CardContent className="p-2 space-y-2">
                            <Input
                              autoFocus
                              value={inlineTitle}
                              onChange={(e) => setInlineTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleInlineCreateTask(defaultStatusForColumn); }
                                if (e.key === 'Escape') { setInlineCreatePhase(null); setInlineTitle(''); setInlineAssignees([]); }
                              }}
                              placeholder={language === 'ar' ? 'اسم المهمة...' : 'Task name...'}
                              className="h-8 text-sm"
                            />
                            <div className="flex items-center justify-between gap-1">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                                    <Users className="h-3.5 w-3.5" />
                                    {inlineAssignees.length > 0
                                      ? `${inlineAssignees.length}`
                                      : (language === 'ar' ? 'تعيين' : 'Assign')}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0" align="start">
                                  <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                    {getEligibleAssignees(selectedDepartment, selectedProject !== 'all' ? selectedProject : '')
                                      .map(u => {
                                        const checked = inlineAssignees.includes(u.user_id);
                                        return (
                                          <label key={u.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                            <Checkbox
                                              checked={checked}
                                              onCheckedChange={(v) => {
                                                setInlineAssignees(prev => v ? [...prev, u.user_id] : prev.filter(id => id !== u.user_id));
                                              }}
                                            />
                                            <span className="truncate">{u.user_name}</span>
                                          </label>
                                        );
                                      })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                  onClick={() => { setInlineCreatePhase(null); setInlineTitle(''); setInlineAssignees([]); }}>
                                  {t.cancel}
                                </Button>
                                <Button size="sm" className="h-7 px-2 text-xs"
                                  disabled={!inlineTitle.trim() || inlineSaving}
                                  onClick={() => handleInlineCreateTask(defaultStatusForColumn)}>
                                  {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : t.save}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : canCreateOrEditTasks ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 h-8"
                          onClick={() => {
                            setInlineCreatePhase(column.key);
                            setInlineTitle('');
                            setInlineAssignees(defaultAssigneesForColumn);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          {language === 'ar' ? 'إضافة مهمة' : 'Add task'}
                        </Button>
                      ) : null}
                      {hasMore && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-8 mt-2"
                          onClick={() => setColumnLimits(prev => ({ ...prev, [column.key]: (prev[column.key] ?? DEFAULT_COLUMN_LIMIT) + 25 }))}
                        >
                          {language === 'ar'
                            ? `تحميل المزيد (${allPhaseTasks.length - phaseTasks.length} متبقية)`
                            : `Load more (${allPhaseTasks.length - phaseTasks.length} remaining)`}
                        </Button>
                      )}
                    </div>
                  </DroppableColumn>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          )}

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

        {/* Floating scroll controls */}
        <div className="fixed bottom-6 right-6 z-40 grid grid-cols-3 gap-1 p-1 rounded-lg bg-background/90 backdrop-blur border shadow-lg">
          <div />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => scrollKanban('up')} aria-label="Scroll up"><ChevronUp className="h-4 w-4" /></Button>
          <div />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => scrollKanban('left')} aria-label="Scroll left"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => scrollKanban('down')} aria-label="Scroll down"><ChevronDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => scrollKanban('right')} aria-label="Scroll right"><ChevronRight className="h-4 w-4" /></Button>
        </div>
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

      {/* Attachments Dialog */}
      <Dialog open={attachmentsDialogOpen} onOpenChange={setAttachmentsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.files}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File Attachments */}
            {selectedTaskForAttachments?.file_attachments && selectedTaskForAttachments.file_attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {language === 'ar' ? 'الملفات المرفقة' : 'Attached Files'}
                </h4>
                <div className="space-y-2">
                  {selectedTaskForAttachments.file_attachments.map((file, index) => {
                    const ft = (file.type || '').toLowerCase();
                    const nm = (file.name || '').toLowerCase();
                    const url = (file.url || '').toLowerCase();
                    const isImg = ft.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url) || /\.(png|jpe?g|gif|webp|svg)$/i.test(nm);
                    const isPdf = ft.includes('pdf') || /\.pdf($|\?)/i.test(url) || nm.endsWith('.pdf');
                    const canPreview = isImg || isPdf;
                    return (
                      <div key={index} className="rounded-lg border bg-muted/30 overflow-hidden">
                        {isImg && (
                          <div
                            className="relative w-full bg-black/5 flex items-center justify-center cursor-pointer group"
                            style={{ maxHeight: 200 }}
                            onClick={() => setPreviewFile({ url: file.url, name: file.name, type: file.type })}
                          >
                            <img src={file.url} alt={file.name} className="max-h-[200px] object-contain" />
                          </div>
                        )}
                        {isPdf && (
                          <div
                            className="w-full cursor-pointer"
                            onClick={() => setPreviewFile({ url: file.url, name: file.name, type: file.type })}
                          >
                            <object data={file.url} type="application/pdf" className="w-full h-[200px] pointer-events-none">
                              <iframe
                                src={`https://docs.google.com/gview?url=${encodeURIComponent(file.url)}&embedded=true`}
                                title={file.name}
                                className="w-full h-[200px] pointer-events-none"
                              />
                            </object>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2 gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isImg ? <ImageIcon className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {canPreview && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewFile({ url: file.url, name: file.name, type: file.type })}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(file.url, file.name || 'attachment')}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* External Links */}
            {selectedTaskForAttachments?.external_links && selectedTaskForAttachments.external_links.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  {t.externalLinks}
                </h4>
                <div className="space-y-1">
                  {selectedTaskForAttachments.external_links.map((link, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => window.open(link, '_blank')}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Link className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm truncate">{link}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {language === 'ar' ? 'فتح' : 'Open'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Attachments */}
            {selectedTaskForAttachments?.video_attachments && selectedTaskForAttachments.video_attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  {t.videos}
                </h4>
                <div className="space-y-2">
                  {selectedTaskForAttachments.video_attachments.map((video, index) => (
                    <div key={index} className="rounded-lg border bg-muted/30 overflow-hidden">
                      <video src={video.url} controls className="w-full max-h-[260px] bg-black" />
                      <div className="flex items-center justify-between p-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Video className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-sm truncate">{video.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadFile(video.url, video.name || 'video')}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(!selectedTaskForAttachments?.file_attachments?.length && 
              !selectedTaskForAttachments?.external_links?.length && 
              !selectedTaskForAttachments?.video_attachments?.length) && (
              <p className="text-center text-muted-foreground py-4">
                {language === 'ar' ? 'لا توجد مرفقات' : 'No attachments'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-size file preview dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-2">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setPreviewFile(null)}
            className="absolute right-2 top-2 z-50 inline-flex h-8 w-8 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm ring-1 ring-border hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center overflow-auto">
            {previewFile && (() => {
              const ft = (previewFile.type || '').toLowerCase();
              const nm = (previewFile.name || '').toLowerCase();
              const url = previewFile.url.toLowerCase();
              const isPdf = ft.includes('pdf') || /\.pdf($|\?)/i.test(url) || nm.endsWith('.pdf');
              const isImg = ft.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(url) || /\.(png|jpe?g|gif|webp|svg)$/i.test(nm);
              

              if (isImg) {
                return (
                  <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[85vh] object-contain" />
                );
              }
              if (isPdf) {
                return <PdfPreview url={previewFile.url} name={previewFile.name} language={language} />;
              }
              // Office and other non-previewable types fall through to the download fallback below
              // Fallback: unknown type
              return (
                <div className="w-full flex flex-col items-center justify-center gap-3 py-10">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">{previewFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'لا يمكن معاينة هذا الملف' : 'Preview not available for this file type'}
                  </p>
                  <Button variant="default" size="sm" onClick={() => downloadFile(previewFile.url, previewFile.name)}>
                    <Download className="h-4 w-4 mr-1" />
                    {language === 'ar' ? 'تنزيل' : 'Download'}
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <ProjectTaskExcelImport
        open={excelImportDialogOpen}
        onOpenChange={setExcelImportDialogOpen}
        language={language}
        departments={accessibleDepartments}
        users={users}
        projects={projects.filter(p => projectInDept(p, selectedDepartment))}
        selectedDepartment={selectedDepartment}
        currentUserId={currentUserId || ""}
        onImportComplete={fetchData}
      />

      {summaryProject && (
        <ProjectSummaryDialogLoader
          project={summaryProject}
          onClose={() => setSummaryProject(null)}
          allProjectUsers={allProjectUsers}
          activePhases={activePhases}
          language={language as 'ar' | 'en'}
        />
      )}

      {/* Share View Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'مشاركة العرض الحالي' : 'Share Current View'}</DialogTitle>
          </DialogHeader>
          {(() => {
            const params = new URLSearchParams();
            if (selectedDepartment && selectedDepartment !== 'all') params.set('departmentId', selectedDepartment);
            if (selectedProject && selectedProject !== 'all') params.set('projectId', selectedProject);
            if (kanbanGroupBy && kanbanGroupBy !== 'phase') params.set('groupBy', kanbanGroupBy);
            params.set('collapseMenu', '1');
            const shareUrl = `https://edaraasus.com/projects-tasks?${params.toString()}`;
            const projectName = selectedProject !== 'all' ? (projects.find(p => p.id === selectedProject)?.name || '') : (language === 'ar' ? 'كل المشاريع' : 'All Projects');
            const departmentName = selectedDepartment !== 'all'
              ? (accessibleDepartments.find((d: any) => d.id === selectedDepartment)?.department_name || '')
              : (language === 'ar' ? 'كل الأقسام' : 'All Departments');
            const groupByLabel = ({ phase: t.groupByPhase, department: t.groupByDepartment, employee: t.groupByEmployee } as any)[kanbanGroupBy];

            const filteredUsers = users.filter((u: any) => {
              if (!shareSearch.trim()) return true;
              const q = shareSearch.toLowerCase();
              return (u.user_name || '').toLowerCase().includes(q);
            });

            const toggle = (uid: string) => setShareRecipients(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

            return (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <div><span className="text-muted-foreground">{language === 'ar' ? 'المشروع:' : 'Project:'}</span> <b>{projectName}</b></div>
                  <div><span className="text-muted-foreground">{language === 'ar' ? 'القسم:' : 'Department:'}</span> <b>{departmentName}</b></div>
                  <div><span className="text-muted-foreground">{language === 'ar' ? 'تجميع حسب:' : 'Group by:'}</span> <b>{groupByLabel}</b></div>
                </div>

                <div className="flex items-center gap-2">
                  <Input readOnly value={shareUrl} className="text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(shareUrl); toast({ title: language === 'ar' ? 'تم النسخ' : 'Link copied' }); }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <Textarea
                  placeholder={language === 'ar' ? 'ملاحظة اختيارية للمستلم...' : 'Optional note for recipients...'}
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  rows={2}
                />

                <div>
                  <label className="text-sm font-medium">{language === 'ar' ? 'إرسال إلى الموظفين' : 'Send to employees'}</label>
                  <Input
                    placeholder={language === 'ar' ? 'بحث عن موظف...' : 'Search employee...'}
                    value={shareSearch}
                    onChange={(e) => setShareSearch(e.target.value)}
                    className="mt-1 mb-2"
                  />
                  <ScrollArea className="h-56 rounded-md border p-2">
                    {filteredUsers.length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-4">
                        {language === 'ar' ? 'لا يوجد موظفون' : 'No employees'}
                      </div>
                    )}
                    {filteredUsers.map((u: any) => (
                      <label key={u.user_id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={shareRecipients.includes(u.user_id)}
                          onCheckedChange={() => toggle(u.user_id)}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={u.avatar_url || ''} />
                          <AvatarFallback className="text-[10px]">{(u.user_name || '?').slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{u.user_name}</span>
                      </label>
                    ))}
                  </ScrollArea>
                  <div className="text-xs text-muted-foreground mt-1">
                    {shareRecipients.length} {language === 'ar' ? 'محدد' : 'selected'}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button
                    disabled={shareRecipients.length === 0 || shareSending}
                    onClick={async () => {
                      setShareSending(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('share-projects-view', {
                          body: {
                            recipientUserIds: shareRecipients,
                            url: shareUrl,
                            note: shareNote,
                            senderUserId: currentUserId,
                            projectName,
                            departmentName,
                            groupBy: groupByLabel,
                          },
                        });
                        if (error) throw error;
                        toast({ title: language === 'ar' ? `تم الإرسال إلى ${data?.sent ?? 0} موظف` : `Sent to ${data?.sent ?? 0} users` });
                        setShareDialogOpen(false);
                      } catch (e: any) {
                        toast({ title: language === 'ar' ? 'فشل الإرسال' : 'Failed', description: e.message, variant: 'destructive' });
                      } finally {
                        setShareSending(false);
                      }
                    }}
                  >
                    {shareSending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    {language === 'ar' ? 'إرسال' : 'Send'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectsTasks;
