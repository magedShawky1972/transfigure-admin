import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, RefreshCw, MapPin, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getKSADateString, formatKSADateTime } from "@/lib/ksaTime";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";

interface ShiftAttendanceRecord {
  id: string;
  user_id: string;
  attendance_date: string;
  check_in_time: string;
  status: string;
  notes: string | null;
  location_lat: number | null;
  location_lng: number | null;
  device_info: string | null;
  created_at: string;
  shift_assignment_id: string | null;
  profiles: {
    user_name: string;
  } | null;
  shift_assignments: {
    shifts: {
      shift_name: string;
      shift_start_time: string;
      shift_end_time: string;
    } | null;
  } | null;
  checkout_time: string | null;
}

export default function ShiftAttendanceReport() {
  const { t, language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();
  const [selectedDate, setSelectedDate] = useState<string>(getKSADateString());
  const [attendanceRecords, setAttendanceRecords] = useState<ShiftAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceRecords();
  }, [selectedDate]);

  const fetchAttendanceRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shift_attendance")
        .select(`
          id,
          user_id,
          attendance_date,
          check_in_time,
          status,
          notes,
          location_lat,
          location_lng,
          device_info,
          created_at,
          shift_assignment_id,
          shift_assignments!shift_attendance_shift_assignment_id_fkey (
            shifts (
              shift_name,
              shift_start_time,
              shift_end_time
            )
          )
        `)
        .eq("attendance_date", selectedDate)
        .order("check_in_time", { ascending: true });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = data?.map((r: any) => r.user_id) || [];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Fetch shift sessions to get checkout time (closed_at)
      const assignmentIds: string[] = (data || [])
        .map((r: any) => r.shift_assignment_id)
        .filter((id: string | null): id is string => id !== null);
      
      const sessionMap = new Map<string, string | null>();
      
      if (assignmentIds.length > 0) {
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("shift_sessions")
          .select("shift_assignment_id, closed_at")
          .gte("created_at", `${selectedDate}T00:00:00`)
          .lt("created_at", `${selectedDate}T23:59:59`);
        
        if (!sessionsError && sessionsData) {
          (sessionsData as any[]).forEach((s: any) => {
            if (assignmentIds.includes(s.shift_assignment_id)) {
              sessionMap.set(s.shift_assignment_id, s.closed_at);
            }
          });
        }
      }
      
      const profileMap = new Map<string, any>();
      (profileData || []).forEach((p: any) => {
        profileMap.set(p.user_id, p);
      });
      
      const enrichedData = data?.map((record: any) => ({
        ...record,
        profiles: profileMap.get(record.user_id) || { user_name: "Unknown" },
        checkout_time: sessionMap.get(record.shift_assignment_id) || null,
      }));

      setAttendanceRecords(enrichedData || []);
    } catch (error: any) {
      console.error("Error fetching attendance records:", error);
      toast.error(language === 'ar' ? "فشل تحميل سجلات الحضور" : "Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  const formatCheckInTime = (dateTimeString: string) => {
    return formatKSADateTime(dateTimeString, true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <Badge variant="default" className="bg-green-600">
            {language === 'ar' ? 'حاضر' : 'Present'}
          </Badge>
        );
      case 'late':
        return (
          <Badge variant="destructive">
            {language === 'ar' ? 'متأخر' : 'Late'}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const getGoogleMapsUrl = (lat: number, lng: number) => {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  };

  if (accessLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className={`container mx-auto p-4 space-y-6 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {language === 'ar' ? "سجل حضور الورديات" : "Shift Attendance Report"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {language === 'ar' ? "التاريخ" : "Date"}
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-48"
              />
            </div>
            <Button onClick={fetchAttendanceRecords} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary */}
          <div className="flex gap-4 flex-wrap">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {language === 'ar' ? 'إجمالي الحضور:' : 'Total Records:'} {attendanceRecords.length}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2 bg-green-50 text-green-700">
              {language === 'ar' ? 'حاضر:' : 'Present:'} {attendanceRecords.filter(r => r.status === 'present').length}
            </Badge>
            <Badge variant="outline" className="text-lg px-4 py-2 bg-red-50 text-red-700">
              {language === 'ar' ? 'متأخر:' : 'Late:'} {attendanceRecords.filter(r => r.status === 'late').length}
            </Badge>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الموظف' : 'Employee'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الوردية' : 'Shift'}</TableHead>
                  <TableHead>{language === 'ar' ? 'وقت البدء' : 'Start Time'}</TableHead>
                  <TableHead>{language === 'ar' ? 'وقت التسجيل' : 'Check-in'}</TableHead>
                  <TableHead>{language === 'ar' ? 'وقت الخروج' : 'Check-out'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الموقع' : 'Location'}</TableHead>
                  <TableHead>{language === 'ar' ? 'ملاحظات' : 'Notes'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                    </TableCell>
                  </TableRow>
                ) : attendanceRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {language === 'ar' ? 'لا توجد سجلات حضور لهذا التاريخ' : 'No attendance records for this date'}
                    </TableCell>
                  </TableRow>
                ) : (
                  attendanceRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {record.profiles?.user_name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.shift_assignments?.shifts?.shift_name || '-'}
                      </TableCell>
                      <TableCell>
                        {record.shift_assignments?.shifts?.shift_start_time || '-'}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatCheckInTime(record.check_in_time)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {record.checkout_time ? formatCheckInTime(record.checkout_time) : '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(record.status)}
                      </TableCell>
                      <TableCell>
                        {record.location_lat && record.location_lng ? (
                          <a
                            href={getGoogleMapsUrl(record.location_lat, record.location_lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <MapPin className="h-4 w-4" />
                            {language === 'ar' ? 'عرض' : 'View'}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {record.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
