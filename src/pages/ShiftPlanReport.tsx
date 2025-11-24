import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Play, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

interface ShiftAssignment {
  id: string;
  assignment_date: string;
  notes: string | null;
  user_name: string;
  email: string;
  job_position: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  zone_name: string;
  shift_type: string | null;
  shift_color: string;
}

const ShiftPlanReport = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedJobPosition, setSelectedJobPosition] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [reportResults, setReportResults] = useState<ShiftAssignment[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dateRun, setDateRun] = useState<string>("");

  const { data: jobPositions = [] } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("is_active", true)
        .order("position_name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users", selectedJobPosition],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select(`
          user_id,
          user_name,
          email,
          job_position_id,
          job_positions (
            position_name
          )
        `)
        .eq("is_active", true)
        .order("user_name");

      if (selectedJobPosition !== "all") {
        const jobPosition = jobPositions.find(jp => jp.position_name === selectedJobPosition);
        if (jobPosition) {
          query = query.eq("job_position_id", jobPosition.id);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: jobPositions.length > 0,
  });

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    setSelectedUsers(users.map(u => u.user_id));
  };

  const deselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const runReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error(language === "ar" ? "الرجاء تحديد نطاق التاريخ" : "Please select date range");
      return;
    }

    setIsRunning(true);
    try {
      let query = supabase
        .from("shift_assignments")
        .select(`
          id,
          assignment_date,
          notes,
          user_id,
          shift_id,
          shifts (
            shift_name,
            shift_start_time,
            shift_end_time,
            color,
            shift_type_id,
            shift_types (
              zone_name,
              type
            )
          )
        `)
        .gte("assignment_date", dateFrom)
        .lte("assignment_date", dateTo)
        .order("assignment_date", { ascending: true });

      if (selectedUsers.length > 0) {
        query = query.in("user_id", selectedUsers);
      }

      const { data: assignmentsData, error: assignmentsError } = await query;
      if (assignmentsError) throw assignmentsError;

      // Fetch user profiles
      const userIds = [...new Set(assignmentsData?.map(a => a.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          user_id,
          user_name,
          email,
          job_position_id,
          job_positions (
            position_name
          )
        `)
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      
      let combinedData = assignmentsData?.map((assignment: any) => {
        const profile = profilesMap.get(assignment.user_id);
        return {
          id: assignment.id,
          assignment_date: assignment.assignment_date,
          notes: assignment.notes,
          user_name: profile?.user_name || "",
          email: profile?.email || "",
          job_position: profile?.job_positions?.position_name || "",
          shift_name: assignment.shifts?.shift_name || "",
          shift_start_time: assignment.shifts?.shift_start_time || "",
          shift_end_time: assignment.shifts?.shift_end_time || "",
          zone_name: assignment.shifts?.shift_types?.zone_name || "",
          shift_type: assignment.shifts?.shift_types?.type || null,
          shift_color: assignment.shifts?.color || "",
        };
      }) || [];

      // Filter by job position if selected
      if (selectedJobPosition !== "all") {
        combinedData = combinedData.filter(
          (assignment: any) => assignment.job_position === selectedJobPosition
        );
      }

      setReportResults(combinedData);
      setDateRun(new Date().toLocaleString(language === "ar" ? "ar-EG" : "en-US"));
      toast.success(language === "ar" ? "تم إنشاء التقرير بنجاح" : "Report generated successfully");
    } catch (error: any) {
      console.error("Error running report:", error);
      toast.error(error.message || (language === "ar" ? "فشل في تشغيل التقرير" : "Failed to run report"));
    } finally {
      setIsRunning(false);
    }
  };

  const exportToExcel = () => {
    if (reportResults.length === 0) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const headers = language === "ar" 
      ? ["التاريخ", "اسم الموظف", "البريد الإلكتروني", "الوظيفة", "المناوبة", "وقت البداية", "وقت النهاية", "المنطقة", "النوع", "ملاحظات"]
      : ["Date", "Employee Name", "Email", "Job Position", "Shift", "Start Time", "End Time", "Zone", "Type", "Notes"];
    
    const rows = reportResults.map(row => [
      format(new Date(row.assignment_date), "yyyy-MM-dd"),
      row.user_name,
      row.email,
      row.job_position,
      row.shift_name,
      row.shift_start_time,
      row.shift_end_time,
      row.zone_name,
      row.shift_type || "",
      row.notes || ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, language === "ar" ? "خطة المناوبات" : "Shift Plan");
    XLSX.writeFile(wb, `shift-plan-report-${dateFrom}-to-${dateTo}.xlsx`);
    
    toast.success(language === "ar" ? "تم التصدير بنجاح" : "Export successful");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {language === "ar" ? "تقرير خطة المناوبات" : "Shift Plan Report"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "عرض وتصدير خطة المناوبات مع الفلاتر" 
              : "View and export shift plan with filters"}
          </p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{language === "ar" ? "الفلاتر" : "Filters"}</CardTitle>
          <CardDescription>
            {language === "ar" ? "حدد معايير التقرير" : "Select report criteria"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobPosition">
                {language === "ar" ? "الوظيفة" : "Job Position"}
              </Label>
              <Select value={selectedJobPosition} onValueChange={setSelectedJobPosition}>
                <SelectTrigger id="jobPosition">
                  <SelectValue placeholder={language === "ar" ? "اختر الوظيفة" : "Select job position"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع الوظائف" : "All Positions"}
                  </SelectItem>
                  {jobPositions.map((position) => (
                    <SelectItem key={position.id} value={position.position_name}>
                      {position.position_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "الموظفون" : "Users"}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllUsers}
                >
                  {language === "ar" ? "تحديد الكل" : "Select All"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectAllUsers}
                >
                  {language === "ar" ? "إلغاء التحديد" : "Deselect All"}
                </Button>
              </div>
            </div>
            <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {users.map((user) => (
                  <div key={user.user_id} className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Checkbox
                      id={user.user_id}
                      checked={selectedUsers.includes(user.user_id)}
                      onCheckedChange={() => toggleUser(user.user_id)}
                    />
                    <label
                      htmlFor={user.user_id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {user.user_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === "ar" 
                ? `${selectedUsers.length} موظف محدد` 
                : `${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''} selected`}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={runReport} disabled={isRunning}>
              <Play className="mr-2 h-4 w-4" />
              {isRunning 
                ? (language === "ar" ? "جاري التشغيل..." : "Running...") 
                : (language === "ar" ? "تشغيل التقرير" : "Run Report")}
            </Button>
            {reportResults.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  {language === "ar" ? "تصدير إلى Excel" : "Export to Excel"}
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  {language === "ar" ? "طباعة" : "Print"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportResults.length > 0 && (
        <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0">
          {/* Report Document Header */}
          <div className="mb-8 pb-6 border-b-2 border-border print:border-black">
            <h1 className="text-2xl font-bold mb-4 print:text-black">
              {language === "ar" ? "تقرير خطة المناوبات" : "Shift Plan Report"}
            </h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">
                  {language === "ar" ? "تفاصيل التقرير" : "Report Details"}
                </p>
                <p className="font-medium print:text-black">
                  {language === "ar" ? "خطة المناوبات حسب التاريخ" : "Shift Plan by Date"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">
                  {language === "ar" ? "تم الإنشاء في" : "Generated On"}
                </p>
                <p className="font-medium print:text-black">{dateRun}</p>
              </div>
            </div>
          </div>

          {/* Selection Criteria */}
          <div className="mb-8 pb-6 border-b border-border print:border-gray-600">
            <h2 className="text-lg font-semibold mb-4 print:text-black">
              {language === "ar" ? "معايير الاختيار" : "Selection Criteria"}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">
                  {language === "ar" ? "من تاريخ" : "From Date"}
                </p>
                <p className="font-medium print:text-black">
                  {dateFrom ? format(new Date(dateFrom), "PPP") : "-"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">
                  {language === "ar" ? "إلى تاريخ" : "To Date"}
                </p>
                <p className="font-medium print:text-black">
                  {dateTo ? format(new Date(dateTo), "PPP") : "-"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">
                  {language === "ar" ? "الوظيفة" : "Job Position"}
                </p>
                <p className="font-medium print:text-black">
                  {selectedJobPosition === "all" 
                    ? (language === "ar" ? "جميع الوظائف" : "All Positions") 
                    : selectedJobPosition}
                </p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">
                  {language === "ar" ? "الموظفون المحددون" : "Selected Users"}
                </p>
                <p className="font-medium print:text-black">
                  {selectedUsers.length === 0 
                    ? (language === "ar" ? "جميع الموظفين" : "All Users")
                    : `${selectedUsers.length} ${language === "ar" ? "موظف" : "user(s)"}`}
                </p>
              </div>
            </div>
          </div>

          {/* Report Data Table */}
          <div className="mb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border print:border-black">
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "التاريخ" : "Date"}
                  </th>
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "الموظف" : "Employee"}
                  </th>
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "الوظيفة" : "Position"}
                  </th>
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "المناوبة" : "Shift"}
                  </th>
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "الوقت" : "Time"}
                  </th>
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "المنطقة" : "Zone"}
                  </th>
                  <th className="text-left py-3 px-2 font-semibold print:text-black">
                    {language === "ar" ? "ملاحظات" : "Notes"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {reportResults.map((row, index) => (
                  <tr key={index} className="border-b border-border print:border-gray-400 hover:bg-muted/50">
                    <td className="py-3 px-2 print:text-black">
                      {format(new Date(row.assignment_date), "yyyy-MM-dd")}
                    </td>
                    <td className="py-3 px-2 print:text-black">{row.user_name}</td>
                    <td className="py-3 px-2 print:text-black">{row.job_position}</td>
                    <td className="py-3 px-2 print:text-black">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full print:hidden" 
                          style={{ backgroundColor: row.shift_color }}
                        />
                        {row.shift_name}
                      </div>
                    </td>
                    <td className="py-3 px-2 print:text-black">
                      {row.shift_start_time} - {row.shift_end_time}
                    </td>
                    <td className="py-3 px-2 print:text-black">{row.zone_name}</td>
                    <td className="py-3 px-2 print:text-black">{row.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Report Footer */}
          <div className="text-xs text-muted-foreground print:text-gray-600 text-right mt-8 pt-4 border-t border-border print:border-gray-600">
            <p>
              {language === "ar" ? "تم الإنشاء في" : "Generated on"} {dateRun}
            </p>
            <p>
              {language === "ar" ? `إجمالي المناوبات: ${reportResults.length}` : `Total Shifts: ${reportResults.length}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftPlanReport;
