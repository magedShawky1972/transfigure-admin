import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Briefcase, Users, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JobPosition {
  id: string;
  position_name: string;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Department {
  id: string;
  department_name: string;
  department_code: string;
}

interface LinkedEmployee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  user_id: string | null;
}

interface LinkedUser {
  user_id: string;
  user_name: string;
  email: string;
}

const JobSetup = () => {
  const { language } = useLanguage();
  const [jobs, setJobs] = useState<JobPosition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkedDialogOpen, setLinkedDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPosition | null>(null);
  const [linkedEmployees, setLinkedEmployees] = useState<LinkedEmployee[]>([]);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    position_name: "",
    department_id: "",
    is_active: true,
  });

  useEffect(() => {
    fetchJobs();
    fetchDepartments();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .order("position_name");

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error(language === "ar" ? "خطأ في تحميل الوظائف" : "Error loading jobs");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name, department_code")
        .eq("is_active", true)
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const openAddDialog = () => {
    setSelectedJob(null);
    setFormData({
      position_name: "",
      department_id: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (job: JobPosition) => {
    setSelectedJob(job);
    setFormData({
      position_name: job.position_name,
      department_id: job.department_id || "",
      is_active: job.is_active,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (job: JobPosition) => {
    setSelectedJob(job);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.position_name.trim()) {
      toast.error(language === "ar" ? "اسم الوظيفة مطلوب" : "Job name is required");
      return;
    }

    try {
      const jobData = {
        position_name: formData.position_name.trim(),
        department_id: formData.department_id || null,
        is_active: formData.is_active,
      };

      if (selectedJob) {
        const { error } = await supabase
          .from("job_positions")
          .update(jobData)
          .eq("id", selectedJob.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الوظيفة بنجاح" : "Job updated successfully");
      } else {
        const { error } = await supabase
          .from("job_positions")
          .insert(jobData);

        if (error) throw error;
        toast.success(language === "ar" ? "تمت إضافة الوظيفة بنجاح" : "Job added successfully");
      }

      setDialogOpen(false);
      fetchJobs();
    } catch (error) {
      console.error("Error saving job:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الوظيفة" : "Error saving job");
    }
  };

  const handleDelete = async () => {
    if (!selectedJob) return;

    try {
      const { error } = await supabase
        .from("job_positions")
        .delete()
        .eq("id", selectedJob.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الوظيفة بنجاح" : "Job deleted successfully");
      setDeleteDialogOpen(false);
      fetchJobs();
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error(language === "ar" ? "خطأ في حذف الوظيفة" : "Error deleting job");
    }
  };

  const openLinkedDialog = async (job: JobPosition) => {
    setSelectedJob(job);
    setLoadingLinked(true);
    setLinkedDialogOpen(true);

    try {
      // Fetch employees linked to this job
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, employee_number, user_id")
        .eq("job_position_id", job.id);

      if (empError) throw empError;
      setLinkedEmployees(employees || []);

      // Fetch users linked via profiles with this job
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("user_id, user_name, email, job_position_id")
        .eq("job_position_id", job.id);

      if (profError) throw profError;
      setLinkedUsers(profiles || []);
    } catch (error) {
      console.error("Error fetching linked data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoadingLinked(false);
    }
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "-";
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? dept.department_name : "-";
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.position_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getDepartmentName(job.department_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {language === "ar" ? "إعداد الوظائف" : "Job Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 me-2" />
            {language === "ar" ? "إضافة وظيفة" : "Add Job"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder={language === "ar" ? "بحث..." : "Search..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "اسم الوظيفة" : "Job Name"}</TableHead>
                <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.position_name}</TableCell>
                  <TableCell>{getDepartmentName(job.department_id)}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        job.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {job.is_active
                        ? language === "ar"
                          ? "نشط"
                          : "Active"
                        : language === "ar"
                        ? "غير نشط"
                        : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => openLinkedDialog(job)} title={language === "ar" ? "عرض المرتبطين" : "View Linked"}>
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(job)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => openDeleteDialog(job)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {language === "ar" ? "لا توجد وظائف" : "No jobs found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedJob
                ? language === "ar"
                  ? "تعديل الوظيفة"
                  : "Edit Job"
                : language === "ar"
                ? "إضافة وظيفة"
                : "Add Job"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "اسم الوظيفة" : "Job Name"}</Label>
              <Input
                value={formData.position_name}
                onChange={(e) => setFormData({ ...formData, position_name: e.target.value })}
                placeholder={language === "ar" ? "أدخل اسم الوظيفة" : "Enter job name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "القسم" : "Department"}</Label>
              <Select
                value={formData.department_id || "__none__"}
                onValueChange={(value) => setFormData({ ...formData, department_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === "ar" ? "بدون قسم" : "No department"}</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>{language === "ar" ? "نشط" : "Active"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {selectedJob
                ? language === "ar"
                  ? "تحديث"
                  : "Update"
                : language === "ar"
                ? "إضافة"
                : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p>
            {language === "ar"
              ? `هل أنت متأكد من حذف الوظيفة "${selectedJob?.position_name}"؟`
              : `Are you sure you want to delete the job "${selectedJob?.position_name}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {language === "ar" ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Linked Employees & Users Dialog */}
      <Dialog open={linkedDialogOpen} onOpenChange={setLinkedDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {language === "ar" 
                ? `المرتبطين بالوظيفة: ${selectedJob?.position_name}` 
                : `Linked to Job: ${selectedJob?.position_name}`}
            </DialogTitle>
          </DialogHeader>
          
          {loadingLinked ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Linked Employees */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <UserCircle className="h-5 w-5" />
                  {language === "ar" ? "الموظفون" : "Employees"}
                  <Badge variant="secondary">{linkedEmployees.length}</Badge>
                </h3>
                {linkedEmployees.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {language === "ar" ? "لا يوجد موظفون مرتبطون" : "No employees linked"}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {linkedEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                          <p className="text-sm text-muted-foreground">{emp.employee_number}</p>
                        </div>
                        {emp.user_id && (
                          <Badge variant="outline" className="text-xs">
                            {language === "ar" ? "مرتبط بمستخدم" : "Has User"}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Users */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5" />
                  {language === "ar" ? "المستخدمون" : "Users"}
                  <Badge variant="secondary">{linkedUsers.length}</Badge>
                </h3>
                {linkedUsers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {language === "ar" ? "لا يوجد مستخدمون مرتبطون" : "No users linked"}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {linkedUsers.map((user) => (
                      <div key={user.user_id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{user.user_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkedDialogOpen(false)}>
              {language === "ar" ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JobSetup;
