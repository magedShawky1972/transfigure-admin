import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, ChevronLeft, ChevronRight, List, Grid3x3 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, addDays, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const formatDateInArabic = (date: Date, formatType: "month" | "monthYear" | "fullDate") => {
  const day = date.getDate();
  const month = arabicMonths[date.getMonth()];
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
}

interface Assignment {
  id: string;
  shift_id: string;
  assignment_date: string;
  shift: Shift;
}

type ViewType = "month" | "week";

const MyShiftsCalendar = () => {
  const { language } = useLanguage();
  const [viewType, setViewType] = useState<ViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [currentDate, viewType]);

  const fetchUserInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setUserName(data.user_name);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(language === 'ar' ? "يجب تسجيل الدخول" : "Please login first");
        return;
      }

      const startDate = getStartDate();
      const endDate = getEndDate();

      const { data, error } = await supabase
        .from("shift_assignments")
        .select(`
          id,
          shift_id,
          assignment_date,
          shifts (
            id,
            shift_name,
            shift_start_time,
            shift_end_time,
            color
          )
        `)
        .eq("user_id", user.id)
        .gte("assignment_date", format(startDate, "yyyy-MM-dd"))
        .lte("assignment_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      const assignmentsWithDetails = data?.map(assignment => ({
        ...assignment,
        shift: assignment.shifts as Shift
      })) || [];

      setAssignments(assignmentsWithDetails);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error(language === 'ar' ? "فشل في تحميل الورديات" : "Failed to load shifts");
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

  const renderMonthView = () => {
    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));
    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(new Date(day));
      day = addDays(day, 1);
    }

    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">
          {arabicDays.map((dayName, index) => (
            <div key={index} className="p-3 text-center font-medium text-sm border-b">
              {dayName}
            </div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day, dayIndex) => {
              const dayAssignments = getAssignmentsForDate(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "min-h-28 p-2 border-b border-r last:border-r-0",
                    !isCurrentMonth && "bg-muted/30",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    !isCurrentMonth && "text-muted-foreground",
                    isToday && "text-primary font-bold"
                  )}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="text-xs p-1.5 rounded truncate"
                        style={{ backgroundColor: assignment.shift.color, color: "white" }}
                        title={`${assignment.shift.shift_name} (${assignment.shift.shift_start_time} - ${assignment.shift.shift_end_time})`}
                      >
                        <div className="font-medium">{assignment.shift.shift_name}</div>
                        <div className="opacity-80">{assignment.shift.shift_start_time} - {assignment.shift.shift_end_time}</div>
                      </div>
                    ))}
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
        {days.map((day, index) => {
          const dayAssignments = getAssignmentsForDate(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card 
              key={index} 
              className={cn(
                "min-h-72",
                isToday && "ring-2 ring-primary"
              )}
            >
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-center">
                  <div className="text-sm text-muted-foreground">{arabicDays[day.getDay()]}</div>
                  <div className={cn(
                    "text-2xl font-bold",
                    isToday && "text-primary"
                  )}>
                    {day.getDate()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {arabicMonths[day.getMonth()]}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 py-2 space-y-2">
                {dayAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-2 rounded text-white text-sm"
                    style={{ backgroundColor: assignment.shift.color }}
                  >
                    <div className="font-medium">{assignment.shift.shift_name}</div>
                    <div className="text-xs opacity-80">
                      {assignment.shift.shift_start_time} - {assignment.shift.shift_end_time}
                    </div>
                  </div>
                ))}
                {dayAssignments.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    {language === 'ar' ? 'لا توجد ورديات' : 'No shifts'}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Calendar className="h-6 w-6" />
                {language === 'ar' ? 'تقويم وردياتي' : 'My Shifts Calendar'}
              </CardTitle>
              {userName && (
                <p className="text-muted-foreground mt-1">
                  {language === 'ar' ? `مرحباً ${userName}` : `Welcome ${userName}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewType === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("month")}
              >
                <Grid3x3 className="h-4 w-4 ml-1" />
                {language === 'ar' ? 'شهر' : 'Month'}
              </Button>
              <Button
                variant={viewType === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("week")}
              >
                <List className="h-4 w-4 ml-1" />
                {language === 'ar' ? 'أسبوع' : 'Week'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="icon" onClick={handlePrevious}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold">
              {formatDateInArabic(currentDate, "monthYear")}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-6">
            <Badge variant="outline" className="text-base py-2 px-4">
              {language === 'ar' ? 'عدد الورديات هذا الشهر:' : 'Shifts this month:'} {assignments.length}
            </Badge>
          </div>

          {/* Calendar View */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : viewType === "month" ? (
            renderMonthView()
          ) : (
            renderWeekView()
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyShiftsCalendar;
