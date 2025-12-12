import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, Users, Briefcase, ChevronDown, ChevronRight, Pencil, Trash2, UserPlus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Department {
  id: string;
  department_name: string;
  department_code: string;
  parent_department_id: string | null;
  is_active: boolean;
  description: string | null;
}

interface JobPosition {
  id: string;
  position_name: string;
  department_id: string | null;
  is_active: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  job_position_id: string | null;
  default_department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

const CompanyHierarchy = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  // Dialog states
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingJob, setEditingJob] = useState<JobPosition | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", code: "", parentId: "" });
  const [jobForm, setJobForm] = useState({ name: "", departmentId: "" });
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [deptRes, jobRes, profileRes] = await Promise.all([
        supabase.from("departments").select("*").order("department_name"),
        supabase.from("job_positions").select("*").order("position_name"),
        supabase.from("profiles").select("id, user_id, user_name, email, job_position_id, default_department_id, avatar_url, is_active").eq("is_active", true),
      ]);

      if (deptRes.error) throw deptRes.error;
      if (jobRes.error) throw jobRes.error;
      if (profileRes.error) throw profileRes.error;

      setDepartments(deptRes.data || []);
      setJobPositions(jobRes.data || []);
      setProfiles(profileRes.data || []);

      // Expand all departments by default
      setExpandedDepts(new Set((deptRes.data || []).map(d => d.id)));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDept = (deptId: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleAddDepartment = (parentId: string | null = null) => {
    setEditingDept(null);
    setDeptForm({ name: "", code: "", parentId: parentId || "__none__" });
    setDeptDialogOpen(true);
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.department_name,
      code: dept.department_code,
      parentId: dept.parent_department_id || "__none__",
    });
    setDeptDialogOpen(true);
  };

  const handleSaveDepartment = async () => {
    if (!deptForm.name.trim() || !deptForm.code.trim()) {
      toast({ title: language === 'ar' ? "الاسم والرمز مطلوبان" : "Name and code are required", variant: "destructive" });
      return;
    }

    try {
      const data = {
        department_name: deptForm.name.trim(),
        department_code: deptForm.code.trim(),
        parent_department_id: deptForm.parentId === "__none__" ? null : deptForm.parentId,
      };

      if (editingDept) {
        const { error } = await supabase.from("departments").update(data).eq("id", editingDept.id);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم تحديث القسم" : "Department updated" });
      } else {
        const { error } = await supabase.from("departments").insert(data);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم إضافة القسم" : "Department added" });
      }

      setDeptDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    const hasChildren = departments.some(d => d.parent_department_id === deptId);
    const hasJobs = jobPositions.some(j => j.department_id === deptId);

    if (hasChildren || hasJobs) {
      toast({
        title: language === 'ar' ? "لا يمكن حذف القسم" : "Cannot delete department",
        description: language === 'ar' ? "القسم يحتوي على أقسام فرعية أو وظائف" : "Department has sub-departments or jobs",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("departments").delete().eq("id", deptId);
      if (error) throw error;
      toast({ title: language === 'ar' ? "تم حذف القسم" : "Department deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleAddJob = (departmentId: string) => {
    setEditingJob(null);
    setJobForm({ name: "", departmentId });
    setJobDialogOpen(true);
  };

  const handleEditJob = (job: JobPosition) => {
    setEditingJob(job);
    setJobForm({ name: job.position_name, departmentId: job.department_id || "" });
    setJobDialogOpen(true);
  };

  const handleSaveJob = async () => {
    if (!jobForm.name.trim()) {
      toast({ title: language === 'ar' ? "اسم الوظيفة مطلوب" : "Job name is required", variant: "destructive" });
      return;
    }

    try {
      const data = {
        position_name: jobForm.name.trim(),
        department_id: jobForm.departmentId || null,
      };

      if (editingJob) {
        const { error } = await supabase.from("job_positions").update(data).eq("id", editingJob.id);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم تحديث الوظيفة" : "Job updated" });
      } else {
        const { error } = await supabase.from("job_positions").insert(data);
        if (error) throw error;
        toast({ title: language === 'ar' ? "تم إضافة الوظيفة" : "Job added" });
      }

      setJobDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    const hasUsers = profiles.some(p => p.job_position_id === jobId);
    if (hasUsers) {
      toast({
        title: language === 'ar' ? "لا يمكن حذف الوظيفة" : "Cannot delete job",
        description: language === 'ar' ? "الوظيفة مرتبطة بموظفين" : "Job has assigned users",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("job_positions").delete().eq("id", jobId);
      if (error) throw error;
      toast({ title: language === 'ar' ? "تم حذف الوظيفة" : "Job deleted" });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleOpenAssignUser = (jobId: string, departmentId: string) => {
    setSelectedJobId(jobId);
    setSelectedDeptId(departmentId);
    setSelectedUserId("");
    setAssignUserDialogOpen(true);
  };

  const handleAssignUser = async () => {
    if (!selectedUserId || !selectedJobId) return;

    try {
      const { error } = await supabase.from("profiles").update({
        job_position_id: selectedJobId,
        default_department_id: selectedDeptId,
      }).eq("user_id", selectedUserId);

      if (error) throw error;
      toast({ title: language === 'ar' ? "تم تعيين الموظف" : "User assigned" });
      setAssignUserDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const handleRemoveUserFromJob = async (userId: string) => {
    try {
      const { error } = await supabase.from("profiles").update({
        job_position_id: null,
        default_department_id: null,
      }).eq("user_id", userId);

      if (error) throw error;
      toast({ title: language === 'ar' ? "تم إزالة الموظف" : "User removed" });
      fetchData();
    } catch (error: any) {
      toast({ title: error.message, variant: "destructive" });
    }
  };

  const getChildDepartments = (parentId: string | null) => {
    return departments.filter(d => d.parent_department_id === parentId && d.is_active);
  };

  const getJobsForDepartment = (deptId: string) => {
    return jobPositions.filter(j => j.department_id === deptId && j.is_active);
  };

  const getUsersForJob = (jobId: string) => {
    return profiles.filter(p => p.job_position_id === jobId);
  };

  const getUnassignedUsers = () => {
    const assignedUserIds = profiles.filter(p => p.job_position_id).map(p => p.user_id);
    return profiles.filter(p => !assignedUserIds.includes(p.user_id));
  };

  const renderDepartmentNode = (dept: Department, level: number = 0) => {
    const children = getChildDepartments(dept.id);
    const jobs = getJobsForDepartment(dept.id);
    const isExpanded = expandedDepts.has(dept.id);
    const hasContent = children.length > 0 || jobs.length > 0;

    return (
      <div key={dept.id} className="relative">
        {/* Connection line from parent */}
        {level > 0 && (
          <div className="absolute top-0 -left-8 w-8 h-6 border-l-2 border-b-2 border-border rounded-bl-lg" />
        )}
        
        {/* Department card */}
        <div
          className={cn(
            "relative flex items-center gap-2 p-3 mb-2 rounded-lg border-2 bg-primary/10 border-primary/30 hover:bg-primary/20 transition-colors",
            level === 0 && "bg-primary text-primary-foreground border-primary"
          )}
          style={{ marginLeft: level * 40 }}
        >
          {hasContent && (
            <button onClick={() => toggleDept(dept.id)} className="p-1 hover:bg-background/20 rounded">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
          <Building2 className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{dept.department_name}</div>
            <div className="text-xs opacity-70">{dept.department_code}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddDepartment(dept.id)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddJob(dept.id)}>
              <Briefcase className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditDepartment(dept)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDepartment(dept.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Jobs and child departments */}
        {isExpanded && (
          <div className="relative" style={{ marginLeft: (level + 1) * 40 }}>
            {/* Vertical connection line */}
            {(jobs.length > 0 || children.length > 0) && (
              <div className="absolute top-0 -left-8 w-0.5 h-full bg-border" />
            )}

            {/* Jobs */}
            {jobs.map((job, idx) => {
              const jobUsers = getUsersForJob(job.id);
              const isJobExpanded = expandedJobs.has(job.id);
              const isLastItem = idx === jobs.length - 1 && children.length === 0;

              return (
                <div key={job.id} className="relative">
                  {/* Connection line */}
                  <div className={cn(
                    "absolute top-3 -left-8 w-8 border-t-2 border-border",
                    isLastItem && "border-l-2 rounded-bl-lg h-3 -top-0"
                  )} />

                  <div className="flex items-center gap-2 p-2 mb-2 rounded-lg border bg-secondary/50 border-secondary hover:bg-secondary/80 transition-colors">
                    {jobUsers.length > 0 && (
                      <button onClick={() => toggleJob(job.id)} className="p-1 hover:bg-background/20 rounded">
                        {isJobExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                    )}
                    <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">{job.position_name}</span>
                    <span className="text-xs text-muted-foreground">({jobUsers.length})</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenAssignUser(job.id, dept.id)}>
                      <UserPlus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditJob(job)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteJob(job.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Users under job */}
                  {isJobExpanded && jobUsers.length > 0 && (
                    <div className="ml-8 space-y-1 mb-2">
                      {jobUsers.map(user => (
                        <div key={user.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{user.user_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate">{user.user_name}</span>
                          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleRemoveUserFromJob(user.user_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Child departments */}
            {children.map((child, idx) => (
              <div key={child.id} className="relative">
                {renderDepartmentNode(child, 0)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const rootDepartments = departments.filter(d => !d.parent_department_id && d.is_active);

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ar' ? 'الهيكل التنظيمي' : 'Company Hierarchy'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? 'إدارة الأقسام والوظائف والموظفين' 
                : 'Manage departments, jobs, and employees'}
            </p>
          </div>
        </div>
        <Button onClick={() => handleAddDepartment(null)}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'إضافة قسم رئيسي' : 'Add Main Department'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {language === 'ar' ? 'الأقسام' : 'Departments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {departments.filter(d => d.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              {language === 'ar' ? 'الوظائف' : 'Jobs'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {jobPositions.filter(j => j.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ar' ? 'الموظفين المعينين' : 'Assigned Users'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {profiles.filter(p => p.job_position_id).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ar' ? 'غير معينين' : 'Unassigned'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-muted-foreground">
              {getUnassignedUsers().length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Structure'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : rootDepartments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' 
                ? 'لا توجد أقسام. انقر على "إضافة قسم رئيسي" للبدء.' 
                : 'No departments found. Click "Add Main Department" to start.'}
            </div>
          ) : (
            <div className="p-4 overflow-x-auto">
              {rootDepartments.map(dept => renderDepartmentNode(dept, 0))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDept 
                ? (language === 'ar' ? 'تعديل القسم' : 'Edit Department')
                : (language === 'ar' ? 'إضافة قسم' : 'Add Department')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'اسم القسم' : 'Department Name'}</Label>
              <Input
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: تقنية المعلومات' : 'e.g. Information Technology'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'رمز القسم' : 'Department Code'}</Label>
              <Input
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: IT' : 'e.g. IT'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'القسم الأب' : 'Parent Department'}</Label>
              <Select value={deptForm.parentId} onValueChange={(v) => setDeptForm({ ...deptForm, parentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'بدون (قسم رئيسي)' : 'None (Root department)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === 'ar' ? 'بدون (قسم رئيسي)' : 'None (Root department)'}</SelectItem>
                  {departments
                    .filter(d => d.is_active && d.id !== editingDept?.id)
                    .map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveDepartment} className="w-full">
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Dialog */}
      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingJob 
                ? (language === 'ar' ? 'تعديل الوظيفة' : 'Edit Job')
                : (language === 'ar' ? 'إضافة وظيفة' : 'Add Job')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'اسم الوظيفة' : 'Job Title'}</Label>
              <Input
                value={jobForm.name}
                onChange={(e) => setJobForm({ ...jobForm, name: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: مطور برامج' : 'e.g. Software Developer'}
              />
            </div>
            <div>
              <Label>{language === 'ar' ? 'القسم' : 'Department'}</Label>
              <Select value={jobForm.departmentId} onValueChange={(v) => setJobForm({ ...jobForm, departmentId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} />
                </SelectTrigger>
                <SelectContent>
                  {departments.filter(d => d.is_active).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.department_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveJob} className="w-full">
              {language === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={assignUserDialogOpen} onOpenChange={setAssignUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعيين موظف' : 'Assign User'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'ar' ? 'اختر الموظف' : 'Select User'}</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر موظف' : 'Select a user'} />
                </SelectTrigger>
                <SelectContent>
                  {getUnassignedUsers().map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.user_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssignUser} className="w-full" disabled={!selectedUserId}>
              {language === 'ar' ? 'تعيين' : 'Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyHierarchy;
