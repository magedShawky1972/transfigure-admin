import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Briefcase,
  Calendar,
  Clock,
  Shield,
  History,
  FileText,
  Mail,
  Phone,
  MapPin,
  Building2,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";

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
  passport_number: string | null;
  marital_status: string | null;
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
  insurance_start_date: string | null;
  insurance_end_date: string | null;
  basic_salary: number | null;
  currency: string | null;
  manager_id: string | null;
  notes: string | null;
  departments?: { department_name: string } | null;
  job_positions?: { position_name: string } | null;
  vacation_codes?: { code: string; name_en: string; name_ar: string | null } | null;
  medical_insurance_plans?: { plan_name: string; provider: string | null } | null;
  shift_plans?: { plan_name: string } | null;
  profiles?: { user_name: string; email: string } | null;
}

interface JobHistory {
  id: string;
  department_id: string | null;
  job_position_id: string | null;
  start_date: string;
  end_date: string | null;
  salary: number | null;
  change_reason: string | null;
  notes: string | null;
  departments?: { department_name: string } | null;
  job_positions?: { position_name: string } | null;
}

interface VacationRequest {
  id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  reason: string | null;
  vacation_codes?: { code: string; name_en: string } | null;
}

interface Timesheet {
  id: string;
  work_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  is_absent: boolean;
  late_minutes: number;
  overtime_minutes: number;
  total_work_minutes: number;
}

interface EmployeeVacationType {
  id: string;
  vacation_code_id: string;
  vacation_codes?: { code: string; name_en: string; name_ar: string | null } | null;
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employeeVacationTypes, setEmployeeVacationTypes] = useState<EmployeeVacationType[]>([]);
  const [employeeContacts, setEmployeeContacts] = useState<{
    id: string;
    contact_type: string;
    contact_name: string;
    contact_phone: string | null;
    contact_address: string | null;
    is_emergency_contact: boolean;
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (id) {
      fetchEmployeeData();
    }
  }, [id]);

  const fetchEmployeeData = async () => {
    setLoading(true);
    try {
      const [employeeRes, historyRes, vacationRes, timesheetRes, vacationTypesRes] = await Promise.all([
        supabase
          .from("employees")
          .select(`
            *,
            departments(department_name),
            job_positions(position_name),
            vacation_codes(code, name_en, name_ar),
            medical_insurance_plans(plan_name, provider),
            shift_plans(plan_name)
          `)
          .eq("id", id)
          .single(),
        supabase
          .from("employee_job_history")
          .select(`
            *,
            departments(department_name),
            job_positions(position_name)
          `)
          .eq("employee_id", id)
          .order("start_date", { ascending: false }),
        supabase
          .from("vacation_requests")
          .select(`
            *,
            vacation_codes(code, name_en)
          `)
          .eq("employee_id", id)
          .order("start_date", { ascending: false })
          .limit(10),
        supabase
          .from("timesheets")
          .select("*")
          .eq("employee_id", id)
          .order("work_date", { ascending: false })
          .limit(30),
        supabase
          .from("employee_vacation_types")
          .select(`
            id,
            vacation_code_id,
            vacation_codes(code, name_en, name_ar)
          `)
          .eq("employee_id", id),
        supabase
          .from("employee_contacts")
          .select("id, contact_type, contact_name, contact_phone, contact_address, is_emergency_contact")
          .eq("employee_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (employeeRes.error) throw employeeRes.error;
      setEmployee(employeeRes.data);
      setJobHistory(historyRes.data || []);
      setVacationRequests(vacationRes.data || []);
      setTimesheets(timesheetRes.data || []);
      setEmployeeVacationTypes(vacationTypesRes.data as EmployeeVacationType[] || []);
      
      // Fetch contacts
      const contactsRes = await supabase
        .from("employee_contacts")
        .select("id, contact_type, contact_name, contact_phone, contact_address, is_emergency_contact")
        .eq("employee_id", id)
        .order("created_at", { ascending: false });
      setEmployeeContacts(contactsRes.data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
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
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {language === "ar" ? "لم يتم العثور على الموظف" : "Employee not found"}
            </p>
            <Button variant="outline" onClick={() => navigate("/employee-setup")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === "ar" ? "العودة" : "Go Back"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/employee-setup")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "ملف الموظف" : "Employee Profile"}
          </h1>
        </div>
        <Button onClick={() => navigate(`/employee-setup?edit=${id}`)}>
          <Pencil className="h-4 w-4 mr-2" />
          {language === "ar" ? "تعديل" : "Edit"}
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={employee.photo_url || undefined} />
              <AvatarFallback className="text-2xl">
                {employee.first_name[0]}
                {employee.last_name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">
                  {language === "ar"
                    ? `${employee.first_name_ar || employee.first_name} ${employee.last_name_ar || employee.last_name}`
                    : `${employee.first_name} ${employee.last_name}`}
                </h2>
                <Badge className={getStatusColor(employee.employment_status)}>
                  {employee.employment_status}
                </Badge>
              </div>

              <p className="text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {employee.job_positions?.position_name || "-"}
              </p>

              <p className="text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {employee.departments?.department_name || "-"}
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {employee.email || "-"}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {employee.mobile || employee.phone || "-"}
                </span>
              </div>
            </div>

            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground">
                {language === "ar" ? "رقم الموظف" : "Employee #"}
              </p>
              <p className="font-mono font-bold text-lg">{employee.employee_number}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {language === "ar" ? "تاريخ البدء" : "Start Date"}
              </p>
              <p className="font-medium">{format(new Date(employee.job_start_date), "yyyy-MM-dd")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {language === "ar" ? "نظرة عامة" : "Overview"}
          </TabsTrigger>
          <TabsTrigger value="job-history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {language === "ar" ? "السجل الوظيفي" : "Job History"}
          </TabsTrigger>
          <TabsTrigger value="vacation" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {language === "ar" ? "الإجازات" : "Vacations"}
          </TabsTrigger>
          <TabsTrigger value="timesheet" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {language === "ar" ? "الحضور" : "Timesheet"}
          </TabsTrigger>
          <TabsTrigger value="insurance" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {language === "ar" ? "التأمين" : "Insurance"}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {language === "ar" ? "جهات الاتصال" : "Contacts"}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {language === "ar" ? "المعلومات الشخصية" : "Personal Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "تاريخ الميلاد" : "Date of Birth"}</span>
                  <span>{employee.date_of_birth ? format(new Date(employee.date_of_birth), "yyyy-MM-dd") : "-"}</span>

                  <span className="text-muted-foreground">{language === "ar" ? "الجنس" : "Gender"}</span>
                  <span>{employee.gender || "-"}</span>

                  <span className="text-muted-foreground">{language === "ar" ? "الجنسية" : "Nationality"}</span>
                  <span>{employee.nationality || "-"}</span>

                  <span className="text-muted-foreground">{language === "ar" ? "رقم الهوية" : "National ID"}</span>
                  <span>{employee.national_id || "-"}</span>

                  <span className="text-muted-foreground">{language === "ar" ? "جواز السفر" : "Passport"}</span>
                  <span>{employee.passport_number || "-"}</span>

                  <span className="text-muted-foreground">{language === "ar" ? "الحالة الاجتماعية" : "Marital Status"}</span>
                  <span>{employee.marital_status || "-"}</span>
                </div>
                {(employee as any).address && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-sm block mb-1">{language === "ar" ? "العنوان" : "Address"}</span>
                    <span className="text-sm">{(employee as any).address}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {language === "ar" ? "معلومات الوردية" : "Shift Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "نوع الوردية" : "Shift Type"}</span>
                  <span>{employee.shift_type === "fixed" ? (language === "ar" ? "ثابت" : "Fixed") : (language === "ar" ? "متناوب" : "Rotating")}</span>

                  {employee.shift_type === "fixed" ? (
                    <>
                      <span className="text-muted-foreground">{language === "ar" ? "بداية الوردية" : "Shift Start"}</span>
                      <span>{employee.fixed_shift_start || "-"}</span>

                      <span className="text-muted-foreground">{language === "ar" ? "نهاية الوردية" : "Shift End"}</span>
                      <span>{employee.fixed_shift_end || "-"}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">{language === "ar" ? "خطة الورديات" : "Shift Plan"}</span>
                      <span>{employee.shift_plans?.plan_name || "-"}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {language === "ar" ? "معلومات الإجازات" : "Vacation Information"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <span className="text-muted-foreground block">{language === "ar" ? "أنواع الإجازات المسموحة" : "Eligible Vacation Types"}</span>
                  <div className="flex flex-wrap gap-2">
                    {employeeVacationTypes.length > 0 ? (
                      employeeVacationTypes.map((evt) => (
                        <Badge key={evt.id} variant="secondary">
                          {evt.vacation_codes
                            ? language === "ar"
                              ? evt.vacation_codes.name_ar || evt.vacation_codes.name_en
                              : evt.vacation_codes.name_en
                            : "-"}
                          {evt.vacation_codes && ` (${evt.vacation_codes.code})`}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">{language === "ar" ? "لا توجد إجازات محددة" : "No vacation types assigned"}</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                  <span className="text-muted-foreground">{language === "ar" ? "الرصيد المتبقي" : "Remaining Balance"}</span>
                  <span className="font-bold text-primary">{employee.vacation_balance || 0} {language === "ar" ? "يوم" : "days"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {language === "ar" ? "ملاحظات" : "Notes"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {employee.notes || (language === "ar" ? "لا توجد ملاحظات" : "No notes")}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Job History Tab */}
        <TabsContent value="job-history">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "السجل الوظيفي" : "Job History"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                    <TableHead>{language === "ar" ? "المسمى الوظيفي" : "Position"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ البدء" : "Start Date"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ الانتهاء" : "End Date"}</TableHead>
                    <TableHead>{language === "ar" ? "سبب التغيير" : "Change Reason"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا يوجد سجل وظيفي" : "No job history"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobHistory.map((history) => (
                      <TableRow key={history.id}>
                        <TableCell>{history.departments?.department_name || "-"}</TableCell>
                        <TableCell>{history.job_positions?.position_name || "-"}</TableCell>
                        <TableCell>{format(new Date(history.start_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell>
                          {history.end_date ? format(new Date(history.end_date), "yyyy-MM-dd") : "-"}
                        </TableCell>
                        <TableCell>{history.change_reason || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vacation Tab */}
        <TabsContent value="vacation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{language === "ar" ? "طلبات الإجازة" : "Vacation Requests"}</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "الرصيد:" : "Balance:"}
                </span>
                <Badge variant="secondary" className="text-lg">
                  {employee.vacation_balance || 0} {language === "ar" ? "يوم" : "days"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                    <TableHead>{language === "ar" ? "من" : "From"}</TableHead>
                    <TableHead>{language === "ar" ? "إلى" : "To"}</TableHead>
                    <TableHead>{language === "ar" ? "عدد الأيام" : "Days"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacationRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد طلبات إجازة" : "No vacation requests"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    vacationRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.vacation_codes?.name_en || "-"}</TableCell>
                        <TableCell>{format(new Date(request.start_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell>{format(new Date(request.end_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell>{request.total_days}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timesheet Tab */}
        <TabsContent value="timesheet">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "سجل الحضور" : "Attendance Record"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "الحضور" : "Check In"}</TableHead>
                    <TableHead>{language === "ar" ? "الانصراف" : "Check Out"}</TableHead>
                    <TableHead>{language === "ar" ? "ساعات العمل" : "Work Hours"}</TableHead>
                    <TableHead>{language === "ar" ? "التأخير" : "Late"}</TableHead>
                    <TableHead>{language === "ar" ? "الإضافي" : "Overtime"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد سجلات حضور" : "No timesheet records"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    timesheets.map((ts) => (
                      <TableRow key={ts.id}>
                        <TableCell>{format(new Date(ts.work_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell>{ts.actual_start || "-"}</TableCell>
                        <TableCell>{ts.actual_end || "-"}</TableCell>
                        <TableCell>{Math.floor(ts.total_work_minutes / 60)}h {ts.total_work_minutes % 60}m</TableCell>
                        <TableCell className={ts.late_minutes > 0 ? "text-destructive" : ""}>
                          {ts.late_minutes > 0 ? `${ts.late_minutes}m` : "-"}
                        </TableCell>
                        <TableCell className={ts.overtime_minutes > 0 ? "text-green-600" : ""}>
                          {ts.overtime_minutes > 0 ? `${ts.overtime_minutes}m` : "-"}
                        </TableCell>
                        <TableCell>
                          {ts.is_absent ? (
                            <Badge variant="destructive">{language === "ar" ? "غائب" : "Absent"}</Badge>
                          ) : (
                            <Badge className={getStatusColor(ts.status)}>{ts.status}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insurance Tab */}
        <TabsContent value="insurance">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "التأمين الطبي" : "Medical Insurance"}</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.medical_insurance_plans ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{language === "ar" ? "الخطة" : "Plan"}</span>
                    <p className="font-medium">{employee.medical_insurance_plans.plan_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{language === "ar" ? "المزود" : "Provider"}</span>
                    <p className="font-medium">{employee.medical_insurance_plans.provider || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{language === "ar" ? "تاريخ البدء" : "Start Date"}</span>
                    <p className="font-medium">
                      {employee.insurance_start_date
                        ? format(new Date(employee.insurance_start_date), "yyyy-MM-dd")
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{language === "ar" ? "تاريخ الانتهاء" : "End Date"}</span>
                    <p className="font-medium">
                      {employee.insurance_end_date
                        ? format(new Date(employee.insurance_end_date), "yyyy-MM-dd")
                        : "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {language === "ar" ? "لا يوجد تأمين طبي" : "No medical insurance assigned"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "جهات الاتصال" : "Employee Contacts"}</CardTitle>
            </CardHeader>
            <CardContent>
              {employeeContacts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                      <TableHead>{language === "ar" ? "الهاتف" : "Phone"}</TableHead>
                      <TableHead>{language === "ar" ? "العنوان" : "Address"}</TableHead>
                      <TableHead>{language === "ar" ? "طوارئ" : "Emergency"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="capitalize">{contact.contact_type}</TableCell>
                        <TableCell className="font-medium">{contact.contact_name}</TableCell>
                        <TableCell>{contact.contact_phone || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{contact.contact_address || "-"}</TableCell>
                        <TableCell>
                          {contact.is_emergency_contact && (
                            <span className="text-destructive font-medium">
                              {language === "ar" ? "نعم" : "Yes"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {language === "ar" ? "لا توجد جهات اتصال مسجلة" : "No contacts registered"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
