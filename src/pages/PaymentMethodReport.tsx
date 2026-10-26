import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { ArrowLeft, CalendarIcon, Check, ChevronsUpDown, FileDown, RefreshCw } from "lucide-react";
import ExcelJS from "exceljs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customerOrderRange } from "@/lib/customerWithoutOrders";
import { filterPaymentMethodRows, paymentMethodTotals, type PaymentMethodRow } from "@/lib/paymentMethodReport";

const amount = (value: number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (value: number) => { const s = String(value); return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`; };
const headings = ["Date", "Payment Method", "Payment Brand", "Payment Type", "Orders", "Transaction Lines", "Total Amount", "Bank Fee"];

export default function PaymentMethodReport() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<boolean | null>(null);
  const [from, setFrom] = useState(startOfMonth(new Date()));
  const [to, setTo] = useState(new Date());
  const [method, setMethod] = useState("all");
  const [methodOpen, setMethodOpen] = useState(false);
  const [configuredMethods, setConfiguredMethods] = useState<string[]>([]);
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [appliedRange, setAppliedRange] = useState("");

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const [roles, permissions] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
        supabase.from("user_permissions").select("has_access").eq("user_id", user.id).eq("parent_menu", "Reports").eq("menu_item", "payment-method").order("created_at", { ascending: false }).limit(1),
      ]);
      const allowed = (!roles.error && Boolean(roles.data?.length)) || (!permissions.error && permissions.data?.[0]?.has_access === true);
      if (active) setAccess(allowed);
      if (allowed) {
        const methods: string[] = [];
        for (let offset = 0; ; offset += 1000) {
          const result = await supabase.from("payment_methods").select("payment_method").order("id").range(offset, offset + 999);
          if (result.error) throw result.error;
          methods.push(...(result.data || []).map(row => row.payment_method));
          if (!result.data || result.data.length < 1000) break;
        }
        if (active) setConfiguredMethods(methods);
      }
    };
    checkAccess().catch(err => { if (active) { setAccess(value => value ?? false); toast.error(err.message || "Unable to load payment methods"); } });
    return () => { active = false; };
  }, [navigate]);

  const methods = useMemo(() => Array.from(new Set([...configuredMethods, ...rows.map(row => row.payment_method)])).sort(), [configuredMethods, rows]);
  const filtered = useMemo(() => filterPaymentMethodRows(rows, method), [rows, method]);
  const totals = useMemo(() => paymentMethodTotals(filtered), [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / 100));
  const runReport = async () => {
    const range = customerOrderRange.safeParse({ from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") });
    if (!range.success) { toast.error("Select valid dates with From Date before or equal to To Date."); return; }
    setLoading(true); setError(""); setHasRun(false); setRows([]); setPage(0);
    try {
      const result: PaymentMethodRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const response = await supabase.rpc("get_payment_method_report", { p_from_date: range.data.from, p_to_date: range.data.to, p_offset: offset, p_limit: 1000 });
        if (response.error) throw response.error;
        result.push(...(response.data || []));
        if (!response.data || response.data.length < 1000) break;
      }
      setRows(result); setAppliedRange(`${format(from, "dd/MM/yyyy")} — ${format(to, "dd/MM/yyyy")}`); setHasRun(true);
    } catch (err) {
      const message = (err as { message?: string }).message || "Unable to load report";
      setError(message); toast.error(message);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Payment Method");
      sheet.addRow(["Date Range", appliedRange, "Payment Method", method === "all" ? "All Payment Methods" : method]);
      sheet.addRow(headings).font = { bold: true };
      filtered.forEach(row => sheet.addRow([dateText(row.report_date), row.payment_method, row.payment_brand, row.payment_type, Number(row.order_count), Number(row.line_count), Number(row.total_amount), Number(row.bank_fee)]));
      sheet.addRow(["Total", "", "", "", "", totals.lines, totals.amount, totals.fees]).font = { bold: true };
      sheet.columns.forEach(column => { column.width = 24; });
      sheet.getColumn(7).numFmt = "#,##0.00"; sheet.getColumn(8).numFmt = "#,##0.00";
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = "Payment_Method_Report.xlsx"; link.click(); URL.revokeObjectURL(url);
    } catch { toast.error("Export failed"); }
  };

  if (access === null) return <AccessDenied isLoading />;
  if (!access) return <AccessDenied />;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button variant="outline" size="icon" aria-label="Back to Reports" onClick={() => navigate("/reports")}><ArrowLeft className="h-4 w-4" /></Button><h1 className="text-2xl font-bold">Payment Method Report</h1></div>
      <Button variant="outline" onClick={exportExcel} disabled={loading || !filtered.length}><FileDown className="me-2 h-4 w-4" />Export Excel</Button>
    </div>
    <div className="flex flex-wrap items-end gap-4 border-b pb-6">
      {([{ name: "From Date", date: from, change: setFrom }, { name: "To Date", date: to, change: setTo }]).map(field => <div className="space-y-2" key={field.name}>
        <Label>{field.name}</Label><Popover><PopoverTrigger asChild><Button variant="outline" aria-label={field.name} disabled={loading} className="w-44 justify-start font-normal"><CalendarIcon className="me-2 h-4 w-4" />{format(field.date, "dd/MM/yyyy")}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.date} onSelect={date => { if (date) field.change(date); }} initialFocus className="pointer-events-auto" /></PopoverContent></Popover>
      </div>)}
      <div className="space-y-2"><Label>Payment Method</Label><Popover open={methodOpen} onOpenChange={setMethodOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Payment Method" aria-expanded={methodOpen} disabled={loading} className="w-60 justify-between"><span className="truncate">{method === "all" ? "All Payment Methods" : method}</span><ChevronsUpDown className="ms-2 h-4 w-4 shrink-0" /></Button></PopoverTrigger><PopoverContent className="w-60 p-0"><Command><CommandInput placeholder="Search payment methods..." /><CommandList><CommandEmpty>No payment methods found.</CommandEmpty><CommandGroup>{["all", ...methods].map(value => <CommandItem key={value} value={value} onSelect={() => { setMethod(value); setMethodOpen(false); setPage(0); }}><Check className={`me-2 h-4 w-4 ${method === value ? "opacity-100" : "opacity-0"}`} />{value === "all" ? "All Payment Methods" : value}</CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
      <Button onClick={runReport} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{loading ? "Loading..." : "Run Report"}</Button>
    </div>
    {hasRun && <div className="space-y-3"><p className="text-sm text-muted-foreground">{appliedRange}</p><div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Transaction Lines", totals.lines.toLocaleString()], ["Total Amount", amount(totals.amount)], ["Bank Fee", amount(totals.fees)]].map(([label, value]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div></div>}
    <div className="overflow-x-auto rounded-lg border"><Table className="min-w-[1000px]"><TableHeader><TableRow>{headings.map(heading => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>
      {filtered.slice(page * 100, (page + 1) * 100).map(row => <TableRow key={JSON.stringify([row.report_date, row.payment_method, row.payment_brand, row.payment_type])}><TableCell>{dateText(row.report_date)}</TableCell><TableCell>{row.payment_method}</TableCell><TableCell>{row.payment_brand}</TableCell><TableCell>{row.payment_type}</TableCell><TableCell>{Number(row.order_count).toLocaleString()}</TableCell><TableCell>{Number(row.line_count).toLocaleString()}</TableCell><TableCell>{amount(row.total_amount)}</TableCell><TableCell>{amount(row.bank_fee)}</TableCell></TableRow>)}
      {!filtered.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground" role={error ? "alert" : undefined}>{loading ? "Loading..." : error || (hasRun ? "No transactions found" : "—")}</TableCell></TableRow>}
    </TableBody>{hasRun && <TableFooter><TableRow><TableCell colSpan={5}>Total</TableCell><TableCell>{totals.lines.toLocaleString()}</TableCell><TableCell>{amount(totals.amount)}</TableCell><TableCell>{amount(totals.fees)}</TableCell></TableRow></TableFooter>}</Table></div>
    {hasRun && <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-sm text-muted-foreground">{page + 1} / {pages}</span><Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Next</Button></div>}
  </div>;
}