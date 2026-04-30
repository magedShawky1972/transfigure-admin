import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown, Calendar as CalendarIcon, Printer, ArrowLeft, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";

interface ImageEntry {
  id: string;
  brand_id: string;
  brand_name: string;
  brand_code: string | null;
  opening_balance: number;
  closing_balance: number;
  opening_image_path: string | null;
  receipt_image_path: string | null;
  receiving_coins: number;
  user_name: string;
  shift_name: string;
  assignment_date: string;
  opened_at: string | null;
  closed_at: string | null;
}

type ShiftFamily = "sales" | "support" | "sales-training" | "other";

interface AssignmentMeta {
  id: string;
  assignment_date: string;
  shift_name: string;
  shift_order: number;
  shift_family: ShiftFamily;
}

interface PriorClosingMeta {
  assignment_date: string;
  shift_order: number;
  shift_family: ShiftFamily;
  closed_at: string | null;
  closing_balance: number;
}

const ClassABalanceImagesReport = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [imageFilter, setImageFilter] = useState<string>("all"); // all | with | without
  const [brands, setBrands] = useState<{ id: string; brand_name: string }[]>([]);
  const [users, setUsers] = useState<{ user_id: string; user_name: string }[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const getShiftFamily = (shiftType: string | null | undefined, shiftName: string | null | undefined): ShiftFamily => {
    const haystack = `${shiftType || ""} ${shiftName || ""}`.toLowerCase();
    if (haystack.includes("training") || haystack.includes("تدريب")) return "sales-training";
    if (haystack.includes("support") || haystack.includes("دعم")) return "support";
    if (haystack.includes("sale") || haystack.includes("مبيعات")) return "sales";
    return "other";
  };

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase
        .from("brands")
        .select("id, brand_name")
        .eq("abc_analysis", "A")
        .eq("status", "active")
        .order("brand_name");
      setBrands(b || []);

      const { data: u } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .eq("is_active", true)
        .order("user_name");
      setUsers(u || []);
    })();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data: aBrands } = await supabase
        .from("brands")
        .select("id, brand_name, brand_code")
        .eq("abc_analysis", "A")
        .eq("status", "active");

      const aIds = aBrands?.map((b) => b.id) || [];
      const brandMap = new Map(aBrands?.map((b) => [b.id, b]) || []);

      const { data: assignments } = await supabase
        .from("shift_assignments")
        .select("id, assignment_date, shifts ( shift_name, shift_order, shift_types ( type ) )")
        .gte("assignment_date", startDate)
        .lte("assignment_date", endDate);

      const assignmentRows: AssignmentMeta[] = (assignments || []).map((a: any) => ({
        id: a.id,
        assignment_date: a.assignment_date,
        shift_name: a?.shifts?.shift_name || "",
        shift_order: Number(a?.shifts?.shift_order || 0),
        shift_family: getShiftFamily(a?.shifts?.shift_types?.type, a?.shifts?.shift_name),
      }));

      const assignmentIds = assignmentRows.map((a) => a.id);
      const assignmentMap = new Map(assignmentRows.map((a) => [a.id, a]));

      const { data: sessions } = await supabase
        .from("shift_sessions")
        .select(`id, user_id, opened_at, closed_at, shift_assignment_id`)
        .in("shift_assignment_id", assignmentIds.length ? assignmentIds : ["00000000-0000-0000-0000-000000000000"]);

      const sessionMap = new Map(sessions?.map((s) => [s.id, s]) || []);
      const sessionIds = sessions?.map((s) => s.id) || [];
      const userIds = [...new Set(sessions?.map((s) => s.user_id) || [])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, user_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.user_name]) || []);

      let q = supabase
        .from("shift_brand_balances")
        .select("id, shift_session_id, brand_id, opening_balance, closing_balance, opening_image_path, receipt_image_path")
        .in("shift_session_id", sessionIds)
        .in("brand_id", aIds);

      if (selectedBrand !== "all") q = q.eq("brand_id", selectedBrand);

      const { data: balances, error } = await q;
      if (error) throw error;

      // Opening = closing_balance of the previous row for the same brand,
      // ordered by brand_name, opened_at across the entire history.
      const brandIdsInResults = [...new Set((balances || []).map((b) => b.brand_id))];

      // Fetch ALL balances for the brands in result (paginated to bypass 1000 row limit)
      const allBalancesForBrands: any[] = [];
      if (brandIdsInResults.length) {
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: page, error: pErr } = await supabase
            .from("shift_brand_balances")
            .select("brand_id, closing_balance, receipt_image_path, shift_sessions!inner(opened_at)")
            .in("brand_id", brandIdsInResults)
            .range(from, from + pageSize - 1);
          if (pErr) throw pErr;
          if (!page || page.length === 0) break;
          allBalancesForBrands.push(...page);
          if (page.length < pageSize) break;
          from += pageSize;
        }
      }

      // Group by brand, sorted ascending by opened_at
      type PriorRow = { opened_at: string; closing_balance: number; receipt_image_path: string | null };
      const historyByBrand = new Map<string, PriorRow[]>();
      allBalancesForBrands.forEach((p: any) => {
        const openedAt = p.shift_sessions?.opened_at;
        if (!openedAt) return;
        const arr = historyByBrand.get(p.brand_id) || [];
        arr.push({
          opened_at: openedAt,
          closing_balance: Number(p.closing_balance || 0),
          receipt_image_path: p.receipt_image_path || null,
        });
        historyByBrand.set(p.brand_id, arr);
      });
      historyByBrand.forEach((arr) =>
        arr.sort((a, b) => a.opened_at.localeCompare(b.opened_at)),
      );

      const findPrior = (brandId: string, openedAt: string | null): PriorRow | null => {
        if (!openedAt) return null;
        const arr = historyByBrand.get(brandId) || [];
        let prior: PriorRow | null = null;
        for (const row of arr) {
          if (row.opened_at < openedAt) prior = row;
          else break;
        }
        return prior;
      };

      // Fetch receiving coins by brand+date for date range
      const { data: rcHeaders } = await supabase
        .from("receiving_coins_header")
        .select("id, receipt_date, receiving_coins_line(brand_id, coins)")
        .gte("receipt_date", startDate)
        .lte("receipt_date", endDate);
      const receivingByBrandDate = new Map<string, number>();
      for (const h of (rcHeaders || []) as any[]) {
        const d = h.receipt_date;
        for (const ln of (h.receiving_coins_line || [])) {
          if (!ln.brand_id || !d) continue;
          const key = `${ln.brand_id}__${d}`;
          receivingByBrandDate.set(key, (receivingByBrandDate.get(key) || 0) + Number(ln.coins || 0));
        }
      }

      let combined: ImageEntry[] = (balances || []).map((b) => {
        const s: any = sessionMap.get(b.shift_session_id);
        const a = s ? assignmentMap.get(s.shift_assignment_id) : null;
        const brand: any = brandMap.get(b.brand_id);
        const prior = findPrior(b.brand_id, s?.opened_at || null);
        const dateKey = a?.assignment_date ? `${b.brand_id}__${a.assignment_date}` : "";
        return {
          id: b.id,
          brand_id: b.brand_id,
          brand_name: brand?.brand_name || "Unknown",
          brand_code: brand?.brand_code || null,
          opening_balance: prior ? prior.closing_balance : 0,
          closing_balance: Number(b.closing_balance || 0),
          opening_image_path: prior ? prior.receipt_image_path : null,
          receipt_image_path: b.receipt_image_path,
          receiving_coins: dateKey ? (receivingByBrandDate.get(dateKey) || 0) : 0,
          user_name: profileMap.get(s?.user_id) || "Unknown",
          shift_name: a?.shift_name || "",
          assignment_date: a?.assignment_date || "",
          opened_at: s?.opened_at || null,
          closed_at: s?.closed_at || null,
        };
      });

      if (selectedUser !== "all") combined = combined.filter((e) => e.user_name === selectedUser);
      if (imageFilter === "with") combined = combined.filter((e) => e.opening_image_path || e.receipt_image_path);
      if (imageFilter === "without") combined = combined.filter((e) => !e.opening_image_path && !e.receipt_image_path);

      combined.sort((a, b) => {
        const d = b.assignment_date.localeCompare(a.assignment_date);
        if (d !== 0) return d;
        return a.brand_name.localeCompare(b.brand_name);
      });

      setEntries(combined);
      toast.success(language === "ar" ? `تم تحميل ${combined.length} سجل` : `Loaded ${combined.length} records`);
    } catch (e) {
      console.error(e);
      toast.error(language === "ar" ? "فشل في تحميل التقرير" : "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!entries.length) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    const headers = language === "ar"
      ? ["التاريخ", "البراند", "كود البراند", "الرصيد الافتتاحي", "الرصيد الختامي", "صورة الافتتاح", "صورة الإغلاق", "الموظف", "المناوبة"]
      : ["Date", "Brand", "Brand Code", "Opening Balance", "Closing Balance", "Opening Image", "Closing Image", "Employee", "Shift"];
    const rows = entries.map((e) => [
      e.assignment_date,
      e.brand_name,
      e.brand_code || "",
      e.opening_balance.toLocaleString(),
      e.closing_balance.toLocaleString(),
      e.opening_image_path || "",
      e.receipt_image_path || "",
      e.user_name,
      e.shift_name,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `class_a_balance_images_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {language === "ar" ? "تقرير صور أرصدة الفئة A" : 'Class "A" Balance Images Report'}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "عرض الصور المرفوعة لأرصدة منتجات الفئة A لكل مناوبة"
              : "View uploaded balance images for Class A products per shift"}
          </p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{language === "ar" ? "الفلاتر" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "البراند" : "Brand"}</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الموظف" : "Employee"}</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_name}>{u.user_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "حالة الصور" : "Image Status"}</Label>
              <Select value={imageFilter} onValueChange={setImageFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="with">{language === "ar" ? "مع صور" : "With Images"}</SelectItem>
                  <SelectItem value="without">{language === "ar" ? "بدون صور" : "Without Images"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchEntries} className="w-full" disabled={loading}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {loading ? (language === "ar" ? "جاري..." : "Loading...") : (language === "ar" ? "عرض" : "Show")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center flex-wrap gap-2">
              <CardTitle>
                {language === "ar" ? `النتائج (${entries.length})` : `Results (${entries.length})`}
              </CardTitle>
              <div className="flex gap-2 print:hidden">
                <Button onClick={() => window.print()} variant="outline">
                  <Printer className="mr-2 h-4 w-4" />
                  {language === "ar" ? "طباعة" : "Print"}
                </Button>
                <Button onClick={exportToCSV} variant="outline">
                  <FileDown className="mr-2 h-4 w-4" />
                  {language === "ar" ? "تصدير CSV" : "Export CSV"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "البراند" : "Brand"}</TableHead>
                    <TableHead>{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                    <TableHead>{language === "ar" ? "المناوبة" : "Shift"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "افتتاحي" : "Opening"}</TableHead>
                    <TableHead>{language === "ar" ? "صورة الافتتاح" : "Opening Image"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "الاستلام" : "Receiving"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "ختامي" : "Closing"}</TableHead>
                    <TableHead>{language === "ar" ? "صورة الإغلاق" : "Closing Image"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{e.assignment_date}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {e.brand_name}
                        {e.brand_code && <div className="text-xs text-muted-foreground">{e.brand_code}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{e.user_name}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.shift_name}</TableCell>
                      <TableCell className="text-right font-mono">{e.opening_balance.toLocaleString()}</TableCell>
                      <TableCell>
                        {e.opening_image_path ? (
                          <button onClick={() => setPreviewImage(e.opening_image_path)}>
                            <img
                              src={e.opening_image_path}
                              alt="opening"
                              className="h-14 w-14 object-cover rounded border hover:ring-2 hover:ring-primary"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> {language === "ar" ? "لا يوجد" : "None"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {e.receiving_coins > 0 ? (
                          <span className="text-green-600 font-semibold">{e.receiving_coins.toLocaleString()}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{e.closing_balance.toLocaleString()}</TableCell>
                      <TableCell>
                        {e.receipt_image_path ? (
                          <button onClick={() => setPreviewImage(e.receipt_image_path)}>
                            <img
                              src={e.receipt_image_path}
                              alt="closing"
                              className="h-14 w-14 object-cover rounded border hover:ring-2 hover:ring-primary"
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" /> {language === "ar" ? "لا يوجد" : "None"}
                          </span>
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

      <Dialog open={!!previewImage} onOpenChange={(o) => !o && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          {previewImage && (
            <img src={previewImage} alt="preview" className="w-full h-auto rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassABalanceImagesReport;
