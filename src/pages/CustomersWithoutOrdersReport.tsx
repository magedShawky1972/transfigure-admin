import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import ExcelJS from "exceljs";
import { ArrowLeft, ChevronDown, ChevronUp, FileDown, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccessDenied } from "@/components/AccessDenied";
import { customerOrderRange, sortByRegistrationDate, type RegistrationSort } from "@/lib/customerWithoutOrders";
import type { Database } from "@/integrations/supabase/types";

type Customer = Database["public"]["Functions"]["get_customers_without_orders"]["Returns"][number];
const PAGE_SIZE = 100;

export default function CustomersWithoutOrdersReport() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const navigate = useNavigate();
  const [access, setAccess] = useState<boolean | null>(null);
  const [fromDate, setFromDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [regSort, setRegSort] = useState<RegistrationSort>("asc");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const [{ data: roles, error: roleError }, { data: permissions, error: permissionError }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
        supabase.from("user_permissions").select("has_access").eq("user_id", user.id)
          .eq("parent_menu", "Reports").eq("menu_item", "customers-without-orders")
          .order("created_at", { ascending: false }).limit(1),
      ]);
      if (active) setAccess(!roleError && Boolean(roles?.length) || !permissionError && permissions?.[0]?.has_access === true);
    };
    check().catch(() => { if (active) setAccess(false); });
    return () => { active = false; };
  }, [navigate]);

  const runReport = async () => {
    const range = customerOrderRange.safeParse({ from: fromDate, to: toDate });
    if (!range.success) {
      toast.error(ar ? "اختر نطاق تاريخ صحيح" : "Select valid dates with From Date before or equal to To Date.");
      return;
    }
    setLoading(true); setError(""); setRows([]); setHasRun(false); setAppliedRange(null); setPage(0);
    try {
      const result: Customer[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error: queryError } = await supabase.rpc("get_customers_without_orders", {
          p_from_date: range.data.from, p_to_date: range.data.to, p_offset: offset, p_limit: 1000,
        });
        if (queryError) throw queryError;
        result.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      setRows(result); setAppliedRange({ from: fromDate, to: toDate }); setHasRun(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as { message?: string }).message || "Failed to load report";
      setError(message); toast.error(message);
    } finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matched = rows.filter(row => !query || [row.customer_name, row.customer_phone, row.email, row.customer_group]
      .some(value => value?.toLowerCase().includes(query)));
    return sortByRegistrationDate(matched, regSort);
  }, [rows, search, regSort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const dateText = (value: string | null) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  };
  const headings = ar
    ? ["اسم العميل", "الهاتف", "البريد الإلكتروني", "مجموعة العميل", "تاريخ التسجيل", "آخر طلب"]
    : ["Customer Name", "Phone", "Email", "Customer Group", "Registration Date", "Last Order"];

  const exportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Customers Without Orders");
      sheet.addRow(["From Date", appliedRange?.from, "To Date", appliedRange?.to]);
      sheet.addRow(headings).font = { bold: true };
      filtered.forEach(row => sheet.addRow([row.customer_name, row.customer_phone, row.email,
        row.customer_group, dateText(row.creation_date), dateText(row.last_order_date)]));
      sheet.columns.forEach(col => { col.width = 24; });
      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url; link.download = `Customers_Without_Orders_${appliedRange?.from}_${appliedRange?.to}.xlsx`;
      link.click(); URL.revokeObjectURL(url);
    } catch { toast.error(ar ? "فشل التصدير" : "Export failed"); }
  };

  if (access === null) return <AccessDenied isLoading />;
  if (!access) return <AccessDenied />;

  return <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" aria-label="Back to Reports" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{ar ? "تقرير العملاء بدون طلبات" : "Customers Without Orders Report"}</h1>
      </div>
      <Button onClick={exportExcel} disabled={loading || !filtered.length}><FileDown className="h-4 w-4 me-2" />{ar ? "تصدير Excel" : "Export Excel"}</Button>
    </div>
    <div className="flex flex-wrap items-end gap-4 border-b pb-6">
      <div className="space-y-2"><Label htmlFor="customers-from">{ar ? "من تاريخ" : "From Date"}</Label><Input id="customers-from" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} disabled={loading} /></div>
      <div className="space-y-2"><Label htmlFor="customers-to">{ar ? "إلى تاريخ" : "To Date"}</Label><Input id="customers-to" type="date" value={toDate} onChange={event => setToDate(event.target.value)} disabled={loading} /></div>
      <Button onClick={runReport} disabled={loading}><RefreshCw className={`h-4 w-4 me-2 ${loading ? "animate-spin" : ""}`} />{loading ? (ar ? "جاري التحميل..." : "Loading...") : (ar ? "عرض التقرير" : "Run Report")}</Button>
    </div>
    {hasRun && <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-muted-foreground text-sm">{ar ? "العملاء بدون طلبات" : "Customers Without Orders"}</p><p className="text-2xl font-bold">{filtered.length.toLocaleString()}</p><p className="text-sm text-muted-foreground">{appliedRange?.from} — {appliedRange?.to}</p></div>
      <div className="relative w-full sm:w-80"><Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search customers" className="ps-9" placeholder={ar ? "البحث عن عميل..." : "Search name, phone or email..."} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></div>
    </div>}
    <div className="rounded-lg border overflow-x-auto">
      <Table className="min-w-[900px]"><TableHeader><TableRow>{headings.map((heading, index) => <TableHead key={heading} aria-sort={index === 4 ? (regSort === "asc" ? "ascending" : "descending") : undefined}>
        {index === 4 ? <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => { setRegSort(value => value === "asc" ? "desc" : "asc"); setPage(0); }}>{heading}{regSort === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button> : heading}
      </TableHead>)}</TableRow></TableHeader>
        <TableBody>{visibleRows.map(row => <TableRow key={row.id}>
          <TableCell className="font-medium">{row.customer_name || "—"}</TableCell><TableCell dir="ltr">{row.customer_phone || "—"}</TableCell>
          <TableCell>{row.email || "—"}</TableCell><TableCell>{row.customer_group || "—"}</TableCell>
          <TableCell>{dateText(row.creation_date)}</TableCell><TableCell>{row.last_order_date ? dateText(row.last_order_date) : (ar ? "لا توجد طلبات" : "Never ordered")}</TableCell>
        </TableRow>)}{!visibleRows.length && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground" role={error ? "alert" : undefined}>
          {loading ? (ar ? "جاري التحميل..." : "Loading...") : error || (hasRun ? (ar ? "لا توجد نتائج" : "No customers found") : (ar ? "اختر التواريخ لعرض التقرير" : "Select dates and run the report"))}
        </TableCell></TableRow>}</TableBody>
      </Table>
    </div>
    {hasRun && <div className="flex items-center justify-end gap-3">
      <Button variant="outline" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{ar ? "السابق" : "Previous"}</Button>
      <span className="text-sm text-muted-foreground">{page + 1} / {pageCount}</span>
      <Button variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage(value => value + 1)}>{ar ? "التالي" : "Next"}</Button>
    </div>}
  </div>;
}