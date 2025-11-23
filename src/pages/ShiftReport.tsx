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
      toast.error("فشل في تحميل الوظائف");
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("shift_assignments")
        .select(`
          id,
          assignment_date,
          notes,
          user:profiles!shift_assignments_user_id_fkey (
            user_name,
            email,
            job_position:job_positions (
              position_name
            )
          ),
          shift:shifts (
            shift_name,
            shift_start_time,
            shift_end_time,
            color,
            shift_type:shift_types (
              zone_name,
              type
            )
          )
        `)
        .gte("assignment_date", startDate)
        .lte("assignment_date", endDate)
        .order("assignment_date", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Filter by job position if selected
      let filteredData = data || [];
      if (selectedJobPosition !== "all") {
        filteredData = filteredData.filter(
          (assignment: any) => 
            assignment.user?.job_position?.position_name === selectedJobPosition
        );
      }

      setAssignments(filteredData as any);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("فشل في تحميل التقرير");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["التاريخ", "اسم الموظف", "البريد الإلكتروني", "الوظيفة", "المناوبة", "وقت البداية", "وقت النهاية", "المنطقة", "النوع", "ملاحظات"];
    
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

    toast.success("تم تصدير التقرير بنجاح");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">تقرير المناوبات</h1>
        <p className="text-muted-foreground">
          عرض وتصدير تقرير المناوبات مع الفلاتر
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الفلاتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">من تاريخ</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">إلى تاريخ</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobPosition">الوظيفة</Label>
              <Select value={selectedJobPosition} onValueChange={setSelectedJobPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الوظيفة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الوظائف</SelectItem>
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
                {loading ? "جاري التحميل..." : "عرض التقرير"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {assignments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>نتائج التقرير ({assignments.length} مناوبة)</CardTitle>
              <Button onClick={exportToCSV} variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                تصدير إلى CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>اسم الموظف</TableHead>
                    <TableHead>الوظيفة</TableHead>
                    <TableHead>المناوبة</TableHead>
                    <TableHead>وقت البداية</TableHead>
                    <TableHead>وقت النهاية</TableHead>
                    <TableHead>المنطقة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>ملاحظات</TableHead>
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
            لا توجد مناوبات في الفترة المحددة
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftReport;
