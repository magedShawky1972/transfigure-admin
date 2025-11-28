import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar, RefreshCw, Edit2, Check, X, Eye } from "lucide-react";
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

export default function ShiftFollowUp() {
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ShiftAssignment | null>(null);

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
            color
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

      setAssignments(enrichedData || []);
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
      const { error } = await supabase
        .from("shift_assignments")
        .update({ user_id: selectedUserId })
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success(t("Shift assignment updated successfully"));
      setEditingId(null);
      setSelectedUserId("");
      fetchAssignments();
    } catch (error: any) {
      console.error("Error updating assignment:", error);
      toast.error(t("Failed to update shift assignment"));
    }
  };

  const getStatusBadge = (sessions: ShiftAssignment["shift_sessions"]) => {
    if (!sessions || sessions.length === 0) {
      return <Badge variant="secondary">{t("Not Started")}</Badge>;
    }

    const latestSession = sessions[sessions.length - 1];
    if (latestSession.status === "open") {
      return <Badge className="bg-green-500">{t("Open")}</Badge>;
    } else if (latestSession.status === "closed") {
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
                    <TableHead className="text-right">{t("Notes")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
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
                        {getStatusBadge(assignment.shift_sessions)}
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
                              {assignment.shift_sessions?.some(s => s.status === "closed") && (
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
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
        shiftSessionId={selectedAssignment?.shift_sessions?.find(s => s.status === "closed")?.id || null}
        userName={selectedAssignment?.profiles.user_name || ""}
        shiftName={selectedAssignment?.shifts.shift_name || ""}
      />
    </div>
  );
}
