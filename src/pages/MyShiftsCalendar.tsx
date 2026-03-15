import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, List, Grid3x3, TableProperties, Headset, ShoppingCart } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, addDays, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const englishDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const englishMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const getContrastColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

const formatDateLocalized = (date: Date, formatType: "month" | "monthYear" | "fullDate", language: string) => {
  const months = language === 'ar' ? arabicMonths : englishMonths;
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  if (formatType === "month") return month;
  if (formatType === "monthYear") return `${month} ${year}`;
  if (formatType === "fullDate") return `${day} ${month} ${year}`;
  return "";
};

interface Shift {
  id: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  color: string;
  shift_type?: string;
}

interface Assignment {
  id: string;
  shift_id: string;
  assignment_date: string;
  shift: Shift;
}

interface ScheduleAssignment {
  assignment_date: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  color: string;
  user_name: string;
}

type ViewType = "month" | "week" | "schedule";

const MyShiftsCalendar = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [viewType, setViewType] = useState<ViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scheduleAssignments, setScheduleAssignments] = useState<ScheduleAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    if (viewType === "schedule") {
      fetchScheduleAssignments();
    } else {
      fetchAssignments();
    }
  }, [currentDate, viewType]);

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("user_name").eq("user_id", user.id).single();
      if (data) setUserName(data.user_name);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(isAr ? "يجب تسجيل الدخول" : "Please login first");
        return;
      }
      const startDate = getStartDate();
      const endDate = getEndDate();
      const { data, error } = await supabase
        .from("shift_assignments")
        .select(`id, shift_id, assignment_date, shifts (id, shift_name, shift_start_time, shift_end_time, color, shift_types (type))`)
        .eq("user_id", user.id)
        .gte("assignment_date", format(startDate, "yyyy-MM-dd"))
        .lte("assignment_date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      setAssignments(data?.map(a => ({ ...a, shift: { ...(a.shifts as any), shift_type: (a.shifts as any)?.shift_types?.type } as Shift })) || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error(isAr ? "فشل في تحميل الورديات" : "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleAssignments = async () => {
    setLoading(true);
    try {
      const startDate = startOfWeek(currentDate);
      const endDate = endOfWeek(currentDate);
      const { data, error } = await supabase
        .from("shift_assignments")
        .select(`assignment_date, shifts (shift_name, shift_start_time, shift_end_time, color), profiles:user_id (user_name)`)
        .gte("assignment_date", format(startDate, "yyyy-MM-dd"))
        .lte("assignment_date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      const mapped: ScheduleAssignment[] = (data || []).map((d: any) => ({
        assignment_date: d.assignment_date,
        shift_name: d.shifts?.shift_name || '',
        shift_start_time: d.shifts?.shift_start_time || '',
        shift_end_time: d.shifts?.shift_end_time || '',
        color: d.shifts?.color || '#888',
        user_name: d.profiles?.user_name || '-',
      }));
      setScheduleAssignments(mapped);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast.error(isAr ? "فشل في تحميل الجدول" : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    if (viewType === "month") return startOfWeek(startOfMonth(currentDate));
    return startOfWeek(currentDate);
  };
  const getEndDate = () => {
    if (viewType === "month") return endOfWeek(endOfMonth(currentDate));
    return endOfWeek(currentDate);
  };

  const handlePrevious = () => {
    if (viewType === "month") setCurrentDate(addMonths(currentDate, -1));
    else setCurrentDate(addWeeks(currentDate, -1));
  };
  const handleNext = () => {
    if (viewType === "month") setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };

  const getAssignmentsForDate = (date: Date) => {
    return assignments.filter(a => isSameDay(new Date(a.assignment_date), date));
  };

  const dayNames = isAr ? arabicDays : englishDays;

  const renderMonthView = () => {
    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));
    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) { days.push(new Date(day)); day = addDays(day, 1); }
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">
          {dayNames.map((name, i) => (
            <div key={i} className="p-3 text-center font-medium text-sm border-b">{name}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((d, di) => {
              const da = getAssignmentsForDate(d);
              const isToday = isSameDay(d, new Date());
              const isCurrent = isSameMonth(d, currentDate);
              return (
                <div key={di} className={cn("min-h-28 p-2 border-b border-r last:border-r-0", !isCurrent && "bg-muted/30", isToday && "bg-primary/5")}>
                  <div className={cn("text-sm font-medium mb-1", !isCurrent && "text-muted-foreground", isToday && "text-primary font-bold")}>{d.getDate()}</div>
                  <div className="space-y-1">
                    {da.map(a => {
                      const isSupport = a.shift.shift_type?.toLowerCase() === 'support';
                      return (
                      <div key={a.id} className="text-xs p-1.5 rounded truncate" style={{ backgroundColor: a.shift.color, color: getContrastColor(a.shift.color || '#888') }} title={`${a.shift.shift_name} (${a.shift.shift_start_time} - ${a.shift.shift_end_time})${isSupport ? ' [Support]' : ''}`}>
                        <div className="font-medium flex items-center gap-1">
                          {isSupport ? <Headset className="h-3 w-3 shrink-0" /> : <ShoppingCart className="h-3 w-3 shrink-0" />}
                          {a.shift.shift_name}
                        </div>
                        <div className="opacity-80">{a.shift.shift_start_time} - {a.shift.shift_end_time}</div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    return (
      <div className="grid grid-cols-7 gap-3">
        {days.map((d, i) => {
          const da = getAssignmentsForDate(d);
          const isToday = isSameDay(d, new Date());
          const months = isAr ? arabicMonths : englishMonths;
          return (
            <Card key={i} className={cn("min-h-72", isToday && "ring-2 ring-primary")}>
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-center">
                  <div className="text-sm text-muted-foreground">{dayNames[d.getDay()]}</div>
                  <div className={cn("text-2xl font-bold", isToday && "text-primary")}>{d.getDate()}</div>
                  <div className="text-xs text-muted-foreground">{months[d.getMonth()]}</div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 py-2 space-y-2">
                {da.map(a => (
                  <div key={a.id} className="p-2 rounded text-sm" style={{ backgroundColor: a.shift.color, color: getContrastColor(a.shift.color || '#888') }}>
                    <div className="font-medium">{a.shift.shift_name}</div>
                    <div className="text-xs opacity-80">{a.shift.shift_start_time} - {a.shift.shift_end_time}</div>
                  </div>
                ))}
                {da.length === 0 && <div className="text-center text-muted-foreground text-sm py-4">{isAr ? 'لا توجد ورديات' : 'No shifts'}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderScheduleView = () => {
    const startDate = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    // Get unique shifts sorted by start time
    const shiftMap = new Map<string, { name: string; start: string; end: string; color: string }>();
    scheduleAssignments.forEach(a => {
      const key = `${a.shift_start_time}-${a.shift_end_time}`;
      if (!shiftMap.has(key)) {
        shiftMap.set(key, { name: a.shift_name, start: a.shift_start_time, end: a.shift_end_time, color: a.color });
      }
    });
    const shifts = Array.from(shiftMap.entries()).sort((a, b) => a[1].start.localeCompare(b[1].start));

    const getAssignment = (date: Date, shiftStart: string, shiftEnd: string) => {
      const dateStr = format(date, "yyyy-MM-dd");
      return scheduleAssignments.filter(a => a.assignment_date === dateStr && a.shift_start_time === shiftStart && a.shift_end_time === shiftEnd);
    };

    const formatTime = (t: string) => t?.substring(0, 5) || '';

    return (
      <div className="space-y-4">
        {/* Color Legend */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap gap-4 items-center justify-center">
              <span className="font-semibold text-sm">{isAr ? '🎨 ترميز الألوان' : '🎨 Color Coding'}</span>
              {shifts.map(([key, s]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm">{s.name}: {formatTime(s.start)} – {formatTime(s.end)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Schedule Grid */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center font-bold min-w-[100px]">{isAr ? 'اليوم' : 'Day'}</TableHead>
                {shifts.map(([key, s]) => (
                  <TableHead key={key} className="text-center min-w-[120px]" style={{ backgroundColor: s.color, color: getContrastColor(s.color || '#888') }}>
                    {formatTime(s.start)} – {formatTime(s.end)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d, i) => {
                const isToday = isSameDay(d, new Date());
                return (
                  <TableRow key={i} className={cn(isToday && "bg-primary/5")}>
                    <TableCell className={cn("text-center font-medium", isToday && "font-bold text-primary")}>
                      <div>{dayNames[d.getDay()]}</div>
                      <div className="text-xs text-muted-foreground">{format(d, "MM/dd")}</div>
                    </TableCell>
                    {shifts.map(([key, s]) => {
                      const cellAssignments = getAssignment(d, s.start, s.end);
                      return (
                        <TableCell key={key} className="text-center p-1">
                          {cellAssignments.map((ca, ci) => (
                            <div key={ci} className="rounded px-2 py-1.5 font-medium text-sm mb-1" style={{ backgroundColor: s.color, color: getContrastColor(s.color || '#888') }}>
                              {ca.user_name}
                            </div>
                          ))}
                          {cellAssignments.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className={`container mx-auto py-6 space-y-6 ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Calendar className="h-6 w-6" />
                {isAr ? 'تقويم الورديات' : 'Shifts Calendar'}
              </CardTitle>
              {userName && (
                <p className="text-muted-foreground mt-1">
                  {isAr ? `مرحباً ${userName}` : `Welcome ${userName}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={viewType === "month" ? "default" : "outline"} size="sm" onClick={() => setViewType("month")}>
                <Grid3x3 className="h-4 w-4 me-1" />
                {isAr ? 'شهر' : 'Month'}
              </Button>
              <Button variant={viewType === "week" ? "default" : "outline"} size="sm" onClick={() => setViewType("week")}>
                <List className="h-4 w-4 me-1" />
                {isAr ? 'أسبوع' : 'Week'}
              </Button>
              <Button variant={viewType === "schedule" ? "default" : "outline"} size="sm" onClick={() => setViewType("schedule")}>
                <TableProperties className="h-4 w-4 me-1" />
                {isAr ? 'جدول الورديات' : 'Schedule'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="icon" onClick={handlePrevious}>
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <h2 className="text-xl font-semibold">
              {viewType === "schedule"
                ? `${formatDateLocalized(startOfWeek(currentDate), "fullDate", language)} - ${formatDateLocalized(endOfWeek(currentDate), "fullDate", language)}`
                : formatDateLocalized(currentDate, "monthYear", language)}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNext}>
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>

          {/* Stats */}
          {viewType !== "schedule" && (
            <div className="flex gap-4 mb-6">
              <Badge variant="outline" className="text-base py-2 px-4">
                {isAr ? 'عدد الورديات:' : 'Shifts count:'} {assignments.length}
              </Badge>
            </div>
          )}

          {/* Views */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : viewType === "month" ? renderMonthView() : viewType === "week" ? renderWeekView() : renderScheduleView()}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyShiftsCalendar;
