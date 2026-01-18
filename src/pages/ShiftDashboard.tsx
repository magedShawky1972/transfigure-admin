import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShiftStats {
  totalShifts: number;
  activeShifts: number;
  totalAssignments: number;
  openSessions: number;
  closedSessions: number;
  pendingSessions: number;
}

interface RecentAssignment {
  id: string;
  shift_name: string;
  user_name: string;
  assignment_date: string;
  status: string;
}

interface ShiftDetail {
  id: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  is_active: boolean;
}

interface AssignmentDetail {
  id: string;
  shift_name: string;
  user_name: string;
  assignment_date: string;
}

interface SessionDetail {
  id: string;
  shift_name: string;
  user_name: string;
  opened_at: string | null;
  closed_at: string | null;
  status: string;
}

type DrillDownType = "shifts" | "assignments" | "open" | "closed" | "pending" | null;

export default function ShiftDashboard() {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<ShiftStats>({
    totalShifts: 0,
    activeShifts: 0,
    totalAssignments: 0,
    openSessions: 0,
    closedSessions: 0,
    pendingSessions: 0,
  });
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Drill-down state
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [shiftDetails, setShiftDetails] = useState<ShiftDetail[]>([]);
  const [assignmentDetails, setAssignmentDetails] = useState<AssignmentDetail[]>([]);
  const [sessionDetails, setSessionDetails] = useState<SessionDetail[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch total and active shifts
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("id, is_active");

      const totalShifts = shiftsData?.length || 0;
      const activeShifts = shiftsData?.filter(s => s.is_active).length || 0;

      // Get today's date for filtering
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch assignments count (only current and future)
      const { count: assignmentsCount } = await supabase
        .from("shift_assignments")
        .select("*", { count: "exact", head: true })
        .gte("assignment_date", today);

      // Fetch session statistics (only for current and future assignments)
      const { data: sessionsData } = await supabase
        .from("shift_sessions")
        .select("status, shift_assignments!inner(assignment_date)")
        .gte("shift_assignments.assignment_date", today);

      const openSessions = sessionsData?.filter(s => s.status === "open").length || 0;
      const closedSessions = sessionsData?.filter(s => s.status === "closed").length || 0;
      const pendingSessions = (assignmentsCount || 0) - (openSessions + closedSessions);

      // Fetch recent assignments with profiles
      const { data: assignmentsData } = await supabase
        .from("shift_assignments")
        .select(`
          id,
          assignment_date,
          user_id,
          shifts(shift_name),
          shift_sessions(status)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch user profiles for the assignments
      const userIds = assignmentsData?.map(a => a.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]));

      const enrichedAssignments = assignmentsData?.map(a => ({
        id: a.id,
        shift_name: (a.shifts as any)?.shift_name || "",
        user_name: profilesMap.get(a.user_id) || "",
        assignment_date: a.assignment_date,
        status: (a.shift_sessions as any)?.[0]?.status || "pending",
      })) || [];

      setStats({
        totalShifts,
        activeShifts,
        totalAssignments: assignmentsCount || 0,
        openSessions,
        closedSessions,
        pendingSessions: pendingSessions > 0 ? pendingSessions : 0,
      });
      setRecentAssignments(enrichedAssignments);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrillDown = async (type: DrillDownType) => {
    if (!type) return;
    
    setDrillDownType(type);
    setDrillDownOpen(true);
    setDrillDownLoading(true);

    try {
      if (type === "shifts") {
        const { data } = await supabase
          .from("shifts")
          .select("id, shift_name, shift_start_time, shift_end_time, is_active")
          .order("shift_name");
        setShiftDetails(data || []);
      } else if (type === "assignments") {
        const { data: assignmentsData } = await supabase
          .from("shift_assignments")
          .select(`
            id,
            assignment_date,
            user_id,
            shifts(shift_name)
          `)
          .order("assignment_date", { ascending: false })
          .limit(50);

        const userIds = assignmentsData?.map(a => a.user_id) || [];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]));

        setAssignmentDetails(assignmentsData?.map(a => ({
          id: a.id,
          shift_name: (a.shifts as any)?.shift_name || "",
          user_name: profilesMap.get(a.user_id) || "",
          assignment_date: a.assignment_date,
        })) || []);
      } else if (type === "open" || type === "closed") {
        const { data: sessionsData } = await supabase
          .from("shift_sessions")
          .select(`
            id,
            opened_at,
            closed_at,
            status,
            shift_assignments(
              user_id,
              shifts(shift_name)
            )
          `)
          .eq("status", type)
          .order("opened_at", { ascending: false })
          .limit(50);

        const userIds = sessionsData?.map(s => (s.shift_assignments as any)?.user_id).filter(Boolean) || [];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]));

        setSessionDetails(sessionsData?.map(s => ({
          id: s.id,
          shift_name: (s.shift_assignments as any)?.shifts?.shift_name || "",
          user_name: profilesMap.get((s.shift_assignments as any)?.user_id) || "",
          opened_at: s.opened_at,
          closed_at: s.closed_at,
          status: s.status,
        })) || []);
      } else if (type === "pending") {
        // Pending = assignments without sessions (only current and future)
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: assignmentsData } = await supabase
          .from("shift_assignments")
          .select(`
            id,
            assignment_date,
            user_id,
            shifts(shift_name),
            shift_sessions(id)
          `)
          .gte("assignment_date", today)
          .order("assignment_date", { ascending: true })
          .limit(100);

        const pendingAssignments = assignmentsData?.filter(a => {
          const sessions = a.shift_sessions;
          if (!sessions) return true;
          if (Array.isArray(sessions)) return sessions.length === 0;
          return false; // single object means session exists
        }) || [];

        const userIds = pendingAssignments.map(a => a.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, user_name")
          .in("user_id", userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]));

        setAssignmentDetails(pendingAssignments.map(a => ({
          id: a.id,
          shift_name: (a.shifts as any)?.shift_name || "",
          user_name: profilesMap.get(a.user_id) || "",
          assignment_date: a.assignment_date,
        })));
      }
    } catch (error) {
      console.error("Error fetching drill-down data:", error);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const getDrillDownTitle = () => {
    switch (drillDownType) {
      case "shifts": return language === "ar" ? "جميع الورديات" : "All Shifts";
      case "assignments": return language === "ar" ? "جميع التعيينات" : "All Assignments";
      case "open": return language === "ar" ? "الجلسات المفتوحة" : "Open Sessions";
      case "closed": return language === "ar" ? "الجلسات المغلقة" : "Closed Sessions";
      case "pending": return language === "ar" ? "التعيينات المعلقة" : "Pending Assignments";
      default: return "";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-500">{t("shiftFollowUp.open")}</Badge>;
      case "closed":
        return <Badge className="bg-gray-500">{t("shiftFollowUp.closed")}</Badge>;
      default:
        return <Badge variant="outline">{t("shiftFollowUp.notStarted")}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">{t("shiftDashboard.loading")}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <h1 className="text-3xl font-bold mb-6">{t("shiftDashboard.title")}</h1>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleDrillDown("shifts")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.totalShifts")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShifts}</div>
            <p className="text-xs text-muted-foreground">
              {t("shiftDashboard.activeShifts")}: {stats.activeShifts}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleDrillDown("assignments")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.totalAssignments")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleDrillDown("open")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.openSessions")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openSessions}</div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleDrillDown("closed")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.closedSessions")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closedSessions}</div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleDrillDown("pending")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.pendingSessions")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingSessions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>{t("shiftDashboard.recentAssignments")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentAssignments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t("shiftDashboard.noAssignments")}
              </p>
            ) : (
              recentAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium">{assignment.shift_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {assignment.user_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.assignment_date), "yyyy-MM-dd")}
                    </p>
                  </div>
                  <div>{getStatusBadge(assignment.status)}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Drill-Down Dialog */}
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{getDrillDownTitle()}</DialogTitle>
          </DialogHeader>
          
          {drillDownLoading ? (
            <div className="text-center py-8">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
          ) : (
            <ScrollArea className="h-[60vh]">
              {drillDownType === "shifts" && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "اسم الوردية" : "Shift Name"}</TableHead>
                      <TableHead>{language === "ar" ? "وقت البداية" : "Start Time"}</TableHead>
                      <TableHead>{language === "ar" ? "وقت النهاية" : "End Time"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftDetails.map(shift => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">{shift.shift_name}</TableCell>
                        <TableCell>{shift.shift_start_time}</TableCell>
                        <TableCell>{shift.shift_end_time}</TableCell>
                        <TableCell>
                          <Badge variant={shift.is_active ? "default" : "secondary"}>
                            {shift.is_active 
                              ? (language === "ar" ? "نشط" : "Active")
                              : (language === "ar" ? "غير نشط" : "Inactive")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {(drillDownType === "assignments" || drillDownType === "pending") && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "اسم الوردية" : "Shift Name"}</TableHead>
                      <TableHead>{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                      <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignmentDetails.map(assignment => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.shift_name}</TableCell>
                        <TableCell>{assignment.user_name}</TableCell>
                        <TableCell>{format(new Date(assignment.assignment_date), "yyyy-MM-dd")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {(drillDownType === "open" || drillDownType === "closed") && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "اسم الوردية" : "Shift Name"}</TableHead>
                      <TableHead>{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                      <TableHead>{language === "ar" ? "وقت الفتح" : "Open Time"}</TableHead>
                      <TableHead>{language === "ar" ? "وقت الإغلاق" : "Close Time"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionDetails.map(session => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.shift_name}</TableCell>
                        <TableCell>{session.user_name}</TableCell>
                        <TableCell>
                          {session.opened_at 
                            ? format(new Date(session.opened_at), "yyyy-MM-dd HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {session.closed_at 
                            ? format(new Date(session.closed_at), "yyyy-MM-dd HH:mm")
                            : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
