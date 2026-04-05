import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Home, Calendar as CalendarIcon, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth } from "date-fns";

const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const CompanyWFHCalendar = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isRTL = language === "ar";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [specificDays, setSpecificDays] = useState<any[]>([]);
  const [recurringDays, setRecurringDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const [{ data: specific }, { data: recurring }] = await Promise.all([
        supabase
          .from("company_wfh_days")
          .select("*")
          .gte("wfh_date", monthStart)
          .lte("wfh_date", monthEnd)
          .order("wfh_date"),
        supabase
          .from("company_wfh_recurring")
          .select("*")
          .order("day_of_week"),
      ]);

      setSpecificDays(specific || []);
      setRecurringDays(recurring || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSpecificDay = async () => {
    if (!newDate) return;
    const { error } = await supabase.from("company_wfh_days").insert({
      wfh_date: newDate,
      description: newDescription || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isRTL ? "تم الإضافة" : "Added", description: isRTL ? "تم إضافة يوم عمل من المنزل" : "WFH day added successfully" });
      setAddDialogOpen(false);
      setNewDate("");
      setNewDescription("");
      fetchData();
    }
  };

  const handleDeleteSpecificDay = async (id: string) => {
    const { error } = await supabase.from("company_wfh_days").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      fetchData();
    }
  };

  const handleToggleRecurring = async (dayOfWeek: number, currentlyActive: boolean, existingId?: string) => {
    if (existingId) {
      const { error } = await supabase
        .from("company_wfh_recurring")
        .update({ is_active: !currentlyActive })
        .eq("id", existingId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("company_wfh_recurring").insert({
        day_of_week: dayOfWeek,
        is_active: true,
      });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    fetchData();
  };

  // Build a set of WFH dates for the calendar
  const wfhDateSet = useMemo(() => {
    const set = new Set<string>();
    // Add specific days
    specificDays.forEach((d) => set.add(d.wfh_date));
    // Add recurring days
    const activeRecurring = recurringDays.filter((r) => r.is_active).map((r) => r.day_of_week);
    if (activeRecurring.length > 0) {
      const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      });
      days.forEach((day) => {
        if (activeRecurring.includes(getDay(day))) {
          set.add(format(day, "yyyy-MM-dd"));
        }
      });
    }
    return set;
  }, [specificDays, recurringDays, currentMonth]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Pad start to align with weekday columns
    const startPadding = getDay(start); // 0=Sun
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);
    paddedDays.push(...days);

    // Pad end to complete the row
    while (paddedDays.length % 7 !== 0) paddedDays.push(null);
    return paddedDays;
  }, [currentMonth]);

  const dayNames = isRTL ? DAY_NAMES_AR : DAY_NAMES_EN;

  // Count WFH days this month
  const wfhCount = wfhDateSet.size;

  return (
    <div className="p-4 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Home className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">
            {isRTL ? "تقويم العمل من المنزل" : "Company WFH Calendar"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                {isRTL ? "إضافة يوم" : "Add Day"}
              </Button>
            </DialogTrigger>
            <DialogContent dir={isRTL ? "rtl" : "ltr"}>
              <DialogHeader>
                <DialogTitle>{isRTL ? "إضافة يوم عمل من المنزل" : "Add WFH Day"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{isRTL ? "التاريخ" : "Date"}</Label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "الوصف (اختياري)" : "Description (optional)"}</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={isRTL ? "مثال: يوم أمطار" : "e.g. Rainy day"}
                  />
                </div>
                <Button onClick={handleAddSpecificDay} className="w-full">
                  {isRTL ? "إضافة" : "Add"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {dayNames.map((name) => (
                <div key={name} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {name.slice(0, 3)}
                </div>
              ))}

              {/* Day cells */}
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`pad-${idx}`} className="h-16" />;
                }
                const dateStr = format(day, "yyyy-MM-dd");
                const isWfh = wfhDateSet.has(dateStr);
                const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                const specificEntry = specificDays.find((d) => d.wfh_date === dateStr);

                return (
                  <div
                    key={dateStr}
                    className={`h-16 rounded-lg border p-1 text-xs transition-colors relative cursor-pointer
                      ${isWfh ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700" : "hover:bg-muted/50"}
                      ${isToday ? "ring-2 ring-primary" : ""}
                    `}
                    onClick={() => {
                      if (!isWfh) {
                        setNewDate(dateStr);
                        setAddDialogOpen(true);
                      }
                    }}
                  >
                    <span className={`font-medium ${isToday ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </span>
                    {isWfh && (
                      <div className="absolute bottom-1 right-1">
                        <Home className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    )}
                    {specificEntry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-5 w-5 text-destructive opacity-0 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSpecificDay(specificEntry.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300" />
                {isRTL ? "يوم عمل من المنزل" : "WFH Day"}
              </div>
              <Badge variant="secondary">
                {isRTL ? `${wfhCount} يوم هذا الشهر` : `${wfhCount} days this month`}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Recurring + Specific List */}
        <div className="space-y-6">
          {/* Recurring Weekly Pattern */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isRTL ? "أيام أسبوعية متكررة" : "Recurring Weekly Days"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                const existing = recurringDays.find((r) => r.day_of_week === dow);
                const isActive = existing?.is_active || false;
                return (
                  <div key={dow} className="flex items-center justify-between">
                    <span className="text-sm">{isRTL ? DAY_NAMES_AR[dow] : DAY_NAMES_EN[dow]}</span>
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => handleToggleRecurring(dow, isActive, existing?.id)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Specific Dates List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isRTL ? "أيام محددة" : "Specific Dates"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {specificDays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isRTL ? "لا توجد أيام محددة هذا الشهر" : "No specific days this month"}
                </p>
              ) : (
                <div className="space-y-2">
                  {specificDays.map((day) => (
                    <div key={day.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{day.wfh_date}</p>
                        {day.description && (
                          <p className="text-xs text-muted-foreground">{day.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteSpecificDay(day.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompanyWFHCalendar;
