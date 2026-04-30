import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Download,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500];

type SavedQuery = {
  id: string;
  name: string;
  query: string;
  updated_at: string;
};

export default function SqlQueryRunner() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [query, setQuery] = useState<string>("SELECT now() AS current_time;");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [executedAt, setExecutedAt] = useState<string | null>(null);

  // Saved queries state
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [currentSavedName, setCurrentSavedName] = useState<string | null>(null);

  const isAr = language === "ar";

  const columns = useMemo(() => {
    if (rows.length === 0) return [];
    const cols = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => cols.add(k)));
    return Array.from(cols);
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const fetchSaved = async () => {
    setLoadingSaved(true);
    try {
      const { data, error } = await (supabase as any)
        .from("sql_saved_queries")
        .select("id, name, query, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setSaved((data ?? []) as SavedQuery[]);
    } catch (e: any) {
      toast({
        title: isAr ? "فشل تحميل الاستعلامات المحفوظة" : "Failed to load saved queries",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("run-sql-query", {
        body: { query },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const resultRows: Record<string, unknown>[] = data?.rows ?? [];
      setRows(resultRows);
      setPage(1);
      setExecutedAt(new Date().toLocaleString(isAr ? "ar-EG" : "en-US"));
      toast({
        title: isAr ? "تم تنفيذ الاستعلام" : "Query executed",
        description: isAr
          ? `عدد السجلات: ${resultRows.length}`
          : `${resultRows.length} rows returned`,
      });
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      setRows([]);
      toast({
        title: isAr ? "فشل تنفيذ الاستعلام" : "Query failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openSaveDialog = () => {
    setSaveName(currentSavedName ?? "");
    setSaveOpen(true);
  };

  const saveCurrentQuery = async (mode: "new" | "update") => {
    const name = saveName.trim();
    if (!name) {
      toast({
        title: isAr ? "أدخل اسم الاستعلام" : "Enter a query name",
        variant: "destructive",
      });
      return;
    }
    if (!query.trim()) return;
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error(isAr ? "غير مسجل دخول" : "Not authenticated");

      if (mode === "update" && currentSavedId) {
        const { data, error } = await (supabase as any)
          .from("sql_saved_queries")
          .update({ name, query })
          .eq("id", currentSavedId)
          .select();
        if (error) throw error;
        if (!data || data.length === 0)
          throw new Error(isAr ? "لم يتم تحديث الاستعلام" : "No row updated");
        setCurrentSavedName(name);
      } else {
        const { data, error } = await (supabase as any)
          .from("sql_saved_queries")
          .insert({ user_id: uid, name, query })
          .select()
          .single();
        if (error) throw error;
        setCurrentSavedId(data.id);
        setCurrentSavedName(data.name);
      }

      toast({
        title: isAr ? "تم حفظ الاستعلام" : "Query saved",
        description: name,
      });
      setSaveOpen(false);
      fetchSaved();
    } catch (e: any) {
      toast({
        title: isAr ? "فشل حفظ الاستعلام" : "Failed to save query",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
  };

  const loadSaved = (s: SavedQuery) => {
    setQuery(s.query);
    setCurrentSavedId(s.id);
    setCurrentSavedName(s.name);
    setLoadOpen(false);
    toast({
      title: isAr ? "تم تحميل الاستعلام" : "Query loaded",
      description: s.name,
    });
  };

  const deleteSaved = async (s: SavedQuery) => {
    if (!confirm(isAr ? `حذف "${s.name}"؟` : `Delete "${s.name}"?`)) return;
    try {
      const { error } = await (supabase as any)
        .from("sql_saved_queries")
        .delete()
        .eq("id", s.id);
      if (error) throw error;
      if (currentSavedId === s.id) {
        setCurrentSavedId(null);
        setCurrentSavedName(null);
      }
      fetchSaved();
      toast({ title: isAr ? "تم الحذف" : "Deleted" });
    } catch (e: any) {
      toast({
        title: isAr ? "فشل الحذف" : "Delete failed",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
  };

  const formatCell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const exportExcel = () => {
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => {
        const o: Record<string, unknown> = {};
        for (const c of columns) {
          const v = r[c];
          o[c] = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
        }
        return o;
      }),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Result");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `query_result_${ts}.xlsx`);
  };

  const printResult = () => {
    if (rows.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const tableHtml = `
      <table>
        <thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${columns
                  .map((c) => `<td>${formatCell(r[c]).replace(/</g, "&lt;")}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    `;
    w.document.write(`
      <html>
        <head>
          <title>${isAr ? "نتيجة الاستعلام" : "Query Result"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; direction: ${isAr ? "rtl" : "ltr"}; }
            h2 { margin: 0 0 8px; }
            pre { background: #f5f5f5; padding: 8px; border-radius: 4px; white-space: pre-wrap; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; margin-top: 12px; }
            th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: ${isAr ? "right" : "left"}; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h2>${isAr ? "نتيجة الاستعلام" : "Query Result"}</h2>
          <div>${isAr ? "عدد السجلات" : "Rows"}: ${rows.length} — ${executedAt ?? ""}</div>
          <pre>${query.replace(/</g, "&lt;")}</pre>
          ${tableHtml}
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{isAr ? "تنفيذ استعلامات SQL" : "SQL Query Runner"}</span>
            {currentSavedName && (
              <span className="text-sm font-normal text-muted-foreground">
                {isAr ? "محمل:" : "Loaded:"} <strong>{currentSavedName}</strong>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? "اكتب استعلام SELECT هنا..." : "Write a SELECT query..."}
            className="font-mono text-sm min-h-[160px]"
            dir="ltr"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={runQuery} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isAr ? "تنفيذ" : "Run"}
            </Button>
            <Button variant="outline" onClick={openSaveDialog} disabled={!query.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {isAr ? "حفظ" : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                fetchSaved();
                setLoadOpen(true);
              }}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {isAr ? "تحميل" : "Load"}
            </Button>
            <Button
              variant="outline"
              onClick={exportExcel}
              disabled={rows.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {isAr ? "تصدير Excel" : "Export Excel"}
            </Button>
            <Button
              variant="outline"
              onClick={printResult}
              disabled={rows.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              {isAr ? "طباعة" : "Print"}
            </Button>
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              {rows.length > 0 && (
                <span>
                  {isAr ? "السجلات" : "Rows"}: <strong>{rows.length}</strong>
                </span>
              )}
            </div>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded p-2 whitespace-pre-wrap font-mono">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isAr ? "النتائج" : "Results"}
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {isAr ? "سجلات لكل صفحة" : "Rows per page"}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              {isAr ? "لا توجد بيانات لعرضها" : "No data to display"}
            </div>
          ) : (
            <>
              <div className="overflow-auto border rounded-md max-h-[60vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      {columns.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap font-semibold">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-muted-foreground">
                          {(page - 1) * pageSize + idx + 1}
                        </TableCell>
                        {columns.map((c) => (
                          <TableCell key={c} className="whitespace-nowrap font-mono text-xs">
                            {formatCell(row[c])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="text-muted-foreground">
                  {isAr
                    ? `صفحة ${page} من ${totalPages}`
                    : `Page ${page} of ${totalPages}`}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {isAr ? "السابق" : "Prev"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    {isAr ? "التالي" : "Next"}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "حفظ الاستعلام" : "Save Query"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {isAr ? "اسم الاستعلام" : "Query name"}
            </label>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={isAr ? "مثال: تقرير المبيعات اليومية" : "e.g. Daily sales report"}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            {currentSavedId && (
              <Button variant="secondary" onClick={() => saveCurrentQuery("update")}>
                {isAr ? "تحديث الحالي" : "Update existing"}
              </Button>
            )}
            <Button onClick={() => saveCurrentQuery("new")}>
              {isAr ? "حفظ كجديد" : "Save as new"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load dialog */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-2xl" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isAr ? "الاستعلامات المحفوظة" : "Saved Queries"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {loadingSaved ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : saved.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {isAr ? "لا توجد استعلامات محفوظة" : "No saved queries yet"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                    <TableHead>{isAr ? "آخر تحديث" : "Updated"}</TableHead>
                    <TableHead className="w-32 text-right">
                      {isAr ? "إجراءات" : "Actions"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {saved.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(s.updated_at).toLocaleString(
                          isAr ? "ar-EG" : "en-US",
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" onClick={() => loadSaved(s)}>
                            {isAr ? "تحميل" : "Load"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSaved(s)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadOpen(false)}>
              {isAr ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
