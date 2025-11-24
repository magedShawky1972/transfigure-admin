import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface ShiftAssignment {
  id: string;
  assignment_date: string;
  notes: string | null;
  user: {
    user_name: string;
    email: string;
    job_position?: {
      position_name: string;
    };
  };
  shift: {
    shift_name: string;
    shift_start_time: string;
    shift_end_time: string;
    color: string;
    shift_type?: {
      zone_name: string;
      type: string | null;
    };
  };
}

const ShiftReport = () => {
  const { language } = useLanguage();
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedJobPosition, setSelectedJobPosition] = useState<string>("all");
  const [jobPositions, setJobPositions] = useState<any[]>([]);

  useEffect(() => {
    fetchJobPositions();
  }, []);

  const fetchJobPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("is_active", true)
        .order("position_name");

      if (error) throw error;
      setJobPositions(data || []);
    } catch (error) {
      console.error("Error fetching job positions:", error);
      toast.error(language === "ar" ? "فشل في تحميل الوظائف" : "Failed to load job positions");
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      // Fetch shift assignments with shifts
      const { data: assignmentsData, error: assignmentsError } = await supabase
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
        .gte("assignment_date", startDate)
        .lte("assignment_date", endDate)
        .order("assignment_date", { ascending: true });

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
      
      let combinedData = assignmentsData?.map(assignment => ({
        id: assignment.id,
        assignment_date: assignment.assignment_date,
        notes: assignment.notes,
        user: profilesMap.get(assignment.user_id) ? {
          user_name: profilesMap.get(assignment.user_id)?.user_name || "",
          email: profilesMap.get(assignment.user_id)?.email || "",
          job_position: profilesMap.get(assignment.user_id)?.job_positions
        } : null,
        shift: {
          shift_name: assignment.shifts?.shift_name || "",
          shift_start_time: assignment.shifts?.shift_start_time || "",
          shift_end_time: assignment.shifts?.shift_end_time || "",
          color: assignment.shifts?.color || "",
          shift_type: assignment.shifts?.shift_types
        }
      })) || [];

      // Filter by job position if selected
      if (selectedJobPosition !== "all") {
        combinedData = combinedData.filter(
          (assignment: any) => 
            assignment.user?.job_position?.position_name === selectedJobPosition
        );
      }

      setAssignments(combinedData as any);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error(language === "ar" ? "فشل في تحميل التقرير" : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = language === "ar" 
      ? ["التاريخ", "اسم الموظف", "البريد الإلكتروني", "الوظيفة", "المناوبة", "وقت البداية", "وقت النهاية", "المنطقة", "النوع", "ملاحظات"]
      : ["Date", "Employee Name", "Email", "Job Position", "Shift", "Start Time", "End Time", "Zone", "Type", "Notes"];
    
    const rows = assignments.map(assignment => [
      format(new Date(assignment.assignment_date), "yyyy-MM-dd"),
      assignment.user?.user_name || "",
      assignment.user?.email || "",
      assignment.user?.job_position?.position_name || "",
      assignment.shift?.shift_name || "",
      assignment.shift?.shift_start_time || "",
      assignment.shift?.shift_end_time || "",
      assignment.shift?.shift_type?.zone_name || "",
      assignment.shift?.shift_type?.type || "",
      assignment.notes || ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `shift_report_${startDate}_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(language === "ar" ? "تم تصدير التقرير بنجاح" : "Report exported successfully");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {language === "ar" ? "تقرير المناوبات" : "Shift Report"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar" 
            ? "عرض وتصدير تقرير المناوبات مع الفلاتر" 
            : "View and export shift report with filters"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "الفلاتر" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                {language === "ar" ? "من تاريخ" : "From Date"}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                {language === "ar" ? "إلى تاريخ" : "To Date"}
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobPosition">
                {language === "ar" ? "الوظيفة" : "Job Position"}
              </Label>
              <Select value={selectedJobPosition} onValueChange={setSelectedJobPosition}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchAssignments} className="w-full" disabled={loading}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {loading 
                  ? (language === "ar" ? "جاري التحميل..." : "Loading...") 
                  : (language === "ar" ? "عرض التقرير" : "Show Report")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {assignments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {language === "ar" 
                  ? `نتائج التقرير (${assignments.length} مناوبة)` 
                  : `Report Results (${assignments.length} shift${assignments.length > 1 ? 's' : ''})`}
              </CardTitle>
              <Button onClick={exportToCSV} variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                {language === "ar" ? "تصدير إلى CSV" : "Export to CSV"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "اسم الموظف" : "Employee Name"}</TableHead>
                    <TableHead>{language === "ar" ? "الوظيفة" : "Job Position"}</TableHead>
                    <TableHead>{language === "ar" ? "المناوبة" : "Shift"}</TableHead>
                    <TableHead>{language === "ar" ? "وقت البداية" : "Start Time"}</TableHead>
                    <TableHead>{language === "ar" ? "وقت النهاية" : "End Time"}</TableHead>
                    <TableHead>{language === "ar" ? "المنطقة" : "Zone"}</TableHead>
                    <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                    <TableHead>{language === "ar" ? "ملاحظات" : "Notes"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        {format(new Date(assignment.assignment_date), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell>{assignment.user?.user_name || "N/A"}</TableCell>
                      <TableCell>{assignment.user?.job_position?.position_name || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: assignment.shift?.color }}
                          />
                          {assignment.shift?.shift_name || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell>{assignment.shift?.shift_start_time || "N/A"}</TableCell>
                      <TableCell>{assignment.shift?.shift_end_time || "N/A"}</TableCell>
                      <TableCell>{assignment.shift?.shift_type?.zone_name || "N/A"}</TableCell>
                      <TableCell>{assignment.shift?.shift_type?.type || "N/A"}</TableCell>
                      <TableCell>{assignment.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && assignments.length === 0 && startDate && endDate && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {language === "ar" 
              ? "لا توجد مناوبات في الفترة المحددة" 
              : "No shifts found in the specified period"}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftReport;
