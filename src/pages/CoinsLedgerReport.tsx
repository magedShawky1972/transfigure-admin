import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown, Calendar as CalendarIcon, Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { convertToKSA, formatKSADateTime } from "@/lib/ksaTime";

interface ShiftSession {
  id: string;
  user_id: string;
  user_name: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  shift_name: string;
  assignment_date: string;
}

interface BrandBalance {
  brand_id: string;
  brand_name: string;
  brand_code: string | null;
  opening_balance: number;
  closing_balance: number;
}

interface Transaction {
  id: string;
  order_number: string;
  product_name: string;
  qty: number;
  coins_number: number;
  running_balance: number;
  created_at_date: string;
  trans_type: string;
  user_name: string | null;
}

interface BrandLedger {
  brand_id: string;
  brand_name: string;
  brand_code: string | null;
  opening_balance: number;
  closing_balance: number;
  transactions: Transaction[];
  variance: number;
  total_coins_sold: number;
}

interface ShiftLedger {
  session: ShiftSession;
  brandLedgers: BrandLedger[];
}

const CoinsLedgerReport = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [users, setUsers] = useState<{ user_id: string; user_name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; brand_name: string; brand_code: string | null }[]>([]);
  const [shiftLedgers, setShiftLedgers] = useState<ShiftLedger[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchBrands();
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

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("id, brand_name, brand_code")
        .eq("abc_analysis", "A")
        .eq("status", "active")
        .order("brand_name");

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error("Error fetching brands:", error);
    }
  };

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      // First get shift assignments for the selected date
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("shift_assignments")
        .select(`
          id,
          assignment_date,
          user_id,
          shifts (
            shift_name
          )
        `)
        .eq("assignment_date", selectedDate);

      if (assignmentsError) throw assignmentsError;

      if (!assignmentsData || assignmentsData.length === 0) {
        setShiftLedgers([]);
        toast.info(language === "ar" ? "لا توجد مناوبات في هذا التاريخ" : "No shifts found for this date");
        setLoading(false);
        return;
      }

      const assignmentIds = assignmentsData.map(a => a.id);

      // Get shift sessions for these assignments
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("shift_sessions")
        .select(`
          id,
          user_id,
          opened_at,
          closed_at,
          status,
          shift_assignment_id
        `)
        .eq("status", "closed")
        .in("shift_assignment_id", assignmentIds)
        .order("opened_at", { ascending: true });

      if (sessionsError) throw sessionsError;

      if (!sessionsData || sessionsData.length === 0) {
        setShiftLedgers([]);
        toast.info(language === "ar" ? "لا توجد مناوبات مغلقة في هذا التاريخ" : "No closed shifts found for this date");
        setLoading(false);
        return;
      }

      // Create a map from assignment_id to assignment data
      const assignmentMap = new Map(assignmentsData.map(a => [a.id, a]));

      // Get user profiles
      const userIds = [...new Set(sessionsData.map(s => s.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]) || []);

      // Filter by user if selected
      let filteredSessions = sessionsData;
      if (selectedUser !== "all") {
        filteredSessions = sessionsData.filter(s => s.user_id === selectedUser);
      }

      if (filteredSessions.length === 0) {
        setShiftLedgers([]);
        toast.info(language === "ar" ? "لا توجد مناوبات للمستخدم المحدد" : "No shifts found for selected user");
        setLoading(false);
        return;
      }

      // Get A-class brand IDs
      const { data: aClassBrands } = await supabase
        .from("brands")
        .select("id, brand_name, brand_code")
        .eq("abc_analysis", "A")
        .eq("status", "active");

      const brandMap = new Map(aClassBrands?.map(b => [b.id, { name: b.brand_name, code: b.brand_code }]) || []);
      const brandCodeMap = new Map(aClassBrands?.map(b => [b.brand_code, b.id]) || []);

      const sessionIds = filteredSessions.map(s => s.id);

      // Get brand balances for current sessions
      const { data: balancesData } = await supabase
        .from("shift_brand_balances")
        .select("shift_session_id, brand_id, opening_balance, closing_balance")
        .in("shift_session_id", sessionIds);

      // Get all brand IDs from current balances
      const brandIdsInBalances = [...new Set((balancesData || []).map(b => b.brand_id))];

      // For each session+brand, get the previous shift's closing balance
      // We need to find the most recent closed session before each current session for each brand
      const previousClosingBalances = new Map<string, number>(); // key: `${sessionId}_${brandId}`
      
      for (const session of filteredSessions) {
        for (const brandId of brandIdsInBalances) {
          // Find the previous shift session that has a closing balance for this brand
          const { data: prevBalance } = await supabase
            .from("shift_brand_balances")
            .select(`
              closing_balance,
              shift_sessions!inner (
                id,
                opened_at,
                status
              )
            `)
            .eq("brand_id", brandId)
            .eq("shift_sessions.status", "closed")
            .lt("shift_sessions.opened_at", session.opened_at)
            .order("shift_sessions(opened_at)", { ascending: false })
            .limit(1)
            .single();

          if (prevBalance) {
            previousClosingBalances.set(`${session.id}_${brandId}`, prevBalance.closing_balance);
          }
        }
      }

      // Get transactions for the selected date
      const { data: transactionsData } = await supabase
        .from("purpletransaction")
        .select("id, order_number, product_name, qty, coins_number, brand_code, created_at_date, trans_type, user_name")
        .gte("created_at_date", `${selectedDate} 00:00:00`)
        .lte("created_at_date", `${selectedDate} 23:59:59`)
        .like("brand_code", "C01%")
        .order("created_at_date", { ascending: true });

      // Build shift ledgers
      const ledgers: ShiftLedger[] = [];

      for (const session of filteredSessions) {
        const userName = profilesMap.get(session.user_id) || "Unknown";
        const assignment = assignmentMap.get(session.shift_assignment_id);
        const shiftName = (assignment?.shifts as any)?.shift_name || "";
        const assignmentDate = assignment?.assignment_date || selectedDate;

        const shiftSession: ShiftSession = {
          id: session.id,
          user_id: session.user_id,
          user_name: userName,
          opened_at: session.opened_at,
          closed_at: session.closed_at,
          status: session.status,
          shift_name: shiftName,
          assignment_date: assignmentDate
        };

        // Get balances for this session
        const sessionBalances = (balancesData || []).filter(b => b.shift_session_id === session.id);

        // Build brand ledgers
        const brandLedgers: BrandLedger[] = [];

        for (const balance of sessionBalances) {
          const brandInfo = brandMap.get(balance.brand_id);
          if (!brandInfo) continue;

          // Filter by brand if selected
          if (selectedBrand !== "all" && balance.brand_id !== selectedBrand) continue;

          // Get transactions for this brand during shift time
          const openedAt = new Date(session.opened_at);
          const closedAt = session.closed_at ? new Date(session.closed_at) : new Date();

          const brandTransactions = (transactionsData || [])
            .filter(t => {
              const brandId = brandCodeMap.get(t.brand_code);
              if (brandId !== balance.brand_id) return false;

              const txTime = new Date(t.created_at_date);
              return txTime >= openedAt && txTime <= closedAt;
            })
            .map(t => ({
              ...t,
              running_balance: 0
            }));

          // Get opening balance from previous shift's closing balance
          const prevClosingKey = `${session.id}_${balance.brand_id}`;
          const openingFromPrevShift = previousClosingBalances.get(prevClosingKey) ?? balance.opening_balance ?? 0;

          // Calculate running balance using previous shift's closing as opening
          let runningBalance = openingFromPrevShift;
          const transactionsWithBalance: Transaction[] = brandTransactions.map(t => {
            runningBalance -= (t.coins_number || 0) * (t.qty || 1);
            return {
              id: t.id,
              order_number: t.order_number || "",
              product_name: t.product_name || "",
              qty: t.qty || 1,
              coins_number: t.coins_number || 0,
              running_balance: runningBalance,
              created_at_date: t.created_at_date,
              trans_type: t.trans_type || "",
              user_name: t.user_name
            };
          });

          const totalCoinsSold = transactionsWithBalance.reduce((sum, t) => sum + (t.coins_number * t.qty), 0);
          const expectedClosing = openingFromPrevShift - totalCoinsSold;
          const variance = (balance.closing_balance || 0) - expectedClosing;

          brandLedgers.push({
            brand_id: balance.brand_id,
            brand_name: brandInfo.name,
            brand_code: brandInfo.code,
            opening_balance: openingFromPrevShift,
            closing_balance: balance.closing_balance || 0,
            transactions: transactionsWithBalance,
            variance,
            total_coins_sold: totalCoinsSold
          });
        }

        if (brandLedgers.length > 0) {
          ledgers.push({
            session: shiftSession,
            brandLedgers
          });
        }
      }

      setShiftLedgers(ledgers);
      toast.success(language === "ar" ? `تم تحميل ${ledgers.length} مناوبة` : `Loaded ${ledgers.length} shift(s)`);
    } catch (error) {
      console.error("Error fetching ledger data:", error);
      toast.error(language === "ar" ? "فشل في تحميل البيانات" : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const ksaDate = convertToKSA(dateStr);
      return format(ksaDate, "MM/dd/yy hh:mm a");
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const ksaDate = convertToKSA(dateStr);
      const hours = ksaDate.getHours();
      const minutes = ksaDate.getMinutes().toString().padStart(2, '0');
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return "-";
    }
  };

  const calculateShiftDuration = (opened: string, closed: string | null) => {
    if (!closed) return "-";
    try {
      const start = convertToKSA(opened);
      const end = convertToKSA(closed);
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}:${mins.toString().padStart(2, '0')}`;
    } catch {
      return "-";
    }
  };

  const exportToCSV = () => {
    if (shiftLedgers.length === 0) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const rows: string[][] = [];
    
    // Add header
    rows.push([
      "Date", "User", "Shift", "Start Time", "End Time", "Duration",
      "Brand", "Open Balance", "Product Name", "QTY", "Coins", "Balance",
      "Date Time", "Order Number", "Type", "Close Balance", "Variance"
    ]);

    shiftLedgers.forEach(ledger => {
      ledger.brandLedgers.forEach(brand => {
        // Add opening row
        rows.push([
          ledger.session.assignment_date,
          ledger.session.user_name,
          ledger.session.shift_name,
          formatTime(ledger.session.opened_at),
          formatTime(ledger.session.closed_at),
          calculateShiftDuration(ledger.session.opened_at, ledger.session.closed_at),
          brand.brand_name,
          brand.opening_balance.toLocaleString(),
          "", "", "", brand.opening_balance.toLocaleString(),
          "", "", "",
          "", ""
        ]);

        // Add transactions
        brand.transactions.forEach(tx => {
          rows.push([
            "", "", "", "", "", "",
            "",
            "",
            tx.product_name,
            tx.qty.toString(),
            tx.coins_number.toLocaleString(),
            tx.running_balance.toLocaleString(),
            formatDateTime(tx.created_at_date),
            tx.order_number,
            tx.trans_type,
            "", ""
          ]);
        });

        // Add closing row
        rows.push([
          "", "", "", "", "", "",
          "",
          "",
          "", "", "", "",
          "", "", "",
          brand.closing_balance.toLocaleString(),
          brand.variance.toLocaleString()
        ]);
      });
    });

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `coins_ledger_${selectedDate}.csv`;
    link.click();

    toast.success(language === "ar" ? "تم تصدير التقرير" : "Report exported");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {language === "ar" ? "تقرير دفتر الكوينز" : "Coins Ledger Report"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "عرض حركة الكوينز لكل مناوبة مع الرصيد الافتتاحي والختامي والفرق"
              : "View coins movement per shift with opening, closing balances and variance"}
          </p>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-center text-black">
          {language === "ar" ? "تقرير دفتر الكوينز" : "Coins Ledger Report"}
        </h1>
        <p className="text-center text-black text-sm mt-1">
          {language === "ar" ? `التاريخ: ${selectedDate}` : `Date: ${selectedDate}`}
        </p>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{language === "ar" ? "الفلاتر" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                {language === "ar" ? "التاريخ" : "Date"}
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
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
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.user_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">
                {language === "ar" ? "البراند" : "Brand"}
              </Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر البراند" : "Select brand"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع البراندات" : "All Brands"}
                  </SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.brand_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchLedgerData} className="w-full" disabled={loading}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {loading
                  ? (language === "ar" ? "جاري التحميل..." : "Loading...")
                  : (language === "ar" ? "عرض التقرير" : "Show Report")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {shiftLedgers.length > 0 && (
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
      )}

      {shiftLedgers.map((ledger) => (
        <Card key={ledger.session.id} className="print:break-inside-avoid print-no-border print-black-text print:shadow-none">
          <CardHeader className="pb-2 print:pb-1">
            <div className="border border-border rounded-lg overflow-hidden print:border-none print:rounded-none">
              <Table>
                <TableBody>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={6} className="text-center font-bold py-2 text-lg">
                      {language === "ar" ? "التاريخ" : "Date"} {format(new Date(ledger.session.assignment_date), "MMM-dd")}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="text-center font-medium py-2">
                      {ledger.session.user_name}
                    </TableCell>
                  </TableRow>
                    <TableRow>
                      <TableCell className="text-center font-medium">
                        {ledger.session.shift_name}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {language === "ar" ? "بداية" : "Open"}: {formatTime(ledger.session.opened_at)}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {language === "ar" ? "نهاية" : "Close"}: {formatTime(ledger.session.closed_at)}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {language === "ar" ? "المدة" : "Duration"}: {calculateShiftDuration(ledger.session.opened_at, ledger.session.closed_at)}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardHeader>
          <CardContent>
            {ledger.brandLedgers.map((brand) => (
              <div key={brand.brand_id} className="mb-6 border border-border rounded-lg overflow-hidden print:border-none print:rounded-none print:mb-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">{language === "ar" ? "براند:" : "Brand:"}</TableHead>
                      <TableHead className="font-bold">{brand.brand_name}</TableHead>
                      <TableHead className="text-center">{language === "ar" ? "رصيد الفتح" : "Open Balance Coins"}</TableHead>
                      <TableHead className="text-right font-bold text-lg">{brand.opening_balance.toLocaleString()}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "المنتج" : "Product Name"}</TableHead>
                      <TableHead className="text-center">{language === "ar" ? "الكمية" : "QTY"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "الكوينز" : "Coins"}</TableHead>
                      <TableHead className="text-right">{language === "ar" ? "الرصيد" : "Balance"}</TableHead>
                      <TableHead className="text-center">{language === "ar" ? "التاريخ والوقت" : "Date Time"}</TableHead>
                      <TableHead className="text-center">{language === "ar" ? "رقم الطلب" : "Order Number"}</TableHead>
                      <TableHead className="text-center">{language === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brand.transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                          {language === "ar" ? "لا توجد معاملات" : "No transactions"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      brand.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium">{tx.product_name}</TableCell>
                          <TableCell className="text-center">{tx.qty}</TableCell>
                          <TableCell className="text-right">{tx.coins_number.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{tx.running_balance.toLocaleString()}</TableCell>
                          <TableCell className="text-center text-sm">{formatDateTime(tx.created_at_date)}</TableCell>
                          <TableCell className="text-center">{tx.order_number}</TableCell>
                          <TableCell className="text-center capitalize">{tx.trans_type}</TableCell>
                          <TableCell>{tx.user_name || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell colSpan={2}>{language === "ar" ? "إجمالي المبيعات" : "Total Sales"}</TableCell>
                      <TableCell className="text-center">{brand.transactions.reduce((sum, t) => sum + t.qty, 0)}</TableCell>
                      <TableCell className="text-right font-bold text-lg">{brand.total_coins_sold.toLocaleString()}</TableCell>
                      <TableCell colSpan={4}></TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>{language === "ar" ? "براند:" : "Brand:"}</TableCell>
                      <TableCell>{brand.brand_name}</TableCell>
                      <TableCell className="text-center">{language === "ar" ? "رصيد الإغلاق" : "Close Balance Coins"}</TableCell>
                      <TableCell className="text-right font-bold text-lg">{brand.closing_balance.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{language === "ar" ? "الفرق" : "Variance"}</TableCell>
                      <TableCell className={`text-right font-bold ${brand.variance !== 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {brand.variance !== 0 ? `(${Math.abs(brand.variance).toLocaleString()})` : "0"}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {shiftLedgers.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {language === "ar"
              ? "اختر التاريخ وانقر على 'عرض التقرير' لعرض دفتر الكوينز"
              : "Select a date and click 'Show Report' to view the coins ledger"}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CoinsLedgerReport;
