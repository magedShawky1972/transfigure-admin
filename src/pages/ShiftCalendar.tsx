import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar as CalendarIcon, List, Grid3x3, ChevronLeft, ChevronRight, Plus, Send, Users, Check } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, addDays, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const arabicDays = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const arabicMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const formatDateInArabic = (date: Date, formatType: "month" | "monthYear" | "dateRange" | "fullDate") => {
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
  shift_type_id?: string;
  shift_type?: string;
  job_positions?: string[];
}

interface ShiftType {
  id: string;
  zone_name: string;
  type: string | null;
}

interface User {
  user_id: string;
  user_name: string;
  job_position_id: string | null;
  job_position_name?: string;
}

interface Assignment {
  id: string;
  shift_id: string;
  user_id: string;
  assignment_date: string;
  shift: Shift;
  user: User;
}

type ViewType = "month" | "week" | "day";

const ShiftCalendar = () => {
  const [viewType, setViewType] = useState<ViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [selectedShiftType, setSelectedShiftType] = useState<string>("all");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [quickAssignDate, setQuickAssignDate] = useState<Date | null>(null);
  const [selectedQuickShift, setSelectedQuickShift] = useState<Shift | null>(null);
  const [selectedQuickUser, setSelectedQuickUser] = useState<User | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  
  // Send notifications dialog state
  const [sendNotificationDialogOpen, setSendNotificationDialogOpen] = useState(false);
  const [notificationStartDate, setNotificationStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [notificationEndDate, setNotificationEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectAllUsers, setSelectAllUsers] = useState(false);
  const [shiftRelatedUsers, setShiftRelatedUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchShifts();
    fetchUsers();
    fetchShiftTypes();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [currentDate, viewType]);

  useEffect(() => {
    if (selectedQuickShift) {
      fetchAvailableUsers();
    } else {
      setAvailableUsers([]);
    }
  }, [selectedQuickShift]);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          shift_types (zone_name, type),
          shift_job_positions (
            job_position_id,
            job_positions (position_name)
          )
        `)
        .eq("is_active", true);

      if (error) throw error;

      const shiftsWithPositions = data?.map(shift => ({
        ...shift,
        shift_type: shift.shift_types?.type,
        job_positions: shift.shift_job_positions?.map((sjp: any) => sjp.job_position_id) || []
      })) || [];

      console.log("Fetched shifts with types:", shiftsWithPositions);
      setShifts(shiftsWithPositions);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error("Failed to fetch shifts");
    }
  };

  const fetchShiftTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("shift_types")
        .select("*")
        .eq("is_active", true)
        .order("type");

      if (error) throw error;
      setShiftTypes(data || []);
    } catch (error) {
      console.error("Error fetching shift types:", error);
      toast.error("Failed to fetch shift types");
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_id,
          user_name,
          job_position_id,
          job_positions (position_name)
        `)
        .eq("is_active", true);

      if (error) throw error;

      const usersWithPositions = data?.map(user => ({
        ...user,
        job_position_name: user.job_positions?.position_name
      })) || [];

      setUsers(usersWithPositions);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    }
  };

  const fetchAvailableUsers = async () => {
    if (!selectedQuickShift) return;

    try {
      const jobPositionIds = selectedQuickShift.job_positions || [];
      
      if (jobPositionIds.length === 0) {
        setAvailableUsers([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_id,
          user_name,
          job_position_id,
          job_positions (position_name)
        `)
        .in("job_position_id", jobPositionIds)
        .eq("is_active", true);

      if (error) throw error;

      const usersWithPositions = data?.map(user => ({
        ...user,
        job_position_name: user.job_positions?.position_name
      })) || [];

      setAvailableUsers(usersWithPositions);
    } catch (error) {
      console.error("Error fetching available users:", error);
      toast.error("Failed to fetch available users");
    }
  };

  const fetchAssignments = async () => {
    try {
      const startDate = getStartDate();
      const endDate = getEndDate();

      const { data, error } = await supabase
        .from("shift_assignments")
        .select(`
          *,
          shifts!inner (
            id,
            shift_name,
            shift_start_time,
            shift_end_time,
            color,
            shift_types (type),
            shift_job_positions (
              job_position_id
            )
          )
        `)
        .gte("assignment_date", format(startDate, "yyyy-MM-dd"))
        .lte("assignment_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;

      // Fetch user details separately
      const userIds = data?.map(a => a.user_id) || [];
      const { data: usersData } = await supabase
        .from("profiles")
        .select("user_id, user_name, job_position_id")
        .in("user_id", userIds);

      const userMap = new Map(usersData?.map(u => [u.user_id, u]) || []);

      const assignmentsWithDetails = data?.map(assignment => ({
        ...assignment,
        shift: {
          ...assignment.shifts,
          shift_type: assignment.shifts.shift_types?.type,
          job_positions: assignment.shifts.shift_job_positions?.map((sjp: any) => sjp.job_position_id) || []
        },
        user: userMap.get(assignment.user_id) || {
          user_id: assignment.user_id,
          user_name: "Unknown",
          job_position_id: null
        }
      })) || [];

      setAssignments(assignmentsWithDetails as Assignment[]);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast.error("Failed to fetch assignments");
    }
  };

  const getStartDate = () => {
    if (viewType === "month") return startOfWeek(startOfMonth(currentDate));
    if (viewType === "week") return startOfWeek(currentDate);
    return currentDate;
  };

  const getEndDate = () => {
    if (viewType === "month") return endOfWeek(endOfMonth(currentDate));
    if (viewType === "week") return endOfWeek(currentDate);
    return currentDate;
  };

  const handlePrevious = () => {
    if (viewType === "month") setCurrentDate(addMonths(currentDate, -1));
    else if (viewType === "week") setCurrentDate(addWeeks(currentDate, -1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (viewType === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewType === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleAddShift = (date: Date, e: React.MouseEvent) => {
    // Check if click was on the date cell itself, not an assignment
    if ((e.target as HTMLElement).closest('.assignment-item')) {
      return;
    }
    
    // If shift and user are selected, toggle date for bulk assignment
    if (selectedQuickShift && selectedQuickUser) {
      setSelectedDates(prev => {
        const dateExists = prev.some(d => isSameDay(d, date));
        if (dateExists) {
          return prev.filter(d => !isSameDay(d, date));
        } else {
          return [...prev, date];
        }
      });
    } else {
      // Original behavior - open shift selection dialog
      setQuickAssignDate(date);
      setSelectedDate(date);
      setShiftDialogOpen(true);
    }
  };

  const handleQuickShiftSelect = (shift: Shift) => {
    if (!quickAssignDate) return;
    setSelectedDate(quickAssignDate);
    setSelectedShift(shift);
    setUserDialogOpen(true);
  };

  const handleEditAssignment = (assignment: Assignment, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAssignment(assignment);
    setEditDialogOpen(true);
  };

  const handleDeleteAssignment = async () => {
    if (!selectedAssignment) return;

    setLoading(true);
    try {
      // Check if there are any shift sessions associated with this assignment
      const { data: sessions, error: sessionsError } = await supabase
        .from("shift_sessions")
        .select("id")
        .eq("shift_assignment_id", selectedAssignment.id);

      if (sessionsError) throw sessionsError;

      // Delete all associated shift sessions first (including closed ones)
      if (sessions && sessions.length > 0) {
        // Delete each session individually to ensure proper cascade
        for (const session of sessions) {
          // First delete brand balances for this session
          const { error: balanceError } = await supabase
            .from("shift_brand_balances")
            .delete()
            .eq("shift_session_id", session.id);
          
          if (balanceError) throw balanceError;

          // Then delete the session itself
          const { error: sessionError } = await supabase
            .from("shift_sessions")
            .delete()
            .eq("id", session.id);

          if (sessionError) throw sessionError;
        }
      }

      // Now delete the assignment
      const { error } = await supabase
        .from("shift_assignments")
        .delete()
        .eq("id", selectedAssignment.id);

      if (error) throw error;

      toast.success("تم حذف الإسناد وجميع الجلسات المرتبطة بنجاح");
      setEditDialogOpen(false);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      
      // Check if it's a foreign key constraint error
      if (error.code === "23503") {
        toast.error("لا يمكن حذف هذا الإسناد لأنه مرتبط بجلسات ورديات. يجب حذف الجلسات أولاً.");
      } else {
        toast.error("فشل في حذف الإسناد");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = () => {
    if (!selectedAssignment) return;
    setSelectedDate(new Date(selectedAssignment.assignment_date));
    setSelectedShift(selectedAssignment.shift);
    setEditDialogOpen(false);
    setUserDialogOpen(true);
  };

  const handleUserReassign = async (userId: string) => {
    if (!selectedAssignment) {
      handleUserSelect(userId);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("shift_assignments")
        .update({ user_id: userId })
        .eq("id", selectedAssignment.id);

      if (error) throw error;

      toast.success("تم إعادة إسناد الوردية بنجاح");
      setUserDialogOpen(false);
      setSelectedShift(null);
      setSelectedDate(null);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error reassigning shift:", error);
      toast.error("فشل في إعادة إسناد الوردية");
    } finally {
      setLoading(false);
    }
  };

  const handleShiftSelect = (shift: Shift) => {
    setSelectedShift(shift);
    setShiftDialogOpen(false);
    setUserDialogOpen(true);
  };

  const handleUserSelect = async (userId: string) => {
    // If reassigning, use different handler
    if (selectedAssignment) {
      handleUserReassign(userId);
      return;
    }

    if (!selectedDate || !selectedShift) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: selectedShift.id,
          user_id: userId,
          assignment_date: format(selectedDate, "yyyy-MM-dd"),
        });

      if (error) throw error;

      toast.success("تم إسناد الوردية بنجاح");
      setUserDialogOpen(false);
      setSelectedShift(null);
      setSelectedDate(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error assigning shift:", error);
      toast.error("فشل في إسناد الوردية");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssignment = async () => {
    if (!selectedQuickShift || !selectedQuickUser || selectedDates.length === 0) {
      toast.error("Please select shift, user, and at least one date");
      return;
    }

    setLoading(true);
    try {
      const assignments = selectedDates.map(date => ({
        shift_id: selectedQuickShift.id,
        user_id: selectedQuickUser.user_id,
        assignment_date: format(date, "yyyy-MM-dd"),
      }));

      const { error } = await supabase
        .from("shift_assignments")
        .insert(assignments);

      if (error) throw error;

      toast.success(`تم إسناد ${selectedDates.length} وردية بنجاح إلى ${selectedQuickUser.user_name}`);
      setSelectedDates([]);
      setSelectedQuickShift(null);
      setSelectedQuickUser(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error creating bulk assignments:", error);
      toast.error("فشل في إنشاء الإسنادات");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedQuickShift(null);
    setSelectedQuickUser(null);
    setSelectedDates([]);
  };

  const openSendNotificationDialog = () => {
    // Reset states
    setNotificationStartDate(startOfMonth(currentDate));
    setNotificationEndDate(endOfMonth(currentDate));
    setSelectedUserIds([]);
    setSelectAllUsers(false);
    
    // Collect all job position IDs from shifts
    const allJobPositionIds = new Set<string>();
    shifts.forEach(shift => {
      shift.job_positions?.forEach(posId => {
        if (posId) allJobPositionIds.add(posId);
      });
    });
    
    // Filter users who have job positions related to shifts
    const relatedUsers = users.filter(user => 
      user.job_position_id && allJobPositionIds.has(user.job_position_id)
    );
    setShiftRelatedUsers(relatedUsers);
    
    setSendNotificationDialogOpen(true);
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleToggleAllUsers = (checked: boolean) => {
    setSelectAllUsers(checked);
    if (checked) {
      setSelectedUserIds(shiftRelatedUsers.map(u => u.user_id));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleSendNotifications = async () => {
    if (!notificationStartDate || !notificationEndDate) {
      toast.error("يرجى تحديد نطاق التاريخ");
      return;
    }
    
    if (selectedUserIds.length === 0) {
      toast.error("يرجى اختيار مستخدم واحد على الأقل");
      return;
    }

    setSendingNotifications(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-shift-notifications", {
        body: {
          startDate: format(notificationStartDate, "yyyy-MM-dd"),
          endDate: format(notificationEndDate, "yyyy-MM-dd"),
          userIds: selectedUserIds,
        },
      });

      if (error) throw error;

      toast.success(data.message || "تم إرسال الإشعارات بنجاح");
      setSendNotificationDialogOpen(false);
    } catch (error) {
      console.error("Error sending notifications:", error);
      toast.error("فشل في إرسال الإشعارات");
    } finally {
      setSendingNotifications(false);
    }
  };

  const getAssignmentsForDate = (date: Date) => {
    const dateAssignments = assignments.filter(a => isSameDay(new Date(a.assignment_date), date));
    
    if (selectedShiftType === "all") {
      return dateAssignments;
    }
    
    const filtered = dateAssignments.filter(a => {
      const shiftType = a.shift.shift_type;
      console.log("Comparing shift type:", shiftType, "with selected:", selectedShiftType);
      return shiftType === selectedShiftType;
    });
    
    console.log("Filtered assignments:", filtered.length, "out of", dateAssignments.length);
    return filtered;
  };

  const getFilteredShifts = () => {
    if (selectedShiftType === "all") {
      return shifts;
    }
    return shifts.filter(s => s.shift_type === selectedShiftType);
  };

  const getFilteredUsers = () => {
    if (!selectedShift || selectedShift.job_positions?.length === 0) {
      return users;
    }
    return users.filter(user => 
      user.job_position_id && selectedShift.job_positions?.includes(user.job_position_id)
    );
  };

  const renderCalendarGrid = () => {
    const days: Date[] = [];
    const startDate = getStartDate();
    const endDate = getEndDate();
    
    let currentDay = startDate;
    while (currentDay <= endDate) {
      days.push(currentDay);
      currentDay = addDays(currentDay, 1);
    }

    const minHeightClass = viewType === "month" ? "min-h-32" : viewType === "week" ? "min-h-72" : "min-h-64";

    return (
      <div className="grid grid-cols-7 gap-2">
        {arabicDays.map((day, idx) => (
          <div key={idx} className="text-center font-medium text-sm text-muted-foreground py-2">
            {day}
          </div>
        ))}
        {days.map((day, idx) => {
          const dayAssignments = getAssignmentsForDate(day);
          const isCurrentMonth = viewType === "month" ? isSameMonth(day, currentDate) : true;
          const isToday = isSameDay(day, new Date());

          const isSelected = selectedDates.some(d => isSameDay(d, day));

          return (
            <div
              key={idx}
              className={cn(
                minHeightClass,
                "border rounded-lg p-2 cursor-pointer hover:bg-accent/50 transition-colors overflow-y-auto",
                !isCurrentMonth && "opacity-40 bg-muted/20",
                isToday && "border-primary border-2",
                isSelected && selectedQuickShift && "ring-4 ring-primary ring-offset-1 shadow-lg"
              )}
              style={isSelected && selectedQuickShift ? {
                backgroundColor: `${selectedQuickShift.color}15`,
              } : {}}
              onClick={(e) => handleAddShift(day, e)}
            >
              <div className={cn(
                "text-sm font-medium mb-2 sticky top-0 bg-background/95 backdrop-blur-sm pb-1",
                isToday && "text-primary"
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayAssignments.map((assignment, i) => (
                  <div
                    key={i}
                    className="assignment-item text-xs p-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ 
                      backgroundColor: assignment.shift.color + '20',
                      borderLeft: `3px solid ${assignment.shift.color}`
                    }}
                    onClick={(e) => handleEditAssignment(assignment, e)}
                    title="Click to edit or reassign"
                  >
                    <div className="font-medium truncate" style={{ color: assignment.shift.color }}>
                      {assignment.shift.shift_name}
                    </div>
                    <div className="text-foreground/70 truncate">
                      {assignment.user.user_name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                تقويم الورديات
              </CardTitle>
              <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="تصفية حسب النوع" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {Array.from(new Set(shiftTypes.map(st => st.type).filter(Boolean))).map(type => (
                    <SelectItem key={type} value={type!}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={openSendNotificationDialog}
              >
                <Send className="h-4 w-4 mr-1" />
                إرسال الإشعارات
              </Button>
              <Button
                variant={viewType === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("day")}
              >
                <List className="h-4 w-4 mr-1" />
                يوم
              </Button>
              <Button
                variant={viewType === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("week")}
              >
                <Grid3x3 className="h-4 w-4 mr-1" />
                أسبوع
              </Button>
              <Button
                variant={viewType === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("month")}
              >
                <Calendar className="h-4 w-4 mr-1" />
                شهر
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Quick Shift Selection Buttons - Always visible based on type filter */}
          {getFilteredShifts().length > 0 && (
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="text-sm font-medium mb-3 text-muted-foreground">
                الورديات المتاحة:
              </div>
              <div className="flex flex-wrap gap-2">
                {getFilteredShifts().map(shift => (
                  <Button
                    key={shift.id}
                    variant={selectedQuickShift?.id === shift.id ? "default" : "outline"}
                    className={cn(
                      "h-auto py-2 px-4 transition-all duration-200",
                      selectedQuickShift?.id === shift.id && "ring-2 ring-offset-2 shadow-lg"
                    )}
                    onClick={() => setSelectedQuickShift(shift)}
                    style={{ 
                      borderColor: shift.color,
                      borderWidth: '2px',
                      backgroundColor: selectedQuickShift?.id === shift.id ? shift.color : 'transparent',
                      color: selectedQuickShift?.id === shift.id ? 'white' : 'inherit'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full ring-1 ring-white/30"
                        style={{ 
                          backgroundColor: selectedQuickShift?.id === shift.id ? 'white' : shift.color 
                        }}
                      />
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-sm">{shift.shift_name}</span>
                        <span className={cn(
                          "text-xs",
                          selectedQuickShift?.id === shift.id ? "text-white/80" : "text-muted-foreground"
                        )}>
                          {shift.shift_start_time} - {shift.shift_end_time}
                        </span>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Available Users Sidebar - Show when a shift is selected */}
          {selectedQuickShift && availableUsers.length > 0 && (
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-muted-foreground">
                  المستخدمون المتاحون لـ {selectedQuickShift.shift_name}:
                </div>
                {selectedQuickUser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedQuickUser(null)}
                  >
                    مسح المستخدم
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {availableUsers.map(user => (
                  <Button
                    key={user.user_id}
                    variant={selectedQuickUser?.user_id === user.user_id ? "default" : "outline"}
                    className={cn(
                      "h-auto py-3 px-3 justify-start transition-all duration-200",
                      selectedQuickUser?.user_id === user.user_id 
                        ? "ring-2 ring-offset-2 shadow-lg" 
                        : "hover:scale-105 hover:shadow-md hover:border-primary hover:bg-primary/5 active:scale-95"
                    )}
                    onClick={() => setSelectedQuickUser(user)}
                  >
                    <div className="flex flex-col items-start gap-1 w-full">
                      <div className="font-medium text-sm truncate w-full">{user.user_name}</div>
                      <div className="text-xs truncate w-full"
                        style={{
                          color: selectedQuickUser?.user_id === user.user_id ? 'rgba(255,255,255,0.8)' : undefined
                        }}
                      >
                        {user.job_position_name}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Bulk Assignment Actions - Show when user is selected */}
          {selectedQuickShift && selectedQuickUser && (
            <div className="mb-4 p-4 bg-primary/10 rounded-lg border-2 border-primary/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold">
                    إسناد: {selectedQuickShift.shift_name} إلى {selectedQuickUser.user_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedDates.length > 0 
                      ? `تم تحديد ${selectedDates.length} تاريخ - انقر على تواريخ التقويم للإضافة/الإزالة` 
                      : "انقر على تواريخ التقويم لتحديدها"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                  >
                    مسح الكل
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleBulkAssignment}
                    disabled={loading || selectedDates.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    إسناد {selectedDates.length > 0 && `(${selectedDates.length})`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold">
              {viewType === "month" && formatDateInArabic(currentDate, "monthYear")}
              {viewType === "week" && `${formatDateInArabic(getStartDate(), "fullDate")} - ${formatDateInArabic(getEndDate(), "fullDate")}`}
              {viewType === "day" && formatDateInArabic(currentDate, "fullDate")}
            </h2>
            <Button variant="outline" size="sm" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {renderCalendarGrid()}
        </CardContent>
      </Card>

      {/* Shift Selection Dialog */}
      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اختر الوردية</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {getFilteredShifts().map(shift => (
              <Button
                key={shift.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleShiftSelect(shift)}
              >
                <div
                  className="w-4 h-4 rounded mr-3"
                  style={{ backgroundColor: shift.color }}
                />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{shift.shift_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {shift.shift_start_time} - {shift.shift_end_time}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* User Selection Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAssignment ? "إعادة إسناد الموظف" : "اختر الموظف"}</DialogTitle>
            {selectedShift && (
              <p className="text-sm text-muted-foreground">
                {selectedAssignment ? "إعادة الإسناد" : "الإسناد"}: {selectedShift.shift_name} ({selectedShift.shift_start_time} - {selectedShift.shift_end_time})
              </p>
            )}
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {getFilteredUsers().map(user => (
              <Button
                key={user.user_id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleUserSelect(user.user_id)}
                disabled={loading}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{user.user_name}</span>
                  {user.job_position_name && (
                    <span className="text-sm text-muted-foreground">
                      {user.job_position_name}
                    </span>
                  )}
                </div>
              </Button>
            ))}
            {getFilteredUsers().length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                لم يتم العثور على موظفين لمناصب هذه الوردية
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل إسناد الوردية</DialogTitle>
          </DialogHeader>
          {selectedAssignment && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: selectedAssignment.shift.color }}
                  />
                  <span className="font-medium">{selectedAssignment.shift.shift_name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedAssignment.shift.shift_start_time} - {selectedAssignment.shift.shift_end_time}
                </div>
                <div className="text-sm">
                  مسند إلى: <span className="font-medium">{selectedAssignment.user.user_name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  التاريخ: {formatDateInArabic(new Date(selectedAssignment.assignment_date), "fullDate")}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReassign}
                  disabled={loading}
                >
                  إعادة الإسناد
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteAssignment}
                  disabled={loading}
                >
                  حذف
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Notifications Dialog */}
      <Dialog open={sendNotificationDialogOpen} onOpenChange={setSendNotificationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              إرسال إشعارات الورديات
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Date Range Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">نطاق التاريخ</Label>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">من:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !notificationStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {notificationStartDate ? format(notificationStartDate, "yyyy-MM-dd") : "اختر التاريخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-[9999]" align="start" sideOffset={4}>
                      <Calendar
                        mode="single"
                        selected={notificationStartDate}
                        onSelect={setNotificationStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">إلى:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !notificationEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {notificationEndDate ? format(notificationEndDate, "yyyy-MM-dd") : "اختر التاريخ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background z-[9999]" align="start" sideOffset={4}>
                      <Calendar
                        mode="single"
                        selected={notificationEndDate}
                        onSelect={setNotificationEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* User Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  اختر المستخدمين
                </Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAll"
                    checked={selectAllUsers}
                    onCheckedChange={(checked) => handleToggleAllUsers(checked as boolean)}
                  />
                  <label htmlFor="selectAll" className="text-sm cursor-pointer">
                    تحديد الكل ({shiftRelatedUsers.length})
                  </label>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                المستخدمون الذين لديهم مناصب مرتبطة بالورديات
              </p>
              
              <ScrollArea className="h-[250px] border rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  {shiftRelatedUsers.map(user => (
                    <div
                      key={user.user_id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedUserIds.includes(user.user_id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => handleToggleUser(user.user_id)}
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.user_id)}
                        onCheckedChange={() => handleToggleUser(user.user_id)}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.user_name}</span>
                        {user.job_position_name && (
                          <span className="text-xs text-muted-foreground">
                            {user.job_position_name}
                          </span>
                        )}
                      </div>
                      {selectedUserIds.includes(user.user_id) && (
                        <Check className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
                
                {shiftRelatedUsers.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    لا يوجد مستخدمون مرتبطون بمناصب الورديات
                  </div>
                )}
              </ScrollArea>
              
              {selectedUserIds.length > 0 && (
                <p className="text-sm text-primary">
                  تم تحديد {selectedUserIds.length} مستخدم
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSendNotificationDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSendNotifications}
              disabled={sendingNotifications || selectedUserIds.length === 0}
            >
              {sendingNotifications ? (
                <>جاري الإرسال...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  إرسال الإشعارات
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftCalendar;
