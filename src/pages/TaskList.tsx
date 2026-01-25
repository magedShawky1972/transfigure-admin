import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Search, Edit, Trash2, CalendarIcon, Loader2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

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
  created_at: string;
  seq_number?: number;
  projects?: { name: string } | null;
  departments?: { department_name: string };
  profiles?: { user_name: string };
}

interface Project {
  id: string;
  name: string;
}

interface Department {
  id: string;
  department_name: string;
}

interface Profile {
  user_id: string;
  user_name: string;
}

const TaskList = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/task-list");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    project_id: "",
    department_id: "",
    assigned_to: "",
    status: "pending",
    priority: "medium",
    start_date: null as Date | null,
    deadline: null as Date | null,
  });
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const statusOptions = [
    { value: "pending", label: language === "ar" ? "قيد الانتظار" : "Pending" },
    { value: "in_progress", label: language === "ar" ? "قيد التنفيذ" : "In Progress" },
    { value: "completed", label: language === "ar" ? "مكتمل" : "Completed" },
    { value: "cancelled", label: language === "ar" ? "ملغي" : "Cancelled" },
  ];

  const priorityOptions = [
    { value: "low", label: language === "ar" ? "منخفض" : "Low" },
    { value: "medium", label: language === "ar" ? "متوسط" : "Medium" },
    { value: "high", label: language === "ar" ? "عالي" : "High" },
    { value: "urgent", label: language === "ar" ? "عاجل" : "Urgent" },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, projectsRes, departmentsRes, profilesRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, projects(name), departments(department_name)")
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("id, name").order("name"),
        supabase.from("departments").select("id, department_name").eq("is_active", true).order("department_name"),
        supabase.from("profiles").select("user_id, user_name").eq("is_active", true).order("user_name"),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      // Map tasks with profile names
      const profilesMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.user_name]));
      const tasksWithProfiles = (tasksRes.data || []).map(task => ({
        ...task,
        profiles: task.assigned_to ? { user_name: profilesMap.get(task.assigned_to) || "-" } : undefined
      }));
      setTasks(tasksWithProfiles as Task[]);
      setProjects(projectsRes.data || []);
      setDepartments(departmentsRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: language === "ar" ? "حدث خطأ" : "Error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [language, toast]);

  useEffect(() => {
    if (hasAccess) {
      fetchData();
    }
  }, [hasAccess, fetchData]);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      project_id: task.project_id || "",
      department_id: task.department_id,
      assigned_to: task.assigned_to,
      status: task.status,
      priority: task.priority,
      start_date: task.start_date ? new Date(task.start_date) : null,
      deadline: task.deadline ? new Date(task.deadline) : null,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    if (!editForm.title.trim()) {
      toast({
        title: language === "ar" ? "العنوان مطلوب" : "Title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          project_id: editForm.project_id || null,
          department_id: editForm.department_id,
          assigned_to: editForm.assigned_to,
          status: editForm.status,
          priority: editForm.priority,
          start_date: editForm.start_date ? format(editForm.start_date, "yyyy-MM-dd") : null,
          deadline: editForm.deadline ? format(editForm.deadline, "yyyy-MM-dd") : null,
        })
        .eq("id", editingTask.id);

      if (error) throw error;

      toast({ title: language === "ar" ? "تم التحديث بنجاح" : "Updated successfully" });
      setEditDialogOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: language === "ar" ? "حدث خطأ أثناء التحديث" : "Error updating task",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskToDelete.id);
      if (error) throw error;

      toast({ title: language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully" });
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: language === "ar" ? "حدث خطأ أثناء الحذف" : "Error deleting task",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: language === "ar" ? "قيد الانتظار" : "Pending", variant: "secondary" },
      in_progress: { label: language === "ar" ? "قيد التنفيذ" : "In Progress", variant: "default" },
      completed: { label: language === "ar" ? "مكتمل" : "Completed", variant: "outline" },
      cancelled: { label: language === "ar" ? "ملغي" : "Cancelled", variant: "destructive" },
    };
    const config = statusConfig[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { label: string; className: string }> = {
      low: { label: language === "ar" ? "منخفض" : "Low", className: "bg-green-100 text-green-800" },
      medium: { label: language === "ar" ? "متوسط" : "Medium", className: "bg-yellow-100 text-yellow-800" },
      high: { label: language === "ar" ? "عالي" : "High", className: "bg-orange-100 text-orange-800" },
      urgent: { label: language === "ar" ? "عاجل" : "Urgent", className: "bg-red-100 text-red-800" },
    };
    const config = priorityConfig[priority] || { label: priority, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === "all" || task.status === filterStatus;
    const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
    const matchesProject =
      filterProject === "all" ||
      (filterProject === "none" && !task.project_id) ||
      task.project_id === filterProject;
    const matchesDepartment = filterDepartment === "all" || task.department_id === filterDepartment;

    return matchesSearch && matchesStatus && matchesPriority && matchesProject && matchesDepartment;
  });

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="container mx-auto p-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-6 w-6" />
            {language === "ar" ? "قائمة المهام" : "Task List"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === "ar" ? "بحث..." : "Search..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "الحالة" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "جميع الحالات" : "All Statuses"}</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "الأولوية" : "Priority"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "جميع الأولويات" : "All Priorities"}</SelectItem>
                {priorityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "المشروع" : "Project"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "جميع المشاريع" : "All Projects"}</SelectItem>
                <SelectItem value="none">{language === "ar" ? "بدون مشروع" : "No Project"}</SelectItem>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "القسم" : "Department"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "جميع الأقسام" : "All Departments"}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.department_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "#" : "#"}</TableHead>
                    <TableHead>{language === "ar" ? "العنوان" : "Title"}</TableHead>
                    <TableHead>{language === "ar" ? "المشروع" : "Project"}</TableHead>
                    <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                    <TableHead>{language === "ar" ? "المسؤول" : "Assigned To"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "الأولوية" : "Priority"}</TableHead>
                    <TableHead>{language === "ar" ? "الموعد النهائي" : "Deadline"}</TableHead>
                    <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد مهام" : "No tasks found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTasks.map((task, index) => (
                      <TableRow key={task.id}>
                        <TableCell>{task.seq_number || index + 1}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{task.title}</TableCell>
                        <TableCell>
                          {task.projects?.name || (
                            <span className="text-muted-foreground italic">
                              {language === "ar" ? "بدون مشروع" : "No Project"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{task.departments?.department_name || "-"}</TableCell>
                        <TableCell>{task.profiles?.user_name || "-"}</TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                        <TableCell>
                          {task.deadline
                            ? format(new Date(task.deadline), "dd/MM/yyyy", {
                                locale: language === "ar" ? ar : undefined,
                              })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(task)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(task)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground">
            {language === "ar"
              ? `إجمالي المهام: ${filteredTasks.length}`
              : `Total tasks: ${filteredTasks.length}`}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل المهمة" : "Edit Task"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{language === "ar" ? "العنوان" : "Title"} *</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{language === "ar" ? "المشروع" : "Project"}</Label>
                <Select
                  value={editForm.project_id || "none"}
                  onValueChange={(val) => setEditForm({ ...editForm, project_id: val === "none" ? "" : val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === "ar" ? "بدون مشروع" : "No Project"}</SelectItem>
                    {projects.map((proj) => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{language === "ar" ? "القسم" : "Department"} *</Label>
                <Select
                  value={editForm.department_id}
                  onValueChange={(val) => setEditForm({ ...editForm, department_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.department_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{language === "ar" ? "المسؤول" : "Assigned To"} *</Label>
                <Select
                  value={editForm.assigned_to}
                  onValueChange={(val) => setEditForm({ ...editForm, assigned_to: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.user_id} value={profile.user_id}>
                        {profile.user_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{language === "ar" ? "الأولوية" : "Priority"}</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(val) => setEditForm({ ...editForm, priority: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{language === "ar" ? "تاريخ البداية" : "Start Date"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !editForm.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.start_date
                        ? format(editForm.start_date, "PPP", { locale: language === "ar" ? ar : undefined })
                        : language === "ar"
                        ? "اختر تاريخ"
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editForm.start_date || undefined}
                      onSelect={(date) => setEditForm({ ...editForm, start_date: date || null })}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{language === "ar" ? "الموعد النهائي" : "Deadline"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !editForm.deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editForm.deadline
                      ? format(editForm.deadline, "PPP", { locale: language === "ar" ? ar : undefined })
                      : language === "ar"
                      ? "اختر تاريخ"
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editForm.deadline || undefined}
                    onSelect={(date) => setEditForm({ ...editForm, deadline: date || null })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? `هل أنت متأكد من حذف المهمة "${taskToDelete?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete the task "${taskToDelete?.title}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              {language === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskList;
