import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

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

      // Fetch assignments count
      const { count: assignmentsCount } = await supabase
        .from("shift_assignments")
        .select("*", { count: "exact", head: true });

      // Fetch session statistics
      const { data: sessionsData } = await supabase
        .from("shift_sessions")
        .select("status");

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
        pendingSessions,
      });
      setRecentAssignments(enrichedAssignments);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.totalShifts")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShifts}</div>
            <p className="text-xs text-muted-foreground">
              {t("shiftDashboard.activeShifts")}: {stats.activeShifts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.totalAssignments")}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.openSessions")}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.closedSessions")}
            </CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closedSessions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("shiftDashboard.pendingSessions")}
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
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
    </div>
  );
}
