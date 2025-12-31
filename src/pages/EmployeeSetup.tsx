import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Search, UserCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Employee {
  id: string;
  employee_number: string;
  user_id: string | null;
  first_name: string;
  first_name_ar: string | null;
  last_name: string;
  last_name_ar: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  national_id: string | null;
  department_id: string | null;
  job_position_id: string | null;
  job_start_date: string;
  termination_date: string | null;
  employment_status: string;
  shift_type: string;
  fixed_shift_start: string | null;
  fixed_shift_end: string | null;
  shift_plan_id: string | null;
  vacation_code_id: string | null;
  vacation_balance: number | null;
  medical_insurance_plan_id: string | null;
  basic_salary: number | null;
  manager_id: string | null;
  departments?: { department_name: string } | null;
  job_positions?: { position_name: string } | null;
  profiles?: { user_name: string } | null;
}

interface Department {
  id: string;
  department_name: string;
}

interface JobPosition {
  id: string;
  position_name: string;
}

interface Profile {
  user_id: string;
  user_name: string;
  email: string;
}

interface VacationCode {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
}

interface MedicalInsurancePlan {
  id: string;
  plan_name: string;
}

interface ShiftPlan {
  id: string;
  plan_name: string;
}

export default function EmployeeSetup() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vacationCodes, setVacationCodes] = useState<VacationCode[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<MedicalInsurancePlan[]>([]);
  const [shiftPlans, setShiftPlans] = useState<ShiftPlan[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_number: "",
    user_id: "",
    first_name: "",
    first_name_ar: "",
    last_name: "",
    last_name_ar: "",
    email: "",
    phone: "",
    mobile: "",
    date_of_birth: "",
    gender: "",
    nationality: "",
    national_id: "",
    department_id: "",
    job_position_id: "",
    job_start_date: "",
    termination_date: "",
    employment_status: "active",
    shift_type: "fixed",
    fixed_shift_start: "",
    fixed_shift_end: "",
    shift_plan_id: "",
    vacation_code_id: "",
    vacation_balance: "",
    medical_insurance_plan_id: "",
    basic_salary: "",
    manager_id: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        employeesRes,
        departmentsRes,
        positionsRes,
        profilesRes,
        vacationCodesRes,
        insurancePlansRes,
        shiftPlansRes,
      ] = await Promise.all([
        supabase
          .from("employees")
          .select(`
            *,
            departments(department_name),
            job_positions(position_name)
          `)
          .order("employee_number"),
        supabase.from("departments").select("id, department_name").eq("is_active", true).order("department_name"),
        supabase.from("job_positions").select("id, position_name").eq("is_active", true).order("position_name"),
        supabase.from("profiles").select("user_id, user_name, email").eq("is_active", true).order("user_name"),
        supabase.from("vacation_codes").select("id, code, name_en, name_ar").eq("is_active", true).order("code"),
        supabase.from("medical_insurance_plans").select("id, plan_name").eq("is_active", true).order("plan_name"),
        supabase.from("shift_plans").select("id, plan_name").eq("is_active", true).order("plan_name"),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      setEmployees(employeesRes.data || []);
      setAllEmployees(employeesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setJobPositions(positionsRes.data || []);
      setProfiles(profilesRes.data || []);
      setVacationCodes(vacationCodesRes.data || []);
      setInsurancePlans(insurancePlansRes.data || []);
      setShiftPlans(shiftPlansRes.data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setEmployees(allEmployees);
    } else {
      const filtered = allEmployees.filter(
        (emp) =>
          emp.employee_number.toLowerCase().includes(term.toLowerCase()) ||
          emp.first_name.toLowerCase().includes(term.toLowerCase()) ||
          emp.last_name.toLowerCase().includes(term.toLowerCase()) ||
          emp.email?.toLowerCase().includes(term.toLowerCase())
      );
      setEmployees(filtered);
    }
  };

  const openAddDialog = () => {
    setSelectedEmployee(null);
    setFormData({
      employee_number: "",
      user_id: "",
      first_name: "",
      first_name_ar: "",
      last_name: "",
      last_name_ar: "",
      email: "",
      phone: "",
      mobile: "",
      date_of_birth: "",
      gender: "",
      nationality: "",
      national_id: "",
      department_id: "",
      job_position_id: "",
      job_start_date: "",
      termination_date: "",
      employment_status: "active",
      shift_type: "fixed",
      fixed_shift_start: "",
      fixed_shift_end: "",
      shift_plan_id: "",
      vacation_code_id: "",
      vacation_balance: "",
      medical_insurance_plan_id: "",
      basic_salary: "",
      manager_id: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({
      employee_number: employee.employee_number,
      user_id: employee.user_id || "",
      first_name: employee.first_name,
      first_name_ar: employee.first_name_ar || "",
      last_name: employee.last_name,
      last_name_ar: employee.last_name_ar || "",
      email: employee.email || "",
      phone: employee.phone || "",
      mobile: employee.mobile || "",
      date_of_birth: employee.date_of_birth || "",
      gender: employee.gender || "",
      nationality: employee.nationality || "",
      national_id: employee.national_id || "",
      department_id: employee.department_id || "",
      job_position_id: employee.job_position_id || "",
      job_start_date: employee.job_start_date,
      termination_date: employee.termination_date || "",
      employment_status: employee.employment_status,
      shift_type: employee.shift_type,
      fixed_shift_start: employee.fixed_shift_start || "",
      fixed_shift_end: employee.fixed_shift_end || "",
      shift_plan_id: employee.shift_plan_id || "",
      vacation_code_id: employee.vacation_code_id || "",
      vacation_balance: employee.vacation_balance?.toString() || "",
      medical_insurance_plan_id: employee.medical_insurance_plan_id || "",
      basic_salary: employee.basic_salary?.toString() || "",
      manager_id: employee.manager_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.employee_number || !formData.first_name || !formData.last_name || !formData.job_start_date) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        employee_number: formData.employee_number,
        user_id: formData.user_id || null,
        first_name: formData.first_name,
        first_name_ar: formData.first_name_ar || null,
        last_name: formData.last_name,
        last_name_ar: formData.last_name_ar || null,
        email: formData.email || null,
        phone: formData.phone || null,
        mobile: formData.mobile || null,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        nationality: formData.nationality || null,
        national_id: formData.national_id || null,
        department_id: formData.department_id || null,
        job_position_id: formData.job_position_id || null,
        job_start_date: formData.job_start_date,
        termination_date: formData.termination_date || null,
        employment_status: formData.employment_status as any,
        shift_type: formData.shift_type as any,
        fixed_shift_start: formData.fixed_shift_start || null,
        fixed_shift_end: formData.fixed_shift_end || null,
        shift_plan_id: formData.shift_plan_id || null,
        vacation_code_id: formData.vacation_code_id || null,
        vacation_balance: formData.vacation_balance ? parseFloat(formData.vacation_balance) : null,
        medical_insurance_plan_id: formData.medical_insurance_plan_id || null,
        basic_salary: formData.basic_salary ? parseFloat(formData.basic_salary) : null,
        manager_id: formData.manager_id || null,
      };

      if (selectedEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", selectedEmployee.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الموظف بنجاح" : "Employee updated successfully");
      } else {
        const { error } = await supabase.from("employees").insert(payload);
        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة الموظف بنجاح" : "Employee added successfully");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    try {
      const { error } = await supabase.from("employees").delete().eq("id", selectedEmployee.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الموظف بنجاح" : "Employee deleted successfully");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on_leave":
        return "bg-yellow-100 text-yellow-800";
      case "terminated":
        return "bg-red-100 text-red-800";
      case "suspended":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-6 w-6" />
            {language === "ar" ? "إعداد الموظفين" : "Employee Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة موظف" : "Add Employee"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === "ar" ? "بحث..." : "Search..."}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "رقم الموظف" : "Employee #"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                  <TableHead>{language === "ar" ? "المسمى الوظيفي" : "Position"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ البدء" : "Start Date"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {language === "ar" ? "لا توجد بيانات" : "No data found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.employee_number}</TableCell>
                      <TableCell>
                        {language === "ar"
                          ? `${emp.first_name_ar || emp.first_name} ${emp.last_name_ar || emp.last_name}`
                          : `${emp.first_name} ${emp.last_name}`}
                      </TableCell>
                      <TableCell>{emp.departments?.department_name || "-"}</TableCell>
                      <TableCell>{emp.job_positions?.position_name || "-"}</TableCell>
                      <TableCell>{format(new Date(emp.job_start_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(emp.employment_status)}`}>
                          {emp.employment_status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/employee-profile/${emp.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(emp)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee
                ? language === "ar"
                  ? "تعديل موظف"
                  : "Edit Employee"
                : language === "ar"
                ? "إضافة موظف"
                : "Add Employee"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "رقم الموظف *" : "Employee Number *"}</Label>
              <Input
                value={formData.employee_number}
                onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم الأول *" : "First Name *"}</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم الأول (عربي)" : "First Name (Arabic)"}</Label>
              <Input
                value={formData.first_name_ar}
                onChange={(e) => setFormData({ ...formData, first_name_ar: e.target.value })}
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "اسم العائلة *" : "Last Name *"}</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "اسم العائلة (عربي)" : "Last Name (Arabic)"}</Label>
              <Input
                value={formData.last_name_ar}
                onChange={(e) => setFormData({ ...formData, last_name_ar: e.target.value })}
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "ربط بمستخدم" : "Link to User"}</Label>
              <Select
                value={formData.user_id || "_none_"}
                onValueChange={(value) => setFormData({ ...formData, user_id: value === "_none_" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر مستخدم" : "Select User"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">{language === "ar" ? "بدون ربط" : "No Link"}</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.user_name} ({profile.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الهاتف" : "Phone"}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الجوال" : "Mobile"}</Label>
              <Input
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "تاريخ الميلاد" : "Date of Birth"}</Label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الجنس" : "Gender"}</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{language === "ar" ? "ذكر" : "Male"}</SelectItem>
                  <SelectItem value="female">{language === "ar" ? "أنثى" : "Female"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الجنسية" : "Nationality"}</Label>
              <Input
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "رقم الهوية" : "National ID"}</Label>
              <Input
                value={formData.national_id}
                onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
              />
            </div>

            {/* Job Info */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "القسم" : "Department"}</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData({ ...formData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select Department"} />
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

            <div className="space-y-2">
              <Label>{language === "ar" ? "المسمى الوظيفي" : "Job Position"}</Label>
              <Select
                value={formData.job_position_id}
                onValueChange={(value) => setFormData({ ...formData, job_position_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر المسمى" : "Select Position"} />
                </SelectTrigger>
                <SelectContent>
                  {jobPositions.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.position_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "تاريخ بدء العمل *" : "Job Start Date *"}</Label>
              <Input
                type="date"
                value={formData.job_start_date}
                onChange={(e) => setFormData({ ...formData, job_start_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "تاريخ انتهاء العقد" : "Termination Date"}</Label>
              <Input
                type="date"
                value={formData.termination_date}
                onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "حالة التوظيف" : "Employment Status"}</Label>
              <Select
                value={formData.employment_status}
                onValueChange={(value) => setFormData({ ...formData, employment_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                  <SelectItem value="on_leave">{language === "ar" ? "في إجازة" : "On Leave"}</SelectItem>
                  <SelectItem value="terminated">{language === "ar" ? "منتهي" : "Terminated"}</SelectItem>
                  <SelectItem value="suspended">{language === "ar" ? "موقوف" : "Suspended"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "المدير المباشر" : "Manager"}</Label>
              <Select
                value={formData.manager_id || "_none_"}
                onValueChange={(value) => setFormData({ ...formData, manager_id: value === "_none_" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر المدير" : "Select Manager"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">{language === "ar" ? "بدون مدير" : "No Manager"}</SelectItem>
                  {allEmployees
                    .filter((e) => e.id !== selectedEmployee?.id)
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shift Info */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "نوع الوردية" : "Shift Type"}</Label>
              <Select
                value={formData.shift_type}
                onValueChange={(value) => setFormData({ ...formData, shift_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{language === "ar" ? "ثابت" : "Fixed"}</SelectItem>
                  <SelectItem value="rotating">{language === "ar" ? "متناوب" : "Rotating"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.shift_type === "fixed" ? (
              <>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "بداية الوردية" : "Shift Start"}</Label>
                  <Input
                    type="time"
                    value={formData.fixed_shift_start}
                    onChange={(e) => setFormData({ ...formData, fixed_shift_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نهاية الوردية" : "Shift End"}</Label>
                  <Input
                    type="time"
                    value={formData.fixed_shift_end}
                    onChange={(e) => setFormData({ ...formData, fixed_shift_end: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{language === "ar" ? "خطة الورديات" : "Shift Plan"}</Label>
                <Select
                  value={formData.shift_plan_id}
                  onValueChange={(value) => setFormData({ ...formData, shift_plan_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الخطة" : "Select Plan"} />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.plan_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Vacation & Insurance */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "نوع الإجازات" : "Vacation Type"}</Label>
              <Select
                value={formData.vacation_code_id}
                onValueChange={(value) => setFormData({ ...formData, vacation_code_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {vacationCodes.map((vc) => (
                    <SelectItem key={vc.id} value={vc.id}>
                      {language === "ar" ? vc.name_ar || vc.name_en : vc.name_en} ({vc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "رصيد الإجازات" : "Vacation Balance"}</Label>
              <Input
                type="number"
                value={formData.vacation_balance}
                onChange={(e) => setFormData({ ...formData, vacation_balance: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "التأمين الطبي" : "Medical Insurance"}</Label>
              <Select
                value={formData.medical_insurance_plan_id}
                onValueChange={(value) => setFormData({ ...formData, medical_insurance_plan_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {insurancePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.plan_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الراتب الأساسي" : "Basic Salary"}</Label>
              <Input
                type="number"
                value={formData.basic_salary}
                onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {language === "ar" ? "حفظ" : "Save"}
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
              ? `هل أنت متأكد من حذف الموظف ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}؟`
              : `Are you sure you want to delete employee ${selectedEmployee?.first_name} ${selectedEmployee?.last_name}?`}
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
    </div>
  );
}
