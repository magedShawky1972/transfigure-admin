import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown, Calendar as CalendarIcon, Printer } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";

interface BrandBalance {
  brand_id: string;
  brand_name: string;
  closing_balance: number;
}

interface ShiftSession {
  id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  user_name: string;
  shift_name: string;
  shift_color: string;
  assignment_date: string;
  zone_name: string | null;
  brand_balances: BrandBalance[];
}

const ShiftReport = () => {
  const { language } = useLanguage();
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      // Fetch shift sessions with assignments
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("shift_sessions")
        .select(`
          id,
          status,
          opened_at,
          closed_at,
          user_id,
          shift_assignment_id,
          shift_assignments (
            assignment_date,
            shift_id,
            shifts (
              shift_name,
              color,
              shift_type_id,
              shift_types (
                zone_name
              )
            )
          )
        `)
        .gte("opened_at", `${startDate}T00:00:00`)
        .lte("opened_at", `${endDate}T23:59:59`)
        .order("opened_at", { ascending: false });

      if (sessionsError) throw sessionsError;

      // Get user profiles
      const userIds = [...new Set(sessionsData?.map(s => s.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]) || []);

      // Get brand balances for all sessions
      const sessionIds = sessionsData?.map(s => s.id) || [];
      const { data: balancesData } = await supabase
        .from("shift_brand_balances")
        .select(`
          shift_session_id,
          brand_id,
          closing_balance,
          brands (
            brand_name
          )
        `)
        .in("shift_session_id", sessionIds);

      // Group balances by session
      const balancesMap = new Map<string, BrandBalance[]>();
      balancesData?.forEach(b => {
        const sessionBalances = balancesMap.get(b.shift_session_id) || [];
        sessionBalances.push({
          brand_id: b.brand_id,
          brand_name: (b.brands as any)?.brand_name || "Unknown",
          closing_balance: b.closing_balance
        });
        balancesMap.set(b.shift_session_id, sessionBalances);
      });

      // Combine data
      let combinedData: ShiftSession[] = sessionsData?.map(session => ({
        id: session.id,
        status: session.status,
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        user_name: profilesMap.get(session.user_id) || "Unknown",
        shift_name: (session.shift_assignments as any)?.shifts?.shift_name || "",
        shift_color: (session.shift_assignments as any)?.shifts?.color || "#3b82f6",
        assignment_date: (session.shift_assignments as any)?.assignment_date || "",
        zone_name: (session.shift_assignments as any)?.shifts?.shift_types?.zone_name || null,
        brand_balances: balancesMap.get(session.id) || []
      })) || [];

      // Apply filters
      if (selectedStatus !== "all") {
        combinedData = combinedData.filter(s => s.status === selectedStatus);
      }
      if (selectedUser !== "all") {
        combinedData = combinedData.filter(s => s.user_name === selectedUser);
      }

      setSessions(combinedData);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error(language === "ar" ? "فشل في تحميل التقرير" : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = language === "ar" 
      ? ["التاريخ", "اسم الموظف", "المناوبة", "المنطقة", "الحالة", "وقت الفتح", "وقت الإغلاق", "أرصدة الإغلاق"]
      : ["Date", "Employee", "Shift", "Zone", "Status", "Opened At", "Closed At", "Closing Balances"];
    
    const rows = sessions.map(session => [
      session.assignment_date,
      session.user_name,
      session.shift_name,
      session.zone_name || "",
      session.status,
      format(new Date(session.opened_at), "yyyy-MM-dd HH:mm:ss"),
      session.closed_at ? format(new Date(session.closed_at), "yyyy-MM-dd HH:mm:ss") : "",
      session.brand_balances.map(b => `${b.brand_name}: ${b.closing_balance}`).join(" | ")
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `shift_sessions_report_${startDate}_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(language === "ar" ? "تم تصدير التقرير بنجاح" : "Report exported successfully");
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      open: { 
        label: language === "ar" ? "مفتوح" : "Open", 
        variant: "default" 
      },
      closed: { 
        label: language === "ar" ? "مغلق" : "Closed", 
        variant: "secondary" 
      }
    };
    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return "-";
    return format(new Date(dateTime), "yyyy-MM-dd HH:mm:ss");
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-3xl font-bold mb-2">
          {language === "ar" ? "تقرير الورديات" : "Shift Sessions Report"}
        </h1>
        <p className="text-foreground/70">
          {language === "ar" 
            ? "عرض وتصدير تقرير جلسات الورديات الفعلية مع الأرصدة" 
            : "View and export actual shift sessions report with balances"}
        </p>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{language === "ar" ? "الفلاتر" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                {language === "ar" ? "من تاريخ" : "From Date"}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">
                {language === "ar" ? "إلى تاريخ" : "To Date"}
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">
                {language === "ar" ? "الحالة" : "Status"}
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر الحالة" : "Select status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع الحالات" : "All Statuses"}
                  </SelectItem>
                  <SelectItem value="open">
                    {language === "ar" ? "مفتوح" : "Open"}
                  </SelectItem>
                  <SelectItem value="closed">
                    {language === "ar" ? "مغلق" : "Closed"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">
                {language === "ar" ? "الموظف" : "Employee"}
              </Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر الموظف" : "Select employee"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع الموظفين" : "All Employees"}
                  </SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_name}>
                      {user.user_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchSessions} className="w-full" disabled={loading}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {loading 
                  ? (language === "ar" ? "جاري التحميل..." : "Loading...") 
                  : (language === "ar" ? "عرض التقرير" : "Show Report")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {sessions.length > 0 && (
        <Card>
          <CardHeader className="print:pb-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle>
                {language === "ar" 
                  ? `نتائج التقرير (${sessions.length} جلسة)` 
                  : `Report Results (${sessions.length} session${sessions.length > 1 ? 's' : ''})`}
              </CardTitle>
              <div className="flex gap-2 print:hidden">
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="mr-2 h-4 w-4" />
                  {language === "ar" ? "طباعة" : "Print"}
                </Button>
                <Button onClick={exportToCSV} variant="outline">
                  <FileDown className="mr-2 h-4 w-4" />
                  {language === "ar" ? "تصدير إلى CSV" : "Export to CSV"}
                </Button>
              </div>
            </div>
            <div className="hidden print:block text-sm text-foreground/80 mt-2">
              {language === "ar" 
                ? `الفترة: من ${startDate} إلى ${endDate}` 
                : `Period: ${startDate} to ${endDate}`}
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "المناوبة" : "Shift"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "المنطقة" : "Zone"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "وقت الفتح الفعلي" : "Actual Open Time"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "وقت الإغلاق الفعلي" : "Actual Close Time"}</TableHead>
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "أرصدة الإغلاق" : "Closing Balances"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="whitespace-nowrap text-foreground">
                        {session.assignment_date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-foreground">{session.user_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: session.shift_color }}
                          />
                          <span className="whitespace-nowrap text-foreground">{session.shift_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-foreground">{session.zone_name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="whitespace-nowrap text-foreground">{formatDateTime(session.opened_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-foreground">{formatDateTime(session.closed_at)}</TableCell>
                      <TableCell>
                        {session.brand_balances.length > 0 ? (
                          <div className="space-y-1">
                            {session.brand_balances.map((balance, idx) => (
                              <div key={idx} className="text-xs whitespace-nowrap text-foreground">
                                <span className="font-medium">{balance.brand_name}:</span>{" "}
                                <span>{balance.closing_balance.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-foreground/60">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && sessions.length === 0 && (
        <Card className="print:hidden">
          <CardContent className="py-8 text-center text-foreground/70">
            {language === "ar" 
              ? "لا توجد جلسات ورديات في الفترة المحددة - اضغط على عرض التقرير" 
              : "No shift sessions found - click Show Report"}
          </CardContent>
        </Card>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .space-y-6, .space-y-6 * {
            visibility: visible;
          }
          .space-y-6 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:pb-2 {
            padding-bottom: 0.5rem !important;
          }
          table {
            font-size: 10px;
          }
          th, td {
            padding: 4px 8px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ShiftReport;
