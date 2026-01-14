import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Palmtree, Filter, Plus, Trash2, Edit2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getYear } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface OfficialHoliday {
  id: string;
  holiday_name: string;
  holiday_name_ar: string | null;
  holiday_date: string;
  is_recurring: boolean;
  year: number | null;
  description: string | null;
}

interface AttendanceType {
  id: string;
  type_code: string;
  type_name: string;
  type_name_ar: string | null;
  is_active: boolean;
}

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  attendance_type_id: string | null;
  employment_status: string;
  attendance_types?: AttendanceType;
}

const HRVacationCalendar = () => {
  const { language } = useLanguage();
  const [holidays, setHolidays] = useState<OfficialHoliday[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedAttendanceType, setSelectedAttendanceType] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<OfficialHoliday | null>(null);
  const [formData, setFormData] = useState({
    holiday_name: "",
    holiday_name_ar: "",
    holiday_date: "",
    is_recurring: false,
    description: ""
  });

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch official holidays using raw query
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("official_holidays" as any)
        .select("*")
        .or(`year.eq.${selectedYear},is_recurring.eq.true`)
        .order("holiday_date", { ascending: true });

      if (holidaysError) throw holidaysError;

      // Fetch attendance types
      const { data: typesData, error: typesError } = await supabase
        .from("attendance_types")
        .select("*")
        .eq("is_active", true)
        .order("type_name");

      if (typesError) throw typesError;

      // Fetch employees with attendance types
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select(`
          id,
          employee_number,
          first_name,
          last_name,
          first_name_ar,
          last_name_ar,
          attendance_type_id,
          employment_status,
          attendance_types (
            id,
            type_code,
            type_name,
            type_name_ar,
            is_active
          )
        `)
        .eq("employment_status", "active")
        .order("first_name");

      if (employeesError) throw employeesError;

      setHolidays((holidaysData as unknown as OfficialHoliday[]) || []);
      setAttendanceTypes(typesData || []);
      setEmployees(employeesData as Employee[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (selectedAttendanceType === "all") return employees;
    return employees.filter(emp => emp.attendance_type_id === selectedAttendanceType);
  }, [employees, selectedAttendanceType]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  const isHoliday = (date: Date): OfficialHoliday | undefined => {
    return holidays.find(holiday => {
      const holidayDate = new Date(holiday.holiday_date);
      if (holiday.is_recurring) {
        return holidayDate.getMonth() === date.getMonth() && holidayDate.getDate() === date.getDate();
      }
      return isSameDay(holidayDate, date);
    });
  };

  const holidaysInMonth = useMemo(() => {
    return monthDays.filter(day => isHoliday(day));
  }, [monthDays, holidays]);

  const employeesByType = useMemo(() => {
    const grouped: Record<string, Employee[]> = {};
    
    filteredEmployees.forEach(emp => {
      const typeId = emp.attendance_type_id || "unassigned";
      if (!grouped[typeId]) {
        grouped[typeId] = [];
      }
      grouped[typeId].push(emp);
    });
    
    return grouped;
  }, [filteredEmployees]);

  const getAttendanceTypeName = (typeId: string): string => {
    if (typeId === "unassigned") {
      return language === "ar" ? "غير محدد" : "Unassigned";
    }
    const type = attendanceTypes.find(t => t.id === typeId);
    if (!type) return typeId;
    return language === "ar" && type.type_name_ar ? type.type_name_ar : type.type_name;
  };

  const getEmployeeName = (emp: Employee): string => {
    if (language === "ar" && emp.first_name_ar && emp.last_name_ar) {
      return `${emp.first_name_ar} ${emp.last_name_ar}`;
    }
    return `${emp.first_name} ${emp.last_name}`;
  };

  const getHolidayName = (holiday: OfficialHoliday): string => {
    return language === "ar" && holiday.holiday_name_ar 
      ? holiday.holiday_name_ar 
      : holiday.holiday_name;
  };

  const years = useMemo(() => {
    const currentYear = getYear(new Date());
    return Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);
  }, []);

  const openAddDialog = () => {
    setEditingHoliday(null);
    setFormData({
      holiday_name: "",
      holiday_name_ar: "",
      holiday_date: "",
      is_recurring: false,
      description: ""
    });
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: OfficialHoliday) => {
    setEditingHoliday(holiday);
    setFormData({
      holiday_name: holiday.holiday_name,
      holiday_name_ar: holiday.holiday_name_ar || "",
      holiday_date: holiday.holiday_date,
      is_recurring: holiday.is_recurring,
      description: holiday.description || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.holiday_name || !formData.holiday_date) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const holidayData = {
        holiday_name: formData.holiday_name,
        holiday_name_ar: formData.holiday_name_ar || null,
        holiday_date: formData.holiday_date,
        is_recurring: formData.is_recurring,
        year: formData.is_recurring ? null : getYear(new Date(formData.holiday_date)),
        description: formData.description || null
      };

      if (editingHoliday) {
        const { error } = await supabase
          .from("official_holidays" as any)
          .update(holidayData)
          .eq("id", editingHoliday.id);
        
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الإجازة بنجاح" : "Holiday updated successfully");
      } else {
        const { error } = await supabase
          .from("official_holidays" as any)
          .insert(holidayData);
        
        if (error) throw error;
        toast.success(language === "ar" ? "تمت إضافة الإجازة بنجاح" : "Holiday added successfully");
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving holiday:", error);
      toast.error(language === "ar" ? "خطأ في حفظ البيانات" : "Error saving data");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الإجازة؟" : "Are you sure you want to delete this holiday?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("official_holidays" as any)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الإجازة بنجاح" : "Holiday deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      toast.error(language === "ar" ? "خطأ في حذف البيانات" : "Error deleting data");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Palmtree className="h-6 w-6 text-primary" />
            {language === "ar" ? "تقويم الإجازات الرسمية" : "HR Official Holidays Calendar"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "عرض الإجازات الرسمية لجميع الموظفين حسب نوع الحضور"
              : "View official holidays for all employees by attendance type"}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedAttendanceType} onValueChange={setSelectedAttendanceType}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={language === "ar" ? "نوع الحضور" : "Attendance Type"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === "ar" ? "جميع الأنواع" : "All Types"}
              </SelectItem>
              {attendanceTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {language === "ar" && type.type_name_ar ? type.type_name_ar : type.type_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة إجازة" : "Add Holiday"}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Palmtree className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي الإجازات" : "Total Holidays"}
                </p>
                <p className="text-2xl font-bold">{holidays.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجازات هذا الشهر" : "This Month"}
                </p>
                <p className="text-2xl font-bold">{holidaysInMonth.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "الموظفين النشطين" : "Active Employees"}
                </p>
                <p className="text-2xl font-bold">{filteredEmployees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Filter className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "أنواع الحضور" : "Attendance Types"}
                </p>
                <p className="text-2xl font-bold">{attendanceTypes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {format(selectedMonth, "MMMM yyyy", { locale: language === "ar" ? ar : undefined })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date())}>
                {language === "ar" ? "اليوم" : "Today"}
              </Button>
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Holidays in Month */}
          {holidaysInMonth.length > 0 ? (
            <div className="space-y-2 mb-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                {language === "ar" ? "الإجازات في هذا الشهر:" : "Holidays this month:"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {holidaysInMonth.map(day => {
                  const holiday = isHoliday(day);
                  if (!holiday) return null;
                  return (
                    <Badge key={holiday.id} variant="secondary" className="bg-primary/10 text-primary">
                      {format(day, "d MMM", { locale: language === "ar" ? ar : undefined })} - {getHolidayName(holiday)}
                      {holiday.is_recurring && (
                        <span className="ml-1 text-xs opacity-70">
                          ({language === "ar" ? "سنوي" : "Yearly"})
                        </span>
                      )}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm mb-4">
              {language === "ar" ? "لا توجد إجازات رسمية هذا الشهر" : "No official holidays this month"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* All Holidays List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "ar" ? `قائمة الإجازات الرسمية ${selectedYear}` : `Official Holidays List ${selectedYear}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{language === "ar" ? "اسم الإجازة" : "Holiday Name"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead className="text-right">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد إجازات مسجلة" : "No holidays registered"}
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map(holiday => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(new Date(holiday.holiday_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{getHolidayName(holiday)}</TableCell>
                    <TableCell>
                      <Badge variant={holiday.is_recurring ? "default" : "secondary"}>
                        {holiday.is_recurring 
                          ? (language === "ar" ? "سنوي" : "Recurring")
                          : (language === "ar" ? "لمرة واحدة" : "One-time")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(holiday)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(holiday.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employees by Attendance Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "ar" ? "الموظفين حسب نوع الحضور" : "Employees by Attendance Type"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(employeesByType).map(([typeId, emps]) => (
              <div key={typeId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">
                    {getAttendanceTypeName(typeId)}
                  </h3>
                  <Badge variant="outline">{emps.length} {language === "ar" ? "موظف" : "employees"}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {emps.map(emp => (
                    <div 
                      key={emp.id} 
                      className="p-2 bg-muted/50 rounded-md text-sm hover:bg-muted transition-colors"
                    >
                      <p className="font-medium truncate">{getEmployeeName(emp)}</p>
                      <p className="text-xs text-muted-foreground">{emp.employee_number}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {Object.keys(employeesByType).length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {language === "ar" ? "لا يوجد موظفين" : "No employees found"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Holiday Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHoliday 
                ? (language === "ar" ? "تعديل الإجازة" : "Edit Holiday")
                : (language === "ar" ? "إضافة إجازة جديدة" : "Add New Holiday")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "اسم الإجازة (إنجليزي)" : "Holiday Name (English)"} *</Label>
              <Input
                value={formData.holiday_name}
                onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                placeholder={language === "ar" ? "أدخل اسم الإجازة" : "Enter holiday name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "اسم الإجازة (عربي)" : "Holiday Name (Arabic)"}</Label>
              <Input
                value={formData.holiday_name_ar}
                onChange={(e) => setFormData({ ...formData, holiday_name_ar: e.target.value })}
                placeholder={language === "ar" ? "أدخل اسم الإجازة بالعربي" : "Enter holiday name in Arabic"}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "التاريخ" : "Date"} *</Label>
              <Input
                type="date"
                value={formData.holiday_date}
                onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "إجازة سنوية متكررة" : "Recurring Yearly"}</Label>
              <Switch
                checked={formData.is_recurring}
                onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "ملاحظات" : "Description"}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={language === "ar" ? "أدخل الملاحظات" : "Enter description"}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleSave}>
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRVacationCalendar;
