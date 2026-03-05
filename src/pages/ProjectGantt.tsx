import { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Milestone as MilestoneIcon, Calendar, User, Flag, Clock, Link as LinkIcon, FileText } from "lucide-react";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, parseISO, isValid } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  deadline: string | null;
  dependency_task_id: string | null;
  is_milestone: boolean;
  assigned_to: string;
  created_at: string;
  external_links?: string[] | null;
  file_attachments?: { url: string; name: string; type: string }[] | null;
  profiles?: { user_name: string } | null;
  projects?: { name: string } | null;
  dependency_task?: { title: string } | null;
  total_time_minutes?: number;
}

interface Project {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

const priorityColors: Record<string, string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500'
};

const statusColors: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  done: 'bg-green-500'
};

const priorityLabels: Record<string, { en: string; ar: string }> = {
  low: { en: 'Low', ar: 'منخفضة' },
  medium: { en: 'Medium', ar: 'متوسطة' },
  high: { en: 'High', ar: 'عالية' },
  urgent: { en: 'Urgent', ar: 'عاجلة' }
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  todo: { en: 'To Do', ar: 'للتنفيذ' },
  in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
  review: { en: 'Review', ar: 'مراجعة' },
  done: { en: 'Done', ar: 'مكتمل' }
};

const ProjectGantt = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');
  const departmentId = searchParams.get('departmentId');
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const translations = {
    ar: {
      pageTitle: 'مخطط جانت للمشروع',
      back: 'العودة',
      noProject: 'لم يتم تحديد مشروع',
      noTasks: 'لا توجد مهام في هذا المشروع',
      week: 'أسبوع',
      milestone: 'علامة فارقة',
      dependency: 'تبعية',
      startDate: 'تاريخ البدء',
      endDate: 'تاريخ الانتهاء',
      noDateSet: 'لم يتم تحديد تاريخ',
      assignedTo: 'مسند إلى',
      status: 'الحالة',
      priority: 'الأولوية',
      description: 'الوصف',
      taskDetails: 'تفاصيل المهمة',
      totalTime: 'الوقت الكلي',
      hours: 'ساعة',
      minutes: 'دقيقة',
      links: 'الروابط',
      files: 'الملفات',
      dependsOn: 'يعتمد على',
      task: 'المهمة',
      createdAt: 'تاريخ الإنشاء'
    },
    en: {
      pageTitle: 'Project Gantt Chart',
      back: 'Back',
      noProject: 'No project selected',
      noTasks: 'No tasks in this project',
      week: 'Week',
      milestone: 'Milestone',
      dependency: 'Dependency',
      startDate: 'Start Date',
      endDate: 'End Date',
      noDateSet: 'No date set',
      assignedTo: 'Assigned to',
      status: 'Status',
      priority: 'Priority',
      description: 'Description',
      taskDetails: 'Task Details',
      totalTime: 'Total Time',
      hours: 'hours',
      minutes: 'minutes',
      links: 'Links',
      files: 'Files',
      dependsOn: 'Depends on',
      task: 'Task',
      createdAt: 'Created At'
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) {
        setLoading(false);
        return;
      }

      try {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name, start_date, end_date')
          .eq('id', projectId)
          .maybeSingle();

        if (projectData) setProject(projectData);

        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, description, status, priority, start_date, deadline, dependency_task_id, is_milestone, assigned_to, created_at, external_links, file_attachments')
          .eq('project_id', projectId)
          .order('start_date', { ascending: true, nullsFirst: false });

        if (tasksData) {
          const userIds = [...new Set(tasksData.map(t => t.assigned_to))];
          const depTaskIds = [...new Set(tasksData.map(t => t.dependency_task_id).filter(Boolean))] as string[];
          
          const [profilesRes, timeEntriesRes] = await Promise.all([
            supabase.from('profiles').select('user_id, user_name').in('user_id', userIds),
            supabase.from('task_time_entries').select('task_id, duration_minutes').in('task_id', tasksData.map(t => t.id))
          ]);

          const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
          
          // Calculate total time per task
          const timeMap = new Map<string, number>();
          (timeEntriesRes.data || []).forEach(te => {
            if (te.duration_minutes) {
              timeMap.set(te.task_id, (timeMap.get(te.task_id) || 0) + te.duration_minutes);
            }
          });

          // Build dependency task title map
          const depTasks = tasksData.filter(t => depTaskIds.includes(t.id));
          const depMap = new Map(depTasks.map(t => [t.id, { title: t.title }]));
          
          const tasksWithProfiles = tasksData.map(task => ({
            ...task,
            profiles: profileMap.get(task.assigned_to) || null,
            dependency_task: task.dependency_task_id ? depMap.get(task.dependency_task_id) || null : null,
            total_time_minutes: timeMap.get(task.id) || 0,
            file_attachments: Array.isArray(task.file_attachments) ? task.file_attachments as any : [],
            external_links: Array.isArray(task.external_links) ? task.external_links as string[] : []
          }));

          setTasks(tasksWithProfiles);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const { weeks, startDate, totalDays } = useMemo(() => {
    const tasksWithDates = tasks.filter(t => t.start_date || t.deadline);
    
    if (tasksWithDates.length === 0) {
      const today = new Date();
      const start = startOfWeek(today);
      const end = addDays(start, 28);
      return {
        weeks: eachWeekOfInterval({ start, end }),
        startDate: start,
        endDate: end,
        totalDays: 28
      };
    }

    let minDate = new Date();
    let maxDate = new Date();

    tasksWithDates.forEach(task => {
      if (task.start_date) {
        const d = parseISO(task.start_date);
        if (isValid(d) && d < minDate) minDate = d;
      }
      if (task.deadline) {
        const d = parseISO(task.deadline);
        if (isValid(d)) {
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        }
      }
      if (task.start_date && !task.deadline) {
        const d = addDays(parseISO(task.start_date), 7);
        if (isValid(d) && d > maxDate) maxDate = d;
      }
    });

    const start = startOfWeek(addDays(minDate, -7));
    const end = endOfWeek(addDays(maxDate, 7));
    
    return {
      weeks: eachWeekOfInterval({ start, end }),
      startDate: start,
      endDate: end,
      totalDays: differenceInDays(end, start)
    };
  }, [tasks]);

  const getTaskPosition = (task: Task) => {
    if (!task.start_date && !task.deadline) return null;

    const taskStart = task.start_date ? parseISO(task.start_date) : (task.deadline ? parseISO(task.deadline) : null);
    const taskEnd = task.deadline ? parseISO(task.deadline) : (task.start_date ? addDays(parseISO(task.start_date), 3) : null);

    if (!taskStart || !taskEnd || !isValid(taskStart) || !isValid(taskEnd)) return null;

    const leftOffset = differenceInDays(taskStart, startDate);
    const duration = Math.max(differenceInDays(taskEnd, taskStart), 1);

    const leftPercent = (leftOffset / totalDays) * 100;
    const widthPercent = (duration / totalDays) * 100;

    return { left: leftPercent, width: widthPercent };
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}${language === 'ar' ? 'س' : 'h'} ${m}${language === 'ar' ? 'د' : 'm'}`;
    return `${m} ${t.minutes}`;
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!projectId || !project) {
    return (
      <div className={`min-h-screen bg-background p-6 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
        <Button variant="outline" onClick={() => navigate(`/projects-tasks${departmentId ? `?departmentId=${departmentId}` : ''}${projectId ? `${departmentId ? '&' : '?'}projectId=${projectId}` : ''}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.back}
        </Button>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t.noProject}
        </div>
      </div>
    );
  }

  const TASK_COL_WIDTH = 240;
  const WEEK_COL_WIDTH = 120;
  const ROW_HEIGHT = 56;

  return (
    <div className={`min-h-screen bg-background ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projects-tasks?departmentId=${departmentId}&projectId=${projectId}`)}>
              <ArrowLeft className={cn("h-4 w-4", language === 'ar' ? 'ml-2 rotate-180' : 'mr-2')} />
              {t.back}
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">{project.name} - {t.pageTitle}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart with frozen row/column */}
      <div className="container mx-auto p-4">
        <Card className="overflow-hidden">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t.noTasks}
            </div>
          ) : (
            <div 
              ref={scrollContainerRef}
              className="overflow-auto max-h-[calc(100vh-200px)]"
              style={{ position: 'relative' }}
            >
              <div style={{ 
                minWidth: TASK_COL_WIDTH + (weeks.length * WEEK_COL_WIDTH),
                minHeight: ROW_HEIGHT + (tasks.length * ROW_HEIGHT)
              }}>
                {/* Frozen corner cell (Task header) - z-20 to be above both frozen row and column */}
                <div 
                  className="bg-muted/50 border-b border-r font-medium flex items-center px-3 text-sm"
                  style={{ 
                    position: 'sticky', 
                    top: 0, 
                    left: language === 'ar' ? 'auto' : 0,
                    right: language === 'ar' ? 0 : 'auto',
                    width: TASK_COL_WIDTH, 
                    height: ROW_HEIGHT, 
                    zIndex: 20 
                  }}
                >
                  {t.task}
                </div>

                {/* Frozen header row (weeks) */}
                <div 
                  className="flex"
                  style={{ 
                    position: 'sticky', 
                    top: 0, 
                    zIndex: 15,
                    marginTop: -ROW_HEIGHT,
                    marginLeft: language === 'ar' ? 0 : TASK_COL_WIDTH,
                    marginRight: language === 'ar' ? TASK_COL_WIDTH : 0,
                  }}
                >
                  {weeks.map((week, i) => (
                    <div 
                      key={i} 
                      className="border-b border-r last:border-r-0 bg-muted/30 flex flex-col items-center justify-center text-sm"
                      style={{ width: WEEK_COL_WIDTH, height: ROW_HEIGHT, flexShrink: 0 }}
                    >
                      <div className="font-medium">
                        {t.week} {format(week, 'w', { locale: language === 'ar' ? ar : undefined })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(week, 'MMM d', { locale: language === 'ar' ? ar : undefined })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Task rows */}
                {tasks.map((task, index) => {
                  const position = getTaskPosition(task);

                  return (
                    <div key={task.id} className="flex" style={{ height: ROW_HEIGHT }}>
                      {/* Frozen task name column */}
                      <div 
                        className="border-b border-r bg-card hover:bg-muted/20 transition-colors cursor-pointer flex flex-col justify-center px-3"
                        style={{ 
                          position: 'sticky', 
                          left: language === 'ar' ? 'auto' : 0,
                          right: language === 'ar' ? 0 : 'auto',
                          width: TASK_COL_WIDTH, 
                          minWidth: TASK_COL_WIDTH,
                          zIndex: 10,
                        }}
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="flex items-center gap-2">
                          {task.is_milestone && (
                            <MilestoneIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                          <span className="font-medium truncate text-sm" title={task.title}>
                            {task.title}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {task.profiles?.user_name || '-'}
                        </div>
                      </div>

                      {/* Gantt bar area */}
                      <div 
                        className="relative flex items-center border-b"
                        style={{ width: weeks.length * WEEK_COL_WIDTH, minWidth: weeks.length * WEEK_COL_WIDTH }}
                      >
                        {/* Week grid lines */}
                        <div className="absolute inset-0 flex">
                          {weeks.map((_, i) => (
                            <div key={i} className="border-r last:border-r-0 border-dashed border-muted-foreground/10" style={{ width: WEEK_COL_WIDTH, flexShrink: 0 }} />
                          ))}
                        </div>

                        {/* Task Bar or Milestone */}
                        {position && (
                          task.is_milestone ? (
                            <div
                              className="absolute h-5 w-5 transform rotate-45 bg-primary border-2 border-primary-foreground shadow-md z-[5] cursor-pointer hover:scale-110 transition-transform"
                              style={{
                                left: `${position.left}%`,
                                top: '50%',
                                marginTop: '-10px'
                              }}
                              title={`${task.title}\n${t.milestone}`}
                              onClick={() => handleTaskClick(task)}
                            />
                          ) : (
                            <div
                              className={cn(
                                "absolute h-7 rounded-md shadow-sm z-[5] flex items-center px-2 text-white text-xs font-medium transition-all cursor-pointer",
                                statusColors[task.status] || priorityColors[task.priority] || 'bg-primary',
                                "hover:shadow-lg hover:scale-[1.02]"
                              )}
                              style={{
                                left: `${position.left}%`,
                                width: `${Math.max(position.width, 3)}%`,
                                minWidth: '60px'
                              }}
                              title={`${task.title}\n${t.startDate}: ${task.start_date || t.noDateSet}\n${t.endDate}: ${task.deadline || t.noDateSet}`}
                              onClick={() => handleTaskClick(task)}
                            >
                              <span className="truncate">{task.title}</span>
                            </div>
                          )
                        )}

                        {/* No date indicator */}
                        {!position && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Badge variant="outline" className="text-xs text-muted-foreground cursor-pointer" onClick={() => handleTaskClick(task)}>
                              {t.noDateSet}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-400" />
            <span>{language === 'ar' ? 'للتنفيذ' : 'To Do'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500" />
            <span>{language === 'ar' ? 'مراجعة' : 'Review'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>{language === 'ar' ? 'مكتمل' : 'Done'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rotate-45 bg-primary border" />
            <span>{t.milestone}</span>
          </div>
        </div>
      </div>

      {/* Task Detail Drill-Down Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.is_milestone && <MilestoneIcon className="h-5 w-5 text-primary" />}
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {/* Status & Priority */}
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("text-white", statusColors[selectedTask.status] || 'bg-muted')}>
                  {statusLabels[selectedTask.status]?.[language === 'ar' ? 'ar' : 'en'] || selectedTask.status}
                </Badge>
                <Badge className={cn("text-white", priorityColors[selectedTask.priority] || 'bg-muted')}>
                  <Flag className="h-3 w-3 mr-1" />
                  {priorityLabels[selectedTask.priority]?.[language === 'ar' ? 'ar' : 'en'] || selectedTask.priority}
                </Badge>
                {selectedTask.is_milestone && (
                  <Badge variant="outline" className="border-primary text-primary">
                    <MilestoneIcon className="h-3 w-3 mr-1" />
                    {t.milestone}
                  </Badge>
                )}
              </div>

              {/* Assigned To */}
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t.assignedTo}:</span>
                <span className="font-medium">{selectedTask.profiles?.user_name || '-'}</span>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground block text-xs">{t.startDate}</span>
                    <span className="font-medium">
                      {selectedTask.start_date 
                        ? format(parseISO(selectedTask.start_date), 'PPP', { locale: language === 'ar' ? ar : undefined }) 
                        : t.noDateSet}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground block text-xs">{t.endDate}</span>
                    <span className="font-medium">
                      {selectedTask.deadline 
                        ? format(parseISO(selectedTask.deadline), 'PPP', { locale: language === 'ar' ? ar : undefined }) 
                        : t.noDateSet}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Time */}
              {selectedTask.total_time_minutes > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t.totalTime}:</span>
                  <span className="font-medium">{formatDuration(selectedTask.total_time_minutes)}</span>
                </div>
              )}

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">{t.description}</h4>
                  <p className="text-sm bg-muted/30 rounded-md p-3">{selectedTask.description}</p>
                </div>
              )}

              {/* Dependency */}
              {selectedTask.dependency_task && (
                <div className="flex items-center gap-2 text-sm">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t.dependsOn}:</span>
                  <Badge variant="outline">{selectedTask.dependency_task.title}</Badge>
                </div>
              )}

              {/* External Links */}
              {selectedTask.external_links && selectedTask.external_links.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">{t.links}</h4>
                  <div className="space-y-1">
                    {selectedTask.external_links.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />
                        <span className="truncate">{link}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* File Attachments */}
              {selectedTask.file_attachments && selectedTask.file_attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">{t.files}</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.file_attachments.map((file, i) => (
                      <a key={i} href={file.url} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
                          <FileText className="h-3 w-3" />
                          {file.name}
                        </Badge>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Created At */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {t.createdAt}: {format(parseISO(selectedTask.created_at), 'PPP', { locale: language === 'ar' ? ar : undefined })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectGantt;
