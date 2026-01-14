import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Holiday {
  id: string;
  holiday_name: string;
  holiday_name_ar: string | null;
  holiday_date: string;
  is_recurring: boolean;
}

interface YearlyCalendarGridProps {
  year: number;
  holidays: Holiday[];
}

const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_AR = ["أ", "إ", "ث", "أ", "خ", "ج", "س"];
const MONTHS_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];
const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

const YearlyCalendarGrid = ({ year, holidays }: YearlyCalendarGridProps) => {
  const { language } = useLanguage();
  
  const weekdays = language === "ar" ? WEEKDAYS_AR : WEEKDAYS_EN;
  const months = language === "ar" ? MONTHS_AR : MONTHS_EN;

  const isHoliday = (date: Date): Holiday | undefined => {
    return holidays.find(holiday => {
      const holidayDate = new Date(holiday.holiday_date);
      if (holiday.is_recurring) {
        return holidayDate.getMonth() === date.getMonth() && holidayDate.getDate() === date.getDate();
      }
      return isSameDay(holidayDate, date);
    });
  };

  const getHolidayName = (holiday: Holiday): string => {
    return language === "ar" && holiday.holiday_name_ar 
      ? holiday.holiday_name_ar 
      : holiday.holiday_name;
  };

  const monthData = useMemo(() => {
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const firstDay = new Date(year, monthIndex, 1);
      const lastDay = endOfMonth(firstDay);
      const days = eachDayOfInterval({ start: firstDay, end: lastDay });
      const startPadding = getDay(firstDay);
      
      return {
        monthIndex,
        days,
        startPadding,
      };
    });
  }, [year]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground mb-1">{year}</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {monthData.map(({ monthIndex, days, startPadding }) => (
            <div key={monthIndex} className="border border-border rounded-lg overflow-hidden bg-card">
              {/* Month Header */}
              <div className="bg-primary text-primary-foreground py-2 px-3 text-center font-semibold text-sm">
                {months[monthIndex]}
              </div>
              
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
                {weekdays.map((day, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "text-center py-1 text-xs font-medium",
                      (idx === 0 || idx === 6) ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Days Grid */}
              <div className="grid grid-cols-7 p-1 gap-px">
                {/* Empty cells for padding */}
                {Array.from({ length: startPadding }, (_, i) => (
                  <div key={`empty-${i}`} className="h-6" />
                ))}
                
                {/* Day cells */}
                {days.map((date) => {
                  const holiday = isHoliday(date);
                  const dayOfWeek = getDay(date);
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  
                  const dayCell = (
                    <div
                      className={cn(
                        "h-6 flex items-center justify-center text-xs rounded-sm transition-colors",
                        holiday 
                          ? "bg-primary text-primary-foreground font-bold" 
                          : isWeekend 
                            ? "text-destructive" 
                            : "text-foreground hover:bg-muted"
                      )}
                    >
                      {format(date, "d")}
                    </div>
                  );

                  if (holiday) {
                    return (
                      <Tooltip key={date.toISOString()}>
                        <TooltipTrigger asChild>
                          {dayCell}
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{getHolidayName(holiday)}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(date, "dd/MM/yyyy")}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return <div key={date.toISOString()}>{dayCell}</div>;
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary"></div>
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "إجازة رسمية" : "Official Holiday"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-destructive flex items-center justify-center">
              <span className="text-[8px] text-destructive font-bold">6</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "عطلة نهاية الأسبوع" : "Weekend"}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default YearlyCalendarGrid;
