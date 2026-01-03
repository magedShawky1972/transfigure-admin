import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { FolderKanban, CheckCircle2, Clock, ListTodo, AlertCircle, Building2, X } from "lucide-react";
interface DepartmentStats {
  department_id: string;
  department_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
}

interface ProjectStats {
  id: string;
  name: string;
  department_name: string;
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
}

interface TaskDetail {
  id: string;
  title: string;
  status: string;
  priority: string;
  department_name: string;
  project_name: string;
  assigned_to_name: string;
  created_at: string;
}

const TaskDashboard = () => {
  const { language } = useLanguage();
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    reviewTasks: 0,
    todoTasks: 0,
    totalProjects: 0
  });
  
  // Drill-down state
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<'completed' | 'unfinished' | 'all' | null>(null);
  const [drilldownDepartment, setDrilldownDepartment] = useState<string | null>(null);
  const [drilldownTasks, setDrilldownTasks] = useState<TaskDetail[]>([]);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);

  const translations = {
    ar: {
      pageTitle: 'لوحة المهام والمشاريع',
      totalTasks: 'إجمالي المهام',
      completedTasks: 'المهام المكتملة',
      inProgressTasks: 'قيد التنفيذ',
      reviewTasks: 'قيد المراجعة',
      todoTasks: 'للتنفيذ',
      totalProjects: 'إجمالي المشاريع',
      departmentAnalysis: 'تحليل المهام حسب القسم',
      projectCompletion: 'نسبة إنجاز المشاريع',
      department: 'القسم',
      allDepartments: 'جميع الأقسام',
      completionRate: 'نسبة الإنجاز',
      tasks: 'المهام',
      completed: 'مكتمل',
      inProgress: 'قيد التنفيذ',
      review: 'مراجعة',
      todo: 'للتنفيذ',
      taskDistribution: 'توزيع المهام',
      departmentPerformance: 'أداء الأقسام',
      project: 'المشروع',
      noData: 'لا توجد بيانات',
      unfinishedTasks: 'المهام غير المكتملة',
      allTasks: 'جميع المهام',
      taskTitle: 'عنوان المهمة',
      status: 'الحالة',
      priority: 'الأولوية',
      assignedTo: 'المسند إليه',
      createdAt: 'تاريخ الإنشاء',
      viewCompleted: 'عرض المكتملة',
      viewUnfinished: 'عرض غير المكتملة',
      viewAll: 'عرض الكل',
      high: 'عالية',
      medium: 'متوسطة',
      low: 'منخفضة',
      close: 'إغلاق'
    },
    en: {
      pageTitle: 'Tasks & Projects Dashboard',
      totalTasks: 'Total Tasks',
      completedTasks: 'Completed Tasks',
      inProgressTasks: 'In Progress',
      reviewTasks: 'In Review',
      todoTasks: 'To Do',
      totalProjects: 'Total Projects',
      departmentAnalysis: 'Task Analysis by Department',
      projectCompletion: 'Project Completion Rate',
      department: 'Department',
      allDepartments: 'All Departments',
      completionRate: 'Completion Rate',
      tasks: 'Tasks',
      completed: 'Completed',
      inProgress: 'In Progress',
      review: 'Review',
      todo: 'To Do',
      taskDistribution: 'Task Distribution',
      departmentPerformance: 'Department Performance',
      project: 'Project',
      noData: 'No data available',
      unfinishedTasks: 'Unfinished Tasks',
      allTasks: 'All Tasks',
      taskTitle: 'Task Title',
      status: 'Status',
      priority: 'Priority',
      assignedTo: 'Assigned To',
      createdAt: 'Created At',
      viewCompleted: 'View Completed',
      viewUnfinished: 'View Unfinished',
      viewAll: 'View All',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      close: 'Close'
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#6b7280'];
  const STATUS_COLORS = {
    done: '#22c55e',
    in_progress: '#3b82f6',
    review: '#f59e0b',
    todo: '#6b7280'
  };

  // Drilldown function
  const openDrilldown = async (type: 'completed' | 'unfinished' | 'all', departmentId: string, departmentName: string) => {
    setDrilldownType(type);
    setDrilldownDepartment(departmentName);
    setDrilldownOpen(true);
    setLoadingDrilldown(true);
    
    try {
      let query = supabase
        .from('tasks')
        .select(`
          id, 
          title, 
          status, 
          priority,
          created_at,
          departments(department_name),
          projects(name),
          profiles:assigned_to(user_name)
        `)
        .eq('department_id', departmentId);
      
      if (type === 'completed') {
        query = query.eq('status', 'done');
      } else if (type === 'unfinished') {
        query = query.neq('status', 'done');
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const tasks: TaskDetail[] = (data || []).map((task: any) => ({
        id: task.id,
        title: task.title || '',
        status: task.status || '',
        priority: task.priority || 'medium',
        department_name: task.departments?.department_name || '',
        project_name: task.projects?.name || '-',
        assigned_to_name: task.profiles?.user_name || '-',
        created_at: task.created_at
      }));
      
      setDrilldownTasks(tasks);
    } catch (error) {
      console.error('Error fetching drilldown tasks:', error);
    } finally {
      setLoadingDrilldown(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      done: { label: t.completed, className: 'bg-green-500/10 text-green-600 border-green-500/20' },
      in_progress: { label: t.inProgress, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      review: { label: t.review, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
      todo: { label: t.todo, className: 'bg-gray-500/10 text-gray-600 border-gray-500/20' }
    };
    const v = variants[status] || variants.todo;
    return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      high: { label: t.high, className: 'bg-red-500/10 text-red-600 border-red-500/20' },
      medium: { label: t.medium, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
      low: { label: t.low, className: 'bg-green-500/10 text-green-600 border-green-500/20' }
    };
    const v = variants[priority] || variants.medium;
    return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [tasksRes, projectsRes, depsRes] = await Promise.all([
        supabase.from('tasks').select('id, status, department_id, project_id'),
        supabase.from('projects').select('id, name, department_id, departments(department_name)'),
        supabase.from('departments').select('id, department_name').eq('is_active', true)
      ]);

      const tasks = tasksRes.data || [];
      const projects = projectsRes.data || [];
      const departments = depsRes.data || [];

      // Calculate totals
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const reviewTasks = tasks.filter(t => t.status === 'review').length;
      const todoTasks = tasks.filter(t => t.status === 'todo').length;

      setTotals({
        totalTasks,
        completedTasks,
        inProgressTasks,
        reviewTasks,
        todoTasks,
        totalProjects: projects.length
      });

      // Calculate department stats
      const deptStats: DepartmentStats[] = departments.map(dept => {
        const deptTasks = tasks.filter(t => t.department_id === dept.id);
        const total = deptTasks.length;
        const completed = deptTasks.filter(t => t.status === 'done').length;
        const inProgress = deptTasks.filter(t => t.status === 'in_progress').length;
        const review = deptTasks.filter(t => t.status === 'review').length;
        const todo = deptTasks.filter(t => t.status === 'todo').length;

        return {
          department_id: dept.id,
          department_name: dept.department_name,
          total_tasks: total,
          completed_tasks: completed,
          in_progress_tasks: inProgress,
          review_tasks: review,
          todo_tasks: todo,
          completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      }).filter(d => d.total_tasks > 0);

      setDepartmentStats(deptStats);

      // Calculate project stats
      const projStats: ProjectStats[] = projects.map(proj => {
        const projTasks = tasks.filter(t => t.project_id === proj.id);
        const total = projTasks.length;
        const completed = projTasks.filter(t => t.status === 'done').length;

        return {
          id: proj.id,
          name: proj.name,
          department_name: (proj.departments as any)?.department_name || '',
          total_tasks: total,
          completed_tasks: completed,
          completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      }).filter(p => p.total_tasks > 0);

      setProjectStats(projStats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDepartmentStats = selectedDepartment === 'all' 
    ? departmentStats 
    : departmentStats.filter(d => d.department_id === selectedDepartment);

  const filteredProjectStats = selectedDepartment === 'all'
    ? projectStats
    : projectStats.filter(p => {
        const dept = departmentStats.find(d => d.department_name === p.department_name);
        return dept?.department_id === selectedDepartment;
      });

  // Pie chart data for task distribution
  const pieData = [
    { name: t.completed, value: totals.completedTasks, color: STATUS_COLORS.done },
    { name: t.inProgress, value: totals.inProgressTasks, color: STATUS_COLORS.in_progress },
    { name: t.review, value: totals.reviewTasks, color: STATUS_COLORS.review },
    { name: t.todo, value: totals.todoTasks, color: STATUS_COLORS.todo }
  ].filter(d => d.value > 0);

  // Bar chart data for department performance
  const barData = filteredDepartmentStats.map(dept => ({
    name: dept.department_name,
    [t.completed]: dept.completed_tasks,
    [t.inProgress]: dept.in_progress_tasks,
    [t.review]: dept.review_tasks,
    [t.todo]: dept.todo_tasks,
    completion: dept.completion_percentage
  }));

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className={`container mx-auto p-4 md:p-6 ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">{t.pageTitle}</h1>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t.allDepartments} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allDepartments}</SelectItem>
            {departmentStats.map(dept => (
              <SelectItem key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ListTodo className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.totalTasks}</p>
                <p className="text-xl font-bold">{totals.totalTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.completedTasks}</p>
                <p className="text-xl font-bold">{totals.completedTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.inProgressTasks}</p>
                <p className="text-xl font-bold">{totals.inProgressTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.reviewTasks}</p>
                <p className="text-xl font-bold">{totals.reviewTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <ListTodo className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.todoTasks}</p>
                <p className="text-xl font-bold">{totals.todoTasks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FolderKanban className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t.totalProjects}</p>
                <p className="text-xl font-bold">{totals.totalProjects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Task Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.taskDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>

        {/* Department Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.completionRate}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredDepartmentStats.length > 0 ? (
              <div className="space-y-4">
                {filteredDepartmentStats.map(dept => (
                  <div key={dept.department_id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{dept.department_name}</span>
                      <span className="text-muted-foreground">{dept.completion_percentage}%</span>
                    </div>
                    <div 
                      className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openDrilldown('all', dept.department_id, dept.department_name)}
                      title={t.viewAll}
                    >
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${dept.completion_percentage}%` }}
                      />
                    </div>
                    <div className="flex gap-3 text-xs">
                      <button
                        onClick={() => openDrilldown('completed', dept.department_id, dept.department_name)}
                        className="text-green-600 hover:underline cursor-pointer"
                      >
                        {t.completed}: {dept.completed_tasks}
                      </button>
                      <span className="text-muted-foreground">•</span>
                      <button
                        onClick={() => openDrilldown('unfinished', dept.department_id, dept.department_name)}
                        className="text-orange-600 hover:underline cursor-pointer"
                      >
                        {t.unfinishedTasks}: {dept.total_tasks - dept.completed_tasks}
                      </button>
                      <span className="text-muted-foreground">•</span>
                      <button
                        onClick={() => openDrilldown('all', dept.department_id, dept.department_name)}
                        className="text-blue-600 hover:underline cursor-pointer"
                      >
                        {t.allTasks}: {dept.total_tasks}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">{t.noData}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Performance Bar Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{t.departmentPerformance}</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey={t.completed} stackId="a" fill={STATUS_COLORS.done} />
                <Bar dataKey={t.inProgress} stackId="a" fill={STATUS_COLORS.in_progress} />
                <Bar dataKey={t.review} stackId="a" fill={STATUS_COLORS.review} />
                <Bar dataKey={t.todo} stackId="a" fill={STATUS_COLORS.todo} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">{t.noData}</div>
          )}
        </CardContent>
      </Card>

      {/* Project Completion Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.projectCompletion}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProjectStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-start p-2 font-medium">{t.project}</th>
                    <th className="text-start p-2 font-medium">{t.department}</th>
                    <th className="text-start p-2 font-medium">{t.tasks}</th>
                    <th className="text-start p-2 font-medium">{t.completed}</th>
                    <th className="text-start p-2 font-medium">{t.completionRate}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjectStats.map(proj => (
                    <tr key={proj.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{proj.name}</td>
                      <td className="p-2">{proj.department_name}</td>
                      <td className="p-2">{proj.total_tasks}</td>
                      <td className="p-2">{proj.completed_tasks}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${proj.completion_percentage}%` }}
                            />
                          </div>
                          <span className="text-xs">{proj.completion_percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">{t.noData}</div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown Dialog */}
      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {drilldownType === 'completed' ? t.completedTasks : 
                 drilldownType === 'unfinished' ? t.unfinishedTasks : t.allTasks}
                {drilldownDepartment && ` - ${drilldownDepartment}`}
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {loadingDrilldown ? (
              <div className="flex items-center justify-center h-32">Loading...</div>
            ) : drilldownTasks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.taskTitle}</TableHead>
                    <TableHead>{t.project}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.priority}</TableHead>
                    <TableHead>{t.assignedTo}</TableHead>
                    <TableHead>{t.createdAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownTasks.map(task => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.project_name}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                      <TableCell>{task.assigned_to_name}</TableCell>
                      <TableCell>{new Date(task.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground">{t.noData}</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskDashboard;
