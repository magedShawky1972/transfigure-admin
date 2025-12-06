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
import { formatKSADateTime, getKSADateString } from "@/lib/ksaTime";

interface BrandBalance {
  brand_id: string;
  brand_name: string;
  closing_balance: number;
}

interface LudoSummary {
  product_sku: string;
  product_name: string;
  count: number;
  total: number;
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
  ludo_summary: LudoSummary[];
}

const ShiftReport = () => {
  const { language } = useLanguage();
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(false);
  // Initialize with KSA date
  const [startDate, setStartDate] = useState(getKSADateString());
  const [endDate, setEndDate] = useState(getKSADateString());
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

      // Get Ludo transactions for all sessions
      const { data: ludoData } = await supabase
        .from("ludo_transactions")
        .select("shift_session_id, product_sku, amount")
        .in("shift_session_id", sessionIds);

      // Group and summarize Ludo transactions by session
      const ludoMap = new Map<string, LudoSummary[]>();
      ludoData?.forEach(tx => {
        const sessionLudo = ludoMap.get(tx.shift_session_id) || [];
        const existing = sessionLudo.find(l => l.product_sku === tx.product_sku);
        if (existing) {
          existing.count += 1;
          existing.total += tx.amount;
        } else {
          sessionLudo.push({
            product_sku: tx.product_sku,
            product_name: tx.product_sku === "YA019" ? "فارس" : tx.product_sku === "YA018" ? "اللواء" : tx.product_sku,
            count: 1,
            total: tx.amount
          });
        }
        ludoMap.set(tx.shift_session_id, sessionLudo);
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
        brand_balances: balancesMap.get(session.id) || [],
        ludo_summary: ludoMap.get(session.id) || []
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
      ? ["التاريخ", "اسم الموظف", "المناوبة", "المنطقة", "الحالة", "وقت الفتح", "وقت الإغلاق", "أرصدة الإغلاق", "يلا لودو"]
      : ["Date", "Employee", "Shift", "Zone", "Status", "Opened At", "Closed At", "Closing Balances", "Yalla Ludo"];
    
    const rows = sessions.map(session => [
      session.assignment_date,
      session.user_name,
      session.shift_name,
      session.zone_name || "",
      session.status,
      formatKSADateTime(session.opened_at, true),
      session.closed_at ? formatKSADateTime(session.closed_at, true) : "",
      session.brand_balances.map(b => `${b.brand_name}: ${b.closing_balance}`).join(" | "),
      session.ludo_summary.map(l => `${l.product_name}: ${l.total} (${l.count})`).join(" | ")
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

  // Use centralized KSA time formatting
  const formatDateTimeKSA = (dateTime: string | null) => {
    return formatKSADateTime(dateTime, true);
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
                    <TableHead className="whitespace-nowrap">{language === "ar" ? "يلا لودو" : "Yalla Ludo"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">
                        {session.assignment_date}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">{session.user_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: session.shift_color }}
                          />
                          <span className="whitespace-nowrap text-black dark:text-white font-medium">{session.shift_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">{session.zone_name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">{formatDateTimeKSA(session.opened_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">{formatDateTimeKSA(session.closed_at)}</TableCell>
                      <TableCell>
                        {session.brand_balances.length > 0 ? (
                          <div className="space-y-1">
                            {session.brand_balances.map((balance, idx) => (
                              <div key={idx} className="text-xs whitespace-nowrap text-black dark:text-white">
                                <span className="font-semibold">{balance.brand_name}:</span>{" "}
                                <span className="font-medium">{balance.closing_balance.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-black dark:text-white">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.ludo_summary.length > 0 ? (
                          <div className="space-y-1">
                            {session.ludo_summary.map((ludo, idx) => (
                              <div key={idx} className="text-xs whitespace-nowrap text-purple-600 dark:text-purple-400">
                                <span className="font-semibold">{ludo.product_name}:</span>{" "}
                                <span className="font-medium">{ludo.total.toLocaleString()} ({ludo.count})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-black dark:text-white">-</span>
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
          @page {
            margin: 5mm;
            size: landscape;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
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
            margin: 0 !important;
            padding: 0 !important;
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
            font-size: 8px;
            width: 100%;
            table-layout: auto;
          }
          th, td {
            padding: 2px 4px !important;
            color: #000000 !important;
            white-space: nowrap;
          }
          table * {
            color: #000000 !important;
          }
          h1, h2, h3, h4, h5, h6, p, span, div {
            color: #000000 !important;
          }
          .rounded-md {
            border-radius: 0 !important;
          }
          .border {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ShiftReport;
