import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Clock, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
}

interface ShiftAttendanceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  selectedUserId?: string;
  selectedUserName?: string;
}

export default function ShiftAttendanceReportDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedUserId,
  selectedUserName,
}: ShiftAttendanceReportDialogProps) {
  const { language } = useLanguage();
  const [attendanceRecords, setAttendanceRecords] = useState<ShiftAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchAttendanceRecords();
    }
  }, [open, selectedDate, selectedUserId]);

  const fetchAttendanceRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
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

      if (selectedUserId) {
        query = query.eq("user_id", selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles separately
      const userIds = data?.map((r: any) => r.user_id) || [];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      const profileMap = new Map(profileData?.map((p: any) => [p.user_id, p]));
      
      const enrichedData = data?.map((record: any) => ({
        ...record,
        profiles: profileMap.get(record.user_id) || { user_name: "Unknown" },
      }));

      setAttendanceRecords(enrichedData || []);
    } catch (error: any) {
      console.error("Error fetching attendance records:", error);
      toast.error(language === 'ar' ? "فشل تحميل سجلات الحضور" : "Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
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

  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const dialogTitle = selectedUserName 
    ? (language === 'ar' 
        ? `سجل حضور ${selectedUserName} - ${selectedDate}` 
        : `Attendance for ${selectedUserName} - ${selectedDate}`)
    : (language === 'ar' 
        ? `سجل الحضور - ${selectedDate}` 
        : `Attendance Report - ${selectedDate}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl max-h-[80vh] overflow-auto ${language === 'ar' ? 'rtl' : 'ltr'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="flex gap-4 flex-wrap mb-4">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {language === 'ar' ? 'إجمالي:' : 'Total:'} {attendanceRecords.length}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 bg-green-50 text-green-700">
            {language === 'ar' ? 'حاضر:' : 'Present:'} {attendanceRecords.filter(r => r.status === 'present').length}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1 bg-red-50 text-red-700">
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
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'الموقع' : 'Location'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                  </TableCell>
                </TableRow>
              ) : attendanceRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {language === 'ar' ? 'لا توجد سجلات حضور' : 'No attendance records'}
                  </TableCell>
                </TableRow>
              ) : (
                attendanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {record.profiles?.user_name || '-'}
                    </TableCell>
                    <TableCell>
                      {record.shift_assignments?.shifts?.shift_name || '-'}
                    </TableCell>
                    <TableCell>
                      {record.shift_assignments?.shifts?.shift_start_time || '-'}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatTime(record.check_in_time)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record.status)}
                    </TableCell>
                    <TableCell>
                      {record.location_lat && record.location_lng ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openGoogleMaps(record.location_lat!, record.location_lng!)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <MapPin className="h-4 w-4" />
                          {language === 'ar' ? 'عرض' : 'View'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
