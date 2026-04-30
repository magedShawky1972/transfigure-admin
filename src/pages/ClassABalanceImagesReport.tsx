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
  brand_name: string;
  brand_code: string | null;
  opening_balance: number;
  closing_balance: number;
  opening_image_path: string | null;
  receipt_image_path: string | null;
  user_name: string;
  shift_name: string;
  assignment_date: string;
  opened_at: string | null;
  closed_at: string | null;
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
        .select("id, assignment_date, shifts ( shift_name )")
        .gte("assignment_date", startDate)
        .lte("assignment_date", endDate);

      const assignmentIds = assignments?.map((a) => a.id) || [];
      const assignmentMap = new Map(assignments?.map((a) => [a.id, a]) || []);

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

      // Build prior closing-balance lookup: for each brand, find the most recently CLOSED shift
      // whose closed_at is before this session's opened_at.
      const brandIdsInResults = [...new Set((balances || []).map((b) => b.brand_id))];

      const { data: priorBalances } = await supabase
        .from("shift_brand_balances")
        .select("brand_id, closing_balance, receipt_image_path, shift_sessions!inner(opened_at, closed_at)")
        .in("brand_id", brandIdsInResults.length ? brandIdsInResults : ["00000000-0000-0000-0000-000000000000"])
        .not("shift_sessions.closed_at", "is", null);

      // Group prior balances by brand, sorted by closed_at desc
      const priorByBrand = new Map<string, { closed_at: string; closing_balance: number }[]>();
      (priorBalances || []).forEach((p: any) => {
        const closedAt = p.shift_sessions?.closed_at;
        if (!closedAt) return;
        const arr = priorByBrand.get(p.brand_id) || [];
        arr.push({
          closed_at: closedAt,
          closing_balance: Number(p.closing_balance || 0),
        });
        priorByBrand.set(p.brand_id, arr);
      });
      priorByBrand.forEach((arr) => arr.sort((a, b) => b.closed_at.localeCompare(a.closed_at)));

      const findPriorClosing = (brandId: string, openedAt: string | null): number => {
        if (!openedAt) return 0;
        const arr = priorByBrand.get(brandId) || [];
        const prior = arr.find((p) => p.closed_at < openedAt);
        return prior ? prior.closing_balance : 0;
      };

      let combined: ImageEntry[] = (balances || []).map((b) => {
        const s: any = sessionMap.get(b.shift_session_id);
        const a: any = s ? assignmentMap.get(s.shift_assignment_id) : null;
        const brand: any = brandMap.get(b.brand_id);
        return {
          id: b.id,
          brand_name: brand?.brand_name || "Unknown",
          brand_code: brand?.brand_code || null,
          opening_balance: findPriorClosing(b.brand_id, s?.opened_at || null),
          closing_balance: Number(b.closing_balance || 0),
          opening_image_path: b.opening_image_path,
          receipt_image_path: b.receipt_image_path,
          user_name: profileMap.get(s?.user_id) || "Unknown",
          shift_name: a?.shifts?.shift_name || "",
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
