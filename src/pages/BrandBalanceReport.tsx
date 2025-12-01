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

interface BrandBalanceEntry {
  id: string;
  brand_name: string;
  brand_code: string | null;
  closing_balance: number;
  reorder_point: number;
  user_name: string;
  shift_name: string;
  assignment_date: string;
  closed_at: string | null;
}

const BrandBalanceReport = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [balances, setBalances] = useState<BrandBalanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [brands, setBrands] = useState<{ id: string; brand_name: string; brand_code: string | null }[]>([]);
  const [users, setUsers] = useState<{ user_id: string; user_name: string }[]>([]);

  useEffect(() => {
    fetchBrands();
    fetchUsers();
  }, []);

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

  const fetchBalances = async () => {
    setLoading(true);
    try {
      // First get A-class brand IDs
      const { data: aClassBrands, error: brandsError } = await supabase
        .from("brands")
        .select("id, brand_name, brand_code, reorder_point")
        .eq("abc_analysis", "A")
        .eq("status", "active");

      if (brandsError) throw brandsError;

      const aClassBrandIds = aClassBrands?.map(b => b.id) || [];
      const brandMap = new Map(aClassBrands?.map(b => [b.id, { name: b.brand_name, code: b.brand_code, reorder_point: b.reorder_point || 0 }]) || []);

      // Get shift sessions within date range
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("shift_sessions")
        .select(`
          id,
          user_id,
          closed_at,
          shift_assignment_id,
          shift_assignments (
            assignment_date,
            shifts (
              shift_name
            )
          )
        `)
        .gte("opened_at", `${startDate}T00:00:00`)
        .lte("opened_at", `${endDate}T23:59:59`);

      if (sessionsError) throw sessionsError;

      const sessionIds = sessionsData?.map(s => s.id) || [];
      const userIds = [...new Set(sessionsData?.map(s => s.user_id) || [])];

      // Get user profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.user_name]) || []);

      // Get brand balances for A-class brands only
      let balanceQuery = supabase
        .from("shift_brand_balances")
        .select("id, shift_session_id, brand_id, closing_balance")
        .in("shift_session_id", sessionIds)
        .in("brand_id", aClassBrandIds);

      if (selectedBrand !== "all") {
        balanceQuery = balanceQuery.eq("brand_id", selectedBrand);
      }

      const { data: balancesData, error: balancesError } = await balanceQuery;

      if (balancesError) throw balancesError;

      // Create session map for quick lookup
      const sessionMap = new Map(sessionsData?.map(s => [s.id, s]) || []);

      // Combine data
      let combinedData: BrandBalanceEntry[] = (balancesData || []).map(balance => {
        const session = sessionMap.get(balance.shift_session_id);
        const brandInfo = brandMap.get(balance.brand_id);
        return {
          id: balance.id,
          brand_name: brandInfo?.name || "Unknown",
          brand_code: brandInfo?.code || null,
          closing_balance: balance.closing_balance,
          reorder_point: brandInfo?.reorder_point || 0,
          user_name: profilesMap.get(session?.user_id) || "Unknown",
          shift_name: (session?.shift_assignments as any)?.shifts?.shift_name || "",
          assignment_date: (session?.shift_assignments as any)?.assignment_date || "",
          closed_at: session?.closed_at || null
        };
      });

      // Apply user filter
      if (selectedUser !== "all") {
        combinedData = combinedData.filter(b => b.user_name === selectedUser);
      }

      // Sort by date descending then brand name
      combinedData.sort((a, b) => {
        const dateCompare = b.assignment_date.localeCompare(a.assignment_date);
        if (dateCompare !== 0) return dateCompare;
        return a.brand_name.localeCompare(b.brand_name);
      });

      setBalances(combinedData);
      toast.success(language === "ar" ? `تم تحميل ${combinedData.length} سجل` : `Loaded ${combinedData.length} records`);
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast.error(language === "ar" ? "فشل في تحميل التقرير" : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (balances.length === 0) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const headers = language === "ar"
      ? ["التاريخ", "البراند", "كود البراند", "رصيد الإغلاق", "نقطة إعادة الطلب", "الفرق", "الموظف", "المناوبة", "وقت الإغلاق"]
      : ["Date", "Brand", "Brand Code", "Closing Balance", "Reorder Point", "Difference", "Employee", "Shift", "Close Time"];

    const rows = balances.map(balance => {
      const diff = balance.closing_balance - balance.reorder_point;
      return [
        balance.assignment_date,
        balance.brand_name,
        balance.brand_code || "",
        balance.closing_balance.toLocaleString(),
        balance.reorder_point.toLocaleString(),
        diff.toLocaleString(),
        balance.user_name,
        balance.shift_name,
        balance.closed_at ? format(new Date(balance.closed_at), "yyyy-MM-dd HH:mm:ss") : ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `brand_balance_report_${startDate}_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(language === "ar" ? "تم تصدير التقرير بنجاح" : "Report exported successfully");
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return "-";
    return format(new Date(dateTime), "yyyy-MM-dd HH:mm:ss");
  };

  // Calculate totals per brand
  const brandTotals = balances.reduce((acc, b) => {
    if (!acc[b.brand_name]) {
      acc[b.brand_name] = { total: 0, count: 0 };
    }
    acc[b.brand_name].total += b.closing_balance;
    acc[b.brand_name].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  return (
    <div className="space-y-6">
      <div className="print:hidden flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {language === "ar" ? "تقرير أرصدة البراندات" : "Brand Balance Report"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "عرض أرصدة الإغلاق لمنتجات الفئة A المسجلة من مندوبي المبيعات"
              : "View closing balances for A-class products recorded by sales reps"}
          </p>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-center text-black">
          {language === "ar" ? "تقرير أرصدة البراندات" : "Brand Balance Report"}
        </h1>
        <p className="text-center text-black text-sm mt-1">
          {language === "ar" ? `الفترة: من ${startDate} إلى ${endDate}` : `Period: ${startDate} to ${endDate}`}
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
              <Button onClick={fetchBalances} className="w-full" disabled={loading}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {loading
                  ? (language === "ar" ? "جاري التحميل..." : "Loading...")
                  : (language === "ar" ? "عرض التقرير" : "Show Report")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {balances.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
            {Object.entries(brandTotals).map(([brandName, data]) => (
              <Card key={brandName} className="print:border print:border-gray-300">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground print:text-black">{brandName}</div>
                  <div className="text-2xl font-bold print:text-black">{data.total.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground print:text-black">
                    {language === "ar" ? `${data.count} سجل` : `${data.count} record${data.count > 1 ? 's' : ''}`}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="print:pb-2">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <CardTitle>
                  {language === "ar"
                    ? `نتائج التقرير (${balances.length} سجل)`
                    : `Report Results (${balances.length} record${balances.length > 1 ? 's' : ''})`}
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
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                      <TableHead className="whitespace-nowrap">{language === "ar" ? "البراند" : "Brand"}</TableHead>
                      <TableHead className="whitespace-nowrap">{language === "ar" ? "كود البراند" : "Brand Code"}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{language === "ar" ? "رصيد الإغلاق" : "Closing Balance"}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{language === "ar" ? "نقطة إعادة الطلب" : "Reorder Point"}</TableHead>
                      <TableHead className="whitespace-nowrap text-right">{language === "ar" ? "الفرق" : "Difference"}</TableHead>
                      <TableHead className="whitespace-nowrap">{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                      <TableHead className="whitespace-nowrap">{language === "ar" ? "المناوبة" : "Shift"}</TableHead>
                      <TableHead className="whitespace-nowrap">{language === "ar" ? "وقت الإغلاق" : "Close Time"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.map((balance) => {
                      const diff = balance.closing_balance - balance.reorder_point;
                      const isPositive = balance.closing_balance > balance.reorder_point;
                      return (
                        <TableRow key={balance.id}>
                          <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">
                            {balance.assignment_date}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white font-medium">
                            {balance.brand_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white">
                            {balance.brand_code || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white font-bold text-right">
                            {balance.closing_balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white text-right">
                            {balance.reorder_point.toLocaleString()}
                          </TableCell>
                          <TableCell className={`whitespace-nowrap font-bold text-right ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {diff.toLocaleString()}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white">
                            {balance.user_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white">
                            {balance.shift_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-black dark:text-white">
                            {formatDateTime(balance.closed_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {balances.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              {language === "ar"
                ? "اختر الفترة والفلاتر ثم اضغط على 'عرض التقرير'"
                : "Select date range and filters, then click 'Show Report'"}
            </p>
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
          table {
            font-size: 10px !important;
          }
          th, td {
            padding: 4px 8px !important;
            color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BrandBalanceReport;
