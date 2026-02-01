import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { getKSADateString, getKSATimeInMinutes, getKSATimeFormatted } from "@/lib/ksaTime";

interface ShiftAssignment {
  id: string;
  assignment_date: string;
  shift_id: string;
  shifts: {
    shift_name: string;
    shift_start_time: string;
    shift_end_time: string;
  } | null;
}

interface ShiftAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: ShiftAssignment | null;
  userId: string;
  onAttendanceRecorded?: () => void;
}

const ShiftAttendanceDialog = ({
  open,
  onOpenChange,
  assignment,
  userId,
  onAttendanceRecorded,
}: ShiftAttendanceDialogProps) => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'late'>('present');
  const [existingAttendance, setExistingAttendance] = useState<any>(null);
  const [checkingAttendance, setCheckingAttendance] = useState(true);

  useEffect(() => {
    if (open && assignment) {
      checkExistingAttendance();
      getLocation();
      calculateAttendanceStatus();
    }
  }, [open, assignment]);

  const checkExistingAttendance = async () => {
    if (!assignment) return;
    
    setCheckingAttendance(true);
    try {
      const { data, error } = await supabase
        .from("shift_attendance")
        .select("*")
        .eq("user_id", userId)
        .eq("shift_assignment_id", assignment.id)
        .maybeSingle();

      if (error) throw error;
      setExistingAttendance(data);
    } catch (error) {
      console.error("Error checking attendance:", error);
    } finally {
      setCheckingAttendance(false);
    }
  };

  const calculateAttendanceStatus = () => {
    if (!assignment?.shifts) return;
    
    const currentTimeInMinutes = getKSATimeInMinutes();
    const [startHours, startMinutes] = assignment.shifts.shift_start_time.split(':').map(Number);
    const startTimeInMinutes = startHours * 60 + startMinutes;
    
    // If current time is past shift start time, mark as late
    if (currentTimeInMinutes > startTimeInMinutes) {
      setAttendanceStatus('late');
    } else {
      setAttendanceStatus('present');
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(language === 'ar' ? "الموقع الجغرافي غير مدعوم" : "Geolocation not supported");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(
          language === 'ar' 
            ? "تعذر الحصول على الموقع - يرجى تفعيل خدمة الموقع" 
            : "Could not get location - please enable location services"
        );
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleRecordAttendance = async () => {
    if (!assignment) return;

    setLoading(true);
    try {
      const deviceInfo = `${navigator.userAgent} | ${navigator.platform}`;
      
      const { error } = await supabase
        .from("shift_attendance")
        .insert({
          user_id: userId,
          shift_assignment_id: assignment.id,
          attendance_date: getKSADateString(),
          status: attendanceStatus,
          notes: notes.trim() || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          device_info: deviceInfo,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: language === 'ar' ? "تم التسجيل مسبقاً" : "Already Recorded",
            description: language === 'ar' 
              ? "تم تسجيل حضورك لهذه الوردية مسبقاً" 
              : "Your attendance for this shift has already been recorded",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: language === 'ar' ? "تم التسجيل" : "Recorded",
        description: language === 'ar' 
          ? "تم تسجيل حضورك بنجاح" 
          : "Your attendance has been recorded successfully",
      });

      onAttendanceRecorded?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error recording attendance:", error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!assignment) return null;

  const shiftInfo = assignment.shifts;
  const isRTL = language === 'ar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md ${isRTL ? 'rtl' : 'ltr'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {language === 'ar' ? "تسجيل الحضور" : "Record Attendance"}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? "سجل حضورك قبل بدء الوردية"
              : "Record your attendance before the shift starts"}
          </DialogDescription>
        </DialogHeader>

        {checkingAttendance ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : existingAttendance ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
              <CheckCircle className="h-6 w-6" />
              <div>
                <p className="font-medium">
                  {language === 'ar' ? "تم تسجيل حضورك" : "Attendance Recorded"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(existingAttendance.check_in_time).toLocaleString(
                    language === 'ar' ? 'ar-SA' : 'en-US'
                  )}
                </p>
              </div>
            </div>
            <Badge variant={existingAttendance.status === 'present' ? 'default' : 'destructive'}>
              {existingAttendance.status === 'present' 
                ? (language === 'ar' ? 'حاضر' : 'Present')
                : (language === 'ar' ? 'متأخر' : 'Late')
              }
            </Badge>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Shift Info */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? "الوردية:" : "Shift:"}
                </span>
                <span className="font-medium">{shiftInfo?.shift_name || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? "التاريخ:" : "Date:"}
                </span>
                <span className="font-medium">{assignment.assignment_date}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? "الوقت:" : "Time:"}
                </span>
                <span className="font-medium">
                  {shiftInfo?.shift_start_time} - {shiftInfo?.shift_end_time}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {language === 'ar' ? "الوقت الحالي:" : "Current Time:"}
                </span>
                <span className="font-medium">{getKSATimeFormatted()}</span>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {attendanceStatus === 'late' ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {language === 'ar' ? "متأخر" : "Late"}
                </Badge>
              ) : (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {language === 'ar' ? "في الوقت" : "On Time"}
                </Badge>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {language === 'ar' ? "الموقع" : "Location"}
              </Label>
              {locationLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {language === 'ar' ? "جاري تحديد الموقع..." : "Getting location..."}
                </div>
              ) : locationError ? (
                <div className="text-sm text-destructive">{locationError}</div>
              ) : location ? (
                <div className="text-sm text-muted-foreground">
                  {language === 'ar' ? "تم تحديد الموقع ✓" : "Location captured ✓"}
                </div>
              ) : null}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {language === 'ar' ? "ملاحظات (اختياري)" : "Notes (optional)"}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={language === 'ar' ? "أضف ملاحظة..." : "Add a note..."}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {!existingAttendance && !checkingAttendance && (
            <Button 
              onClick={handleRecordAttendance} 
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {language === 'ar' ? "تسجيل الحضور" : "Record Attendance"}
            </Button>
          )}
          {existingAttendance && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              {language === 'ar' ? "إغلاق" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShiftAttendanceDialog;
