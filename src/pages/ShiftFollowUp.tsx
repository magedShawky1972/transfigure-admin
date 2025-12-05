import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar, RefreshCw, Edit2, Check, X, Eye, RotateCcw, XCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ShiftClosingDetailsDialog from "@/components/ShiftClosingDetailsDialog";

interface ShiftAssignment {
  id: string;
  assignment_date: string;
  shift_id: string;
  user_id: string;
  notes: string | null;
  shifts: {
    shift_name: string;
    shift_start_time: string;
    shift_end_time: string;
    color: string;
    shift_order: number;
  };
  profiles: {
    user_name: string;
    job_position_id: string | null;
  };
  shift_sessions: Array<{
    id: string;
    status: string;
    opened_at: string;
    closed_at: string | null;
  }>;
  shift_job_positions?: string[];
}

interface User {
  id: string;
  user_id: string;
  user_name: string;
  job_position_id: string | null;
}

// Helper function to get KSA date string (YYYY-MM-DD) since all shifts use KSA timezone
const getKSADateString = (): string => {
  const now = new Date();
  // Add 3 hours offset for KSA (UTC+3)
  const ksaTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return ksaTime.toISOString().split('T')[0];
};

export default function ShiftFollowUp() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string>(getKSADateString());
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ShiftAssignment | null>(null);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [assignmentToReopen, setAssignmentToReopen] = useState<ShiftAssignment | null>(null);
  const [reopening, setReopening] = useState(false);
  const [hardCloseDialogOpen, setHardCloseDialogOpen] = useState(false);
  const [assignmentToHardClose, setAssignmentToHardClose] = useState<ShiftAssignment | null>(null);
  const [hardClosing, setHardClosing] = useState(false);
  const [openShiftDialogOpen, setOpenShiftDialogOpen] = useState(false);
  const [assignmentToOpen, setAssignmentToOpen] = useState<ShiftAssignment | null>(null);
  const [openingShift, setOpeningShift] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [selectedDate]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, user_name, job_position_id")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(t("Failed to load users"));
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      // Fetch shift assignments with shift details and sessions
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("shift_assignments")
        .select(`
          id,
          assignment_date,
          shift_id,
          user_id,
          notes,
          shifts (
            shift_name,
            shift_start_time,
            shift_end_time,
            color,
            shift_order
          ),
          shift_sessions (
            id,
            status,
            opened_at,
            closed_at
          )
        `)
        .eq("assignment_date", selectedDate);

      if (assignmentError) throw assignmentError;

      // Fetch user profiles separately
      const userIds = assignmentData?.map((a: any) => a.user_id) || [];
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, user_name, job_position_id")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Fetch shift job positions for all shifts
      const shiftIds = assignmentData?.map((a: any) => a.shift_id) || [];
      const { data: shiftJobData, error: shiftJobError } = await supabase
        .from("shift_job_positions")
        .select("shift_id, job_position_id")
        .in("shift_id", shiftIds);

      if (shiftJobError) throw shiftJobError;

      // Map profiles to assignments
      const profileMap = new Map(profileData?.map((p: any) => [p.user_id, p]));
      
      // Map shift job positions by shift_id
      const shiftJobMap = new Map<string, string[]>();
      shiftJobData?.forEach((sj: any) => {
        if (!shiftJobMap.has(sj.shift_id)) {
          shiftJobMap.set(sj.shift_id, []);
        }
        shiftJobMap.get(sj.shift_id)?.push(sj.job_position_id);
      });
      
      const enrichedData = assignmentData?.map((assignment: any) => ({
        ...assignment,
        profiles: profileMap.get(assignment.user_id) || {
          user_name: "Unknown",
          job_position_id: null,
        },
        shift_job_positions: shiftJobMap.get(assignment.shift_id) || [],
      }));

      // Sort by shift_order
      const sortedData = enrichedData?.sort((a: any, b: any) => 
        (a.shifts?.shift_order || 0) - (b.shifts?.shift_order || 0)
      );

      setAssignments(sortedData || []);
    } catch (error: any) {
      console.error("Error fetching assignments:", error);
      toast.error(t("Failed to load shift assignments"));
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (assignmentId: string, currentUserId: string) => {
    setEditingId(assignmentId);
    setSelectedUserId(currentUserId);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedUserId("");
  };

  const handleSaveEdit = async (assignmentId: string) => {
    if (!selectedUserId) {
      toast.error(t("Please select a user"));
      return;
    }

    try {
      // Get assignment details before update
      const { data: assignmentData } = await supabase
        .from("shift_assignments")
        .select("shift_id, assignment_date, shifts(shift_name)")
        .eq("id", assignmentId)
        .single();

      const { error } = await supabase
        .from("shift_assignments")
        .update({ user_id: selectedUserId })
        .eq("id", assignmentId);

      if (error) throw error;

      // Send notification email to the new assigned user
      try {
        const { data: newUserProfile } = await supabase
          .from("profiles")
          .select("user_name, email")
          .eq("user_id", selectedUserId)
          .single();

        if (newUserProfile && assignmentData) {
          // Send shift notification to the new user
          await supabase.functions.invoke("send-shift-notifications", {
            body: {
              startDate: assignmentData.assignment_date,
              endDate: assignmentData.assignment_date,
              userIds: [selectedUserId],
            },
          });
        }
      } catch (notifError) {
        console.error("Error sending notification:", notifError);
        // Don't fail the whole operation if notification fails
      }

      toast.success(t("Shift assignment updated successfully"));
      setEditingId(null);
      setSelectedUserId("");
      fetchAssignments();
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      toast.error(t("Failed to update shift assignment"));
    }
  };

  const handleReopenShift = async () => {
    if (!assignmentToReopen) return;
    
    // Filter sessions to only those opened on the selected date
    const selectedDateStart = new Date(selectedDate + 'T00:00:00');
    const selectedDateEnd = new Date(selectedDate + 'T23:59:59');
    
    const sessionsForDate = (assignmentToReopen.shift_sessions || []).filter(session => {
      if (!session.opened_at) return false;
      const openedDate = new Date(session.opened_at);
      return openedDate >= selectedDateStart && openedDate <= selectedDateEnd;
    });
    
    // Get the latest closed session for this date
    const sortedSessions = [...sessionsForDate].sort(
      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
    );
    const closedSession = sortedSessions.find(s => s.status === "closed");
    if (!closedSession) return;

    setReopening(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get admin profile
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // 1. Move ludo_transactions back to temp_ludo_transactions
      const { data: ludoTransactions } = await supabase
        .from("ludo_transactions")
        .select("*")
        .eq("shift_session_id", closedSession.id);

      if (ludoTransactions && ludoTransactions.length > 0) {
        // Insert into temp table (without order_number)
        const tempData = ludoTransactions.map(tx => ({
          shift_session_id: tx.shift_session_id,
          product_sku: tx.product_sku,
          amount: tx.amount,
          player_id: tx.player_id,
          transaction_date: tx.transaction_date,
          user_id: tx.user_id,
          image_path: tx.image_path,
        }));

        const { error: tempInsertError } = await supabase
          .from("temp_ludo_transactions")
          .insert(tempData);

        if (tempInsertError) throw tempInsertError;

        // Delete from ludo_transactions
        const { error: ludoDeleteError } = await supabase
          .from("ludo_transactions")
          .delete()
          .eq("shift_session_id", closedSession.id);

        if (ludoDeleteError) throw ludoDeleteError;
      }

      // 2. Delete shift_brand_balances for this session
      const { error: brandBalanceError } = await supabase
        .from("shift_brand_balances")
        .delete()
        .eq("shift_session_id", closedSession.id);

      if (brandBalanceError) throw brandBalanceError;

      // 3. Update shift_session status to open and clear closed_at
      const { error: sessionError } = await supabase
        .from("shift_sessions")
        .update({ 
          status: "open", 
          closed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", closedSession.id);

      if (sessionError) throw sessionError;

      // 4. Log the reopen action
      const { error: logError } = await supabase
        .from("shift_reopen_logs")
        .insert({
          shift_session_id: closedSession.id,
          shift_assignment_id: assignmentToReopen.id,
          admin_user_id: user.id,
          admin_user_name: adminProfile?.user_name || "Unknown",
          shift_name: assignmentToReopen.shifts.shift_name,
          shift_date: assignmentToReopen.assignment_date,
        });

      if (logError) throw logError;

      toast.success(t("Shift reopened successfully"));
      fetchAssignments();
    } catch (error: any) {
      console.error("Error reopening shift:", error);
      toast.error(t("Failed to reopen shift"));
    } finally {
      setReopening(false);
      setReopenDialogOpen(false);
      setAssignmentToReopen(null);
    }
  };

  const handleHardCloseShift = async () => {
    if (!assignmentToHardClose) return;
    
    // Filter sessions to only those opened on the selected date
    const selectedDateStart = new Date(selectedDate + 'T00:00:00');
    const selectedDateEnd = new Date(selectedDate + 'T23:59:59');
    
    const sessionsForDate = (assignmentToHardClose.shift_sessions || []).filter(session => {
      if (!session.opened_at) return false;
      const openedDate = new Date(session.opened_at);
      return openedDate >= selectedDateStart && openedDate <= selectedDateEnd;
    });
    
    // Get the latest open session for this date
    const sortedSessions = [...sessionsForDate].sort(
      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
    );
    const openSession = sortedSessions.find(s => s.status === "open");
    if (!openSession) return;

    setHardClosing(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get admin profile
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // Update shift_session status to closed
      const { error: sessionError } = await supabase
        .from("shift_sessions")
        .update({ 
          status: "closed", 
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", openSession.id);

      if (sessionError) throw sessionError;

      // Log the hard close action
      const { error: logError } = await supabase
        .from("shift_hard_close_logs")
        .insert({
          shift_session_id: openSession.id,
          shift_assignment_id: assignmentToHardClose.id,
          admin_user_id: user.id,
          admin_user_name: adminProfile?.user_name || "Unknown",
          shift_name: assignmentToHardClose.shifts.shift_name,
          shift_date: assignmentToHardClose.assignment_date,
        });

      if (logError) throw logError;

      toast.success(t("Shift closed successfully"));
      fetchAssignments();
    } catch (error: any) {
      console.error("Error hard closing shift:", error);
      toast.error(t("Failed to close shift"));
    } finally {
      setHardClosing(false);
      setHardCloseDialogOpen(false);
      setAssignmentToHardClose(null);
    }
  };

  const handleAdminOpenShift = async () => {
    if (!assignmentToOpen) return;
    
    setOpeningShift(true);
    try {
      // Get current admin user
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) throw new Error("Admin not authenticated");

      const shiftData = assignmentToOpen.shifts;
      
      // Validation 1: Check if shift time has ended (KSA timezone)
      if (shiftData?.shift_end_time) {
        const now = new Date();
        const ksaOffset = 3 * 60; // KSA is UTC+3
        const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
        const ksaMinutes = utcMinutes + ksaOffset;
        const currentTimeInMinutes = ((ksaMinutes % 1440) + 1440) % 1440;
        
        const [endHours, endMinutes] = shiftData.shift_end_time.split(':').map(Number);
        const endTimeInMinutes = endHours * 60 + endMinutes;
        
        const [startHours, startMinutes] = (shiftData.shift_start_time || "00:00:00").split(':').map(Number);
        const startTimeInMinutes = startHours * 60 + startMinutes;
        
        const isOvernightShift = endTimeInMinutes < startTimeInMinutes;
        
        let isShiftEnded = false;
        
        if (isOvernightShift) {
          if (currentTimeInMinutes > endTimeInMinutes && currentTimeInMinutes < 300) {
            isShiftEnded = true;
          }
        } else {
          if (currentTimeInMinutes > endTimeInMinutes) {
            isShiftEnded = true;
          }
        }
        
        if (isShiftEnded) {
          toast.error(t("shiftTimeEnded") || "انتهى وقت الوردية - لا يمكن فتح الوردية بعد انتهاء وقتها");
          setOpeningShift(false);
          setOpenShiftDialogOpen(false);
          setAssignmentToOpen(null);
          return;
        }
      }

      // Validation 2: Check for existing open session for this assignment
      const { data: existingOpenSession } = await supabase
        .from("shift_sessions")
        .select("id")
        .eq("shift_assignment_id", assignmentToOpen.id)
        .eq("status", "open")
        .maybeSingle();

      if (existingOpenSession) {
        toast.error(t("shiftAlreadyOpen") || "الوردية مفتوحة بالفعل");
        setOpeningShift(false);
        setOpenShiftDialogOpen(false);
        setAssignmentToOpen(null);
        fetchAssignments();
        return;
      }

      // Create new shift session for the assigned user
      const { data: newSession, error } = await supabase
        .from("shift_sessions")
        .insert({
          user_id: assignmentToOpen.user_id,
          shift_assignment_id: assignmentToOpen.id,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      // Send notifications to shift admins
      try {
        // Get shift_id from assignment
        const { data: assignmentData } = await supabase
          .from("shift_assignments")
          .select("shift_id")
          .eq("id", assignmentToOpen.id)
          .single();

        if (assignmentData) {
          await supabase.functions.invoke("send-shift-open-notification", {
            body: {
              shiftId: assignmentData.shift_id,
              userId: assignmentToOpen.user_id,
              shiftSessionId: newSession.id,
            },
          });
        }
      } catch (notifError) {
        console.error("Error sending notifications:", notifError);
      }

      toast.success(t("Shift opened successfully") || "تم فتح الوردية بنجاح");
      fetchAssignments();
    } catch (error: any) {
      console.error("Error opening shift:", error);
      toast.error(t("Failed to open shift") || "فشل في فتح الوردية");
    } finally {
      setOpeningShift(false);
      setOpenShiftDialogOpen(false);
      setAssignmentToOpen(null);
    }
  };

  const getStatusBadge = (session: ShiftAssignment["shift_sessions"][0] | null) => {
    if (!session) {
      return <Badge variant="secondary">{t("Not Started")}</Badge>;
    }
    
    if (session.status === "open") {
      return <Badge className="bg-green-500">{t("Open")}</Badge>;
    } else if (session.status === "closed") {
      return <Badge className="bg-blue-500">{t("Closed")}</Badge>;
    }

    return <Badge variant="secondary">{t("Unknown")}</Badge>;
  };

  const formatDateInArabic = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "EEEE, dd MMMM yyyy", { locale: ar });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            {t("Shift Follow-Up")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="date">{t("Date")}</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateInArabic(selectedDate)}
              </p>
            </div>
            <Button onClick={fetchAssignments} variant="outline">
              <RefreshCw className="h-4 w-4 ml-2" />
              {t("Refresh")}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("Loading...")}</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {t("No shift assignments found for this date")}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">{t("Shift Name")}</TableHead>
                    <TableHead className="text-right">{t("Start Time")}</TableHead>
                    <TableHead className="text-right">{t("End Time")}</TableHead>
                    <TableHead className="text-right">{t("Assigned Person")}</TableHead>
                    <TableHead className="text-right">{t("Status")}</TableHead>
                    <TableHead className="text-right">{t("Opened At")}</TableHead>
                    <TableHead className="text-right">{t("Closed At")}</TableHead>
                    <TableHead className="text-right">{t("Notes")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => {
                    // Filter sessions to only those opened on the selected date (in local timezone)
                    const selectedDateStart = new Date(selectedDate + 'T00:00:00');
                    const selectedDateEnd = new Date(selectedDate + 'T23:59:59');
                    
                    const sessionsForDate = (assignment.shift_sessions || []).filter(session => {
                      if (!session.opened_at) return false;
                      const openedDate = new Date(session.opened_at);
                      return openedDate >= selectedDateStart && openedDate <= selectedDateEnd;
                    });
                    
                    // Get the latest session for this date (or show the most recent if none match)
                    const sortedSessions = [...sessionsForDate].sort(
                      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
                    );
                    const latestSession = sortedSessions[0] || null;
                    
                    const formatDateTime = (dateStr: string | null) => {
                      if (!dateStr) return "-";
                      const date = new Date(dateStr);
                      // Convert to KSA time (UTC+3)
                      const ksaOffset = 3 * 60; // KSA is UTC+3 in minutes
                      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
                      const ksaTime = new Date(utcTime + (ksaOffset * 60000));
                      
                      const day = ksaTime.getDate().toString().padStart(2, '0');
                      const month = (ksaTime.getMonth() + 1).toString().padStart(2, '0');
                      const hours = ksaTime.getHours();
                      const minutes = ksaTime.getMinutes().toString().padStart(2, '0');
                      const hour12 = hours % 12 || 12;
                      const ampm = hours >= 12 ? 'PM' : 'AM';
                      return `${day}/${month} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                    };
                    
                    return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: assignment.shifts.color }}
                          />
                          {assignment.shifts.shift_name}
                        </div>
                      </TableCell>
                      <TableCell>{assignment.shifts.shift_start_time}</TableCell>
                      <TableCell>{assignment.shifts.shift_end_time}</TableCell>
                      <TableCell>
                        {editingId === assignment.id ? (
                          <Select
                            value={selectedUserId}
                            onValueChange={setSelectedUserId}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t("Select User")} />
                            </SelectTrigger>
                            <SelectContent>
                              {users
                                .filter((user) => 
                                  assignment.shift_job_positions && 
                                  assignment.shift_job_positions.length > 0 
                                    ? assignment.shift_job_positions.includes(user.job_position_id || '')
                                    : true
                                )
                                .map((user) => (
                                  <SelectItem key={user.id} value={user.user_id}>
                                    {user.user_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          assignment.profiles.user_name
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(latestSession)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(latestSession?.opened_at || null)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(latestSession?.closed_at || null)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {assignment.notes || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {editingId === assignment.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(assignment.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            (() => {
                              // Use the already-filtered latestSession for this date
                              const currentStatus = latestSession?.status || null;
                              
                              return (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleEditClick(assignment.id, assignment.user_id)
                                    }
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  {!currentStatus && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 border-green-300 hover:bg-green-50"
                                      onClick={() => {
                                        setAssignmentToOpen(assignment);
                                        setOpenShiftDialogOpen(true);
                                      }}
                                    >
                                      <Play className="h-4 w-4 ml-1" />
                                      {t("Open Shift")}
                                    </Button>
                                  )}
                                  {currentStatus === "open" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => {
                                        setAssignmentToHardClose(assignment);
                                        setHardCloseDialogOpen(true);
                                      }}
                                    >
                                      <XCircle className="h-4 w-4 ml-1" />
                                      {t("Hard Close")}
                                    </Button>
                                  )}
                                  {currentStatus === "closed" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedAssignment(assignment);
                                          setDetailsDialogOpen(true);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 ml-1" />
                                        {t("Details")}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                        onClick={() => {
                                          setAssignmentToReopen(assignment);
                                          setReopenDialogOpen(true);
                                        }}
                                      >
                                        <RotateCcw className="h-4 w-4 ml-1" />
                                        {t("Reopen")}
                                      </Button>
                                    </>
                                  )}
                                </>
                              );
                            })()
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closing Details Dialog */}
      <ShiftClosingDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        shiftSessionId={(() => {
          if (!selectedAssignment?.shift_sessions) return null;
          
          // Filter sessions to only those opened on the selected date
          const selectedDateStart = new Date(selectedDate + 'T00:00:00');
          const selectedDateEnd = new Date(selectedDate + 'T23:59:59');
          
          const sessionsForDate = selectedAssignment.shift_sessions.filter(session => {
            if (!session.opened_at) return false;
            const openedDate = new Date(session.opened_at);
            return openedDate >= selectedDateStart && openedDate <= selectedDateEnd;
          });
          
          const sorted = [...sessionsForDate].sort(
            (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
          );
          return sorted.find(s => s.status === "closed")?.id || null;
        })()}
        userName={selectedAssignment?.profiles.user_name || ""}
        shiftName={selectedAssignment?.shifts.shift_name || ""}
      />

      {/* Reopen Confirmation Dialog */}
      <AlertDialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Reopen Shift")}</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {t("Are you sure you want to reopen this shift? This will:")}
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t("Move Ludo transactions back to temporary state")}</li>
                <li>{t("Delete all brand closing balances")}</li>
                <li>{t("Change shift status from closed to open")}</li>
              </ul>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p><strong>{t("Shift")}:</strong> {assignmentToReopen?.shifts.shift_name}</p>
                <p><strong>{t("Date")}:</strong> {assignmentToReopen?.assignment_date}</p>
                <p><strong>{t("Employee")}:</strong> {assignmentToReopen?.profiles.user_name}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={reopening}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReopenShift}
              disabled={reopening}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {reopening ? t("Reopening...") : t("Confirm Reopen")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard Close Confirmation Dialog */}
      <AlertDialog open={hardCloseDialogOpen} onOpenChange={setHardCloseDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Hard Close Shift")}</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {t("Are you sure you want to force close this shift? This will close the shift without entering closing balances.")}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p><strong>{t("Shift")}:</strong> {assignmentToHardClose?.shifts.shift_name}</p>
                <p><strong>{t("Date")}:</strong> {assignmentToHardClose?.assignment_date}</p>
                <p><strong>{t("Employee")}:</strong> {assignmentToHardClose?.profiles.user_name}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={hardClosing}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleHardCloseShift}
              disabled={hardClosing}
              className="bg-red-600 hover:bg-red-700"
            >
              {hardClosing ? t("Closing...") : t("Confirm Close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Open Shift Confirmation Dialog */}
      <AlertDialog open={openShiftDialogOpen} onOpenChange={setOpenShiftDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Open Shift")}</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {t("Are you sure you want to open this shift for the assigned user?")}
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p><strong>{t("Shift")}:</strong> {assignmentToOpen?.shifts.shift_name}</p>
                <p><strong>{t("Date")}:</strong> {assignmentToOpen?.assignment_date}</p>
                <p><strong>{t("Employee")}:</strong> {assignmentToOpen?.profiles.user_name}</p>
                <p><strong>{t("Start Time")}:</strong> {assignmentToOpen?.shifts.shift_start_time}</p>
                <p><strong>{t("End Time")}:</strong> {assignmentToOpen?.shifts.shift_end_time}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel disabled={openingShift}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAdminOpenShift}
              disabled={openingShift}
              className="bg-green-600 hover:bg-green-700"
            >
              {openingShift ? t("Opening...") : t("Confirm Open")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
