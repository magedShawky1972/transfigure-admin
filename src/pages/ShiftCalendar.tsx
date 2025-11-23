import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, List, Grid3x3, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, addWeeks, addDays, isSameDay, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  color: string;
  job_positions?: string[];
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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    fetchShifts();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [currentDate, viewType]);

  const fetchShifts = async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select(`
          *,
          shift_job_positions (
            job_position_id,
            job_positions (position_name)
          )
        `)
        .eq("is_active", true);

      if (error) throw error;

      const shiftsWithPositions = data?.map(shift => ({
        ...shift,
        job_positions: shift.shift_job_positions?.map((sjp: any) => sjp.job_position_id) || []
      })) || [];

      setShifts(shiftsWithPositions);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error("Failed to fetch shifts");
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
    setSelectedDate(date);
    setShiftDialogOpen(true);
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
      const { error } = await supabase
        .from("shift_assignments")
        .delete()
        .eq("id", selectedAssignment.id);

      if (error) throw error;

      toast.success("Assignment deleted successfully");
      setEditDialogOpen(false);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
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

      toast.success("Shift reassigned successfully");
      setUserDialogOpen(false);
      setSelectedShift(null);
      setSelectedDate(null);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error reassigning shift:", error);
      toast.error("Failed to reassign shift");
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

      toast.success("Shift assigned successfully");
      setUserDialogOpen(false);
      setSelectedShift(null);
      setSelectedDate(null);
      fetchAssignments();
    } catch (error) {
      console.error("Error assigning shift:", error);
      toast.error("Failed to assign shift");
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentsForDate = (date: Date) => {
    return assignments.filter(a => isSameDay(new Date(a.assignment_date), date));
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

    return (
      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center font-medium text-sm text-muted-foreground py-2">
            {day}
          </div>
        ))}
        {days.map((day, idx) => {
          const dayAssignments = getAssignmentsForDate(day);
          const isCurrentMonth = viewType === "month" ? isSameMonth(day, currentDate) : true;
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={cn(
                "min-h-32 border rounded-lg p-2 cursor-pointer hover:bg-accent/50 transition-colors",
                !isCurrentMonth && "opacity-40 bg-muted/20",
                isToday && "border-primary border-2"
              )}
              onClick={(e) => handleAddShift(day, e)}
            >
              <div className={cn(
                "text-sm font-medium mb-2",
                isToday && "text-primary"
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayAssignments.map((assignment, i) => (
                  <div
                    key={i}
                    className="assignment-item text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity"
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Shift Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewType === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("day")}
              >
                <List className="h-4 w-4 mr-1" />
                Day
              </Button>
              <Button
                variant={viewType === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("week")}
              >
                <Grid3x3 className="h-4 w-4 mr-1" />
                Week
              </Button>
              <Button
                variant={viewType === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("month")}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Month
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold">
              {viewType === "month" && format(currentDate, "MMMM yyyy")}
              {viewType === "week" && `${format(getStartDate(), "MMM d")} - ${format(getEndDate(), "MMM d, yyyy")}`}
              {viewType === "day" && format(currentDate, "MMMM d, yyyy")}
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
            <DialogTitle>Select Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {shifts.map(shift => (
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
            <DialogTitle>{selectedAssignment ? "Reassign Employee" : "Select Employee"}</DialogTitle>
            {selectedShift && (
              <p className="text-sm text-muted-foreground">
                {selectedAssignment ? "Reassigning" : "Assigning"}: {selectedShift.shift_name} ({selectedShift.shift_start_time} - {selectedShift.shift_end_time})
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
                No employees found for this shift's job positions
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shift Assignment</DialogTitle>
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
                  Assigned to: <span className="font-medium">{selectedAssignment.user.user_name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Date: {format(new Date(selectedAssignment.assignment_date), "MMMM d, yyyy")}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReassign}
                  disabled={loading}
                >
                  Reassign
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDeleteAssignment}
                  disabled={loading}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftCalendar;
