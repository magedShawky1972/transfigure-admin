import { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Milestone as MilestoneIcon, Calendar } from "lucide-react";
import { format, differenceInDays, addDays, startOfWeek, endOfWeek, eachWeekOfInterval, parseISO, isValid } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  deadline: string | null;
  dependency_task_id: string | null;
  is_milestone: boolean;
  assigned_to: string;
  profiles?: { user_name: string } | null;
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

const ProjectGantt = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('projectId');
  
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

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
      assignedTo: 'مسند إلى'
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
      assignedTo: 'Assigned to'
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
        // Fetch project
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name, start_date, end_date')
          .eq('id', projectId)
          .maybeSingle();

        if (projectData) {
          setProject(projectData);
        }

        // Fetch tasks for this project with profiles
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, status, priority, start_date, deadline, dependency_task_id, is_milestone, assigned_to')
          .eq('project_id', projectId)
          .order('start_date', { ascending: true, nullsFirst: false });

        if (tasksData) {
          // Fetch user profiles for assigned users
          const userIds = [...new Set(tasksData.map(t => t.assigned_to))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, user_name')
            .in('user_id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
          
          const tasksWithProfiles = tasksData.map(task => ({
            ...task,
            profiles: profileMap.get(task.assigned_to) || null
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

  // Calculate timeline range
  const { weeks, startDate, endDate, totalDays } = useMemo(() => {
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

    // Add buffer
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

  const getDependencyLine = (task: Task) => {
    if (!task.dependency_task_id) return null;
    
    const depTask = tasks.find(t => t.id === task.dependency_task_id);
    if (!depTask) return null;

    const depPos = getTaskPosition(depTask);
    const taskPos = getTaskPosition(task);

    if (!depPos || !taskPos) return null;

    return {
      fromLeft: depPos.left + depPos.width,
      toLeft: taskPos.left,
      fromIndex: tasks.indexOf(depTask),
      toIndex: tasks.indexOf(task)
    };
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
        <Button variant="outline" onClick={() => navigate('/projects-tasks')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.back}
        </Button>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {t.noProject}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects-tasks')}>
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

      {/* Gantt Chart */}
      <div className="container mx-auto p-4">
        <Card className="overflow-hidden">
          <ScrollArea className="w-full">
            <div className="min-w-[1200px]" ref={chartRef}>
              {/* Timeline Header */}
              <div className="flex border-b bg-muted/30">
                <div className="w-64 flex-shrink-0 p-3 border-r font-medium">
                  {language === 'ar' ? 'المهمة' : 'Task'}
                </div>
                <div className="flex-1 flex">
                  {weeks.map((week, i) => (
                    <div 
                      key={i} 
                      className="flex-1 min-w-[100px] p-2 text-center text-sm border-r last:border-r-0 bg-muted/20"
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
              </div>

              {/* Tasks */}
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {t.noTasks}
                </div>
              ) : (
                <div className="relative">
                  {tasks.map((task, index) => {
                    const position = getTaskPosition(task);
                    const depLine = getDependencyLine(task);

                    return (
                      <div 
                        key={task.id} 
                        className="flex border-b hover:bg-muted/10 transition-colors group"
                      >
                        {/* Task Info */}
                        <div className="w-64 flex-shrink-0 p-3 border-r">
                          <div className="flex items-center gap-2">
                            {task.is_milestone && (
                              <MilestoneIcon className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                            <span className="font-medium truncate text-sm" title={task.title}>
                              {task.title}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {task.profiles?.user_name || '-'}
                          </div>
                        </div>

                        {/* Gantt Bar Area */}
                        <div className="flex-1 relative h-14 flex items-center">
                          {/* Week grid lines */}
                          <div className="absolute inset-0 flex">
                            {weeks.map((_, i) => (
                              <div key={i} className="flex-1 border-r last:border-r-0 border-dashed border-muted-foreground/10" />
                            ))}
                          </div>

                          {/* Dependency arrow */}
                          {depLine && (
                            <svg 
                              className="absolute inset-0 pointer-events-none overflow-visible"
                              style={{ zIndex: 1 }}
                            >
                              <path
                                d={`M ${depLine.fromLeft}% 50% 
                                    L ${depLine.fromLeft + 1}% 50% 
                                    L ${depLine.fromLeft + 1}% ${depLine.fromIndex < depLine.toIndex ? '100%' : '0%'}
                                    L ${depLine.toLeft - 1}% ${depLine.fromIndex < depLine.toIndex ? '100%' : '0%'}
                                    L ${depLine.toLeft - 1}% 50%
                                    L ${depLine.toLeft}% 50%`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-muted-foreground/40"
                                strokeDasharray="4 2"
                              />
                              <polygon
                                points={`${depLine.toLeft}%,50% ${depLine.toLeft - 0.5}%,40% ${depLine.toLeft - 0.5}%,60%`}
                                fill="currentColor"
                                className="text-muted-foreground/40"
                              />
                            </svg>
                          )}

                          {/* Task Bar or Milestone */}
                          {position && (
                            task.is_milestone ? (
                              <div
                                className="absolute h-5 w-5 transform rotate-45 bg-primary border-2 border-primary-foreground shadow-md z-10"
                                style={{
                                  left: `${position.left}%`,
                                  top: '50%',
                                  marginTop: '-10px'
                                }}
                                title={`${task.title}\n${t.milestone}`}
                              />
                            ) : (
                              <div
                                className={cn(
                                  "absolute h-7 rounded-md shadow-sm z-10 flex items-center px-2 text-white text-xs font-medium transition-all",
                                  statusColors[task.status] || priorityColors[task.priority] || 'bg-primary',
                                  "hover:shadow-lg hover:scale-[1.02]"
                                )}
                                style={{
                                  left: `${position.left}%`,
                                  width: `${Math.max(position.width, 3)}%`,
                                  minWidth: '60px'
                                }}
                                title={`${task.title}\n${t.startDate}: ${task.start_date || t.noDateSet}\n${t.endDate}: ${task.deadline || t.noDateSet}`}
                              >
                                <span className="truncate">{task.title}</span>
                              </div>
                            )
                          )}

                          {/* No date indicator */}
                          {!position && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                {t.noDateSet}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
    </div>
  );
};

export default ProjectGantt;
