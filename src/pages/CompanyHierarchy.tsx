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
import { Building2, Plus, Users, Briefcase, Pencil, Trash2, UserPlus } from "lucide-react";
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

  // Dialog states
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [assignToDeptDialogOpen, setAssignToDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingJob, setEditingJob] = useState<JobPosition | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", code: "", parentId: "__none__" });
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
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
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

  const handleOpenAssignToDept = (departmentId: string) => {
    setSelectedDeptId(departmentId);
    setSelectedUserId("");
    setAssignToDeptDialogOpen(true);
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

  const handleAssignUserToDept = async () => {
    if (!selectedUserId || !selectedDeptId) return;

    try {
      // Clear job_position_id when assigning directly to department
      const { error } = await supabase.from("profiles").update({
        default_department_id: selectedDeptId,
        job_position_id: null,
      }).eq("user_id", selectedUserId);

      if (error) throw error;
      toast({ title: language === 'ar' ? "تم تعيين الموظف للقسم" : "User assigned to department" });
      setAssignToDeptDialogOpen(false);
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

  // Get users assigned directly to department (no job)
  const getUsersDirectlyInDepartment = (deptId: string) => {
    return profiles.filter(p => p.default_department_id === deptId && !p.job_position_id);
  };

  const getAllActiveUsers = () => {
    return profiles.filter(p => p.is_active);
  };

  const getUnassignedUsers = () => {
    return profiles.filter(p => !p.job_position_id && !p.default_department_id);
  };

  // Org Chart Node Component
  const OrgChartNode = ({ dept, isRoot = false }: { dept: Department; isRoot?: boolean }) => {
    const children = getChildDepartments(dept.id);
    const jobs = getJobsForDepartment(dept.id);
    const directUsers = getUsersDirectlyInDepartment(dept.id);

    return (
      <div className="flex flex-col items-center">
        {/* Department Box */}
        <div
          className={cn(
            "relative px-6 py-3 rounded-lg text-white font-semibold text-center min-w-[180px] transition-all hover:shadow-lg group",
            isRoot ? "bg-primary" : "bg-primary/80"
          )}
        >
          <div className="text-sm font-bold">{dept.department_name}</div>
          <div className="text-xs opacity-80">{dept.department_code}</div>
          
          {/* Action buttons - visible on hover */}
          <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); handleEditDepartment(dept); }}
              title={language === 'ar' ? 'تعديل القسم' : 'Edit Department'}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); handleOpenAssignToDept(dept.id); }}
              title={language === 'ar' ? 'تعيين موظف للقسم' : 'Assign User to Department'}
            >
              <UserPlus className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); handleAddJob(dept.id); }}
              title={language === 'ar' ? 'إضافة وظيفة' : 'Add Job'}
            >
              <Briefcase className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-6 w-6 rounded-full shadow-md"
              onClick={(e) => { e.stopPropagation(); handleAddDepartment(dept.id); }}
              title={language === 'ar' ? 'إضافة قسم فرعي' : 'Add Sub-Department'}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Users directly assigned to department (no job) */}
        {directUsers.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-1 px-3 py-1.5 bg-muted rounded-md">
            {directUsers.slice(0, 4).map(user => (
              <div key={user.id} className="flex flex-col items-center">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-[9px]">{user.user_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-[8px] text-muted-foreground truncate max-w-[50px]">{user.user_name.split(' ')[0]}</span>
              </div>
            ))}
            {directUsers.length > 4 && (
              <span className="text-xs text-muted-foreground">+{directUsers.length - 4}</span>
            )}
          </div>
        )}

        {/* Jobs under department */}
        {jobs.length > 0 && (
          <div className="mt-2 space-y-1">
            {jobs.map(job => {
              const jobUsers = getUsersForJob(job.id);
              return (
                <div key={job.id} className="relative group/job">
                  <div className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-xs text-center">
                    <div className="font-medium">{job.position_name}</div>
                    {jobUsers.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {jobUsers.slice(0, 3).map(user => (
                          <Avatar key={user.id} className="h-5 w-5">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-[8px]">{user.user_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        ))}
                        {jobUsers.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{jobUsers.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Job action buttons */}
                  <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover/job:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-5 w-5 rounded-full shadow-sm bg-background"
                      onClick={(e) => { e.stopPropagation(); handleEditJob(job); }}
                      title={language === 'ar' ? 'تعديل الوظيفة' : 'Edit Job'}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-5 w-5 rounded-full shadow-sm bg-background"
                      onClick={(e) => { e.stopPropagation(); handleOpenAssignUser(job.id, dept.id); }}
                      title={language === 'ar' ? 'تعيين موظف' : 'Assign User'}
                    >
                      <UserPlus className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Connector to children */}
        {children.length > 0 && (
          <div className="flex flex-col items-center">
            {/* Vertical line down from parent */}
            <div className="w-0.5 h-8 bg-border" />
            
            {/* Container for horizontal line and children */}
            <div className="relative flex">
              {/* Horizontal line spanning all children */}
              {children.length > 1 && (
                <div 
                  className="absolute top-0 h-0.5 bg-border"
                  style={{ 
                    left: '50%',
                    right: '50%',
                    transform: 'translateX(-50%)',
                    width: `calc(100% - ${200}px)`,
                    marginLeft: '100px',
                    marginRight: '100px',
                  }}
                />
              )}
              
              {/* Children with their vertical connectors */}
              <div className="flex gap-12">
                {children.map((child, index) => (
                  <div key={child.id} className="relative flex flex-col items-center">
                    {/* Vertical line up to horizontal connector */}
                    <div className="w-0.5 h-8 bg-border" />
                    <OrgChartNode dept={child} />
                  </div>
                ))}
              </div>
            </div>
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
                ? 'انقر بزر الماوس الأيمن على أي عنصر لإدارته' 
                : 'Right-click on any element to manage it'}
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
            {language === 'ar' ? 'الهيكل التنظيمي' : 'Organizational Chart'}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
            <div className="flex justify-center gap-16 p-8 min-w-max">
              {rootDepartments.map(dept => (
                <OrgChartNode key={dept.id} dept={dept} isRoot />
              ))}
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

      {/* Assign User to Job Dialog */}
      <Dialog open={assignUserDialogOpen} onOpenChange={setAssignUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعيين موظف للوظيفة' : 'Assign User to Job'}
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
                  {getAllActiveUsers().map(user => (
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

      {/* Assign User to Department Dialog (without job) */}
      <Dialog open={assignToDeptDialogOpen} onOpenChange={setAssignToDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعيين موظف للقسم' : 'Assign User to Department'}
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
                  {getAllActiveUsers().map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.user_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAssignUserToDept} className="w-full" disabled={!selectedUserId}>
              {language === 'ar' ? 'تعيين' : 'Assign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyHierarchy;
