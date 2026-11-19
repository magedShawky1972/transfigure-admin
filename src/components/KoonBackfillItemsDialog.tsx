import { Fragment, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { canRetryKoonBackfillItem, intToDateIntString, type KoonBackfillItem, type KoonBackfillRun, type KoonBackfillSummary, type KoonEndpointProgress } from "@/lib/koonBackfill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, FileJson, Loader2, RefreshCw, RotateCcw, Search } from "lucide-react";

interface Props {
  run: KoonBackfillRun;
  endpoint: KoonEndpointProgress;
  onClose: () => void;
  onRetryComplete: (summary: KoonBackfillSummary) => void;
}

type ItemStatusFilter = "all" | "pending" | "success" | "failed";
type RetryResponse = KoonBackfillSummary & { retryResult: { success: boolean; status: number; record_key: string } };

const ENDPOINT_LABELS: Record<string, { en: string; ar: string }> = {
  "api-customer": { en: "Customers", ar: "العملاء" },
  "api-brand": { en: "Brands", ar: "العلامات التجارية" },
  "api-product": { en: "Products", ar: "المنتجات" },
  "api-salesheader": { en: "Sales Headers", ar: "رؤوس الطلبات" },
  "api-salesline": { en: "Sales Lines", ar: "بنود الطلبات" },
  "api-payment": { en: "Payments", ar: "المدفوعات" },
};

export function KoonBackfillItemsDialog({ run, endpoint, onClose, onRetryComplete }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { toast } = useToast();
  const [items, setItems] = useState<KoonBackfillItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [bodyItem, setBodyItem] = useState<KoonBackfillItem>();
  const [retryItem, setRetryItem] = useState<KoonBackfillItem>();
  const [retrying, setRetrying] = useState(false);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const endpointLabel = ENDPOINT_LABELS[endpoint.endpoint]?.[language] || endpoint.endpoint;

  const getError = async (error: unknown, fallback: string) => {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      return body?.error || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("koon-backfill", {
        body: { action: "items", runId: run.id, endpoint: endpoint.endpoint, status: statusFilter, search, page, pageSize },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشل تحميل السجلات" : "Failed to load records"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, [run.id, endpoint.endpoint, statusFilter, search, page]);

  const itemStatusBadge = (status: KoonBackfillItem["status"]) => {
    if (status === "success") return <Badge variant="secondary">{isAr ? "تم الإرسال" : "Sent"}</Badge>;
    if (status === "failed") return <Badge variant="destructive">{isAr ? "فشل" : "Failed"}</Badge>;
    if (status === "processing") return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{isAr ? "جارٍ الإرسال" : "Sending"}</Badge>;
    return <Badge variant="outline">{isAr ? "في قائمة الإرسال" : "Queued"}</Badge>;
  };

  const applySearch = () => {
    if (page === 1 && search === searchInput.trim()) {
      loadItems();
      return;
    }
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resend = async () => {
    if (!retryItem || !canRetryKoonBackfillItem(retryItem)) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("koon-backfill", {
        body: { action: "retryItem", runId: run.id, itemId: retryItem.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data as RetryResponse;
      onRetryComplete(result);
      await loadItems();
      toast({
        title: result.retryResult.success ? (isAr ? "تم الإرسال" : "Resent successfully") : (isAr ? "فشل الإرسال" : "Resend failed"),
        description: `${retryItem.record_key} · HTTP ${result.retryResult.status || 502}`,
        variant: result.retryResult.success ? "default" : "destructive",
      });
      setRetryItem(undefined);
    } catch (error) {
      toast({ title: isAr ? "فشلت إعادة الإرسال" : "Resend failed", description: await getError(error, isAr ? "تعذر إعادة إرسال السجل" : "Could not resend this record"), variant: "destructive" });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{endpointLabel} · {isAr ? "تفاصيل السجلات" : "Record Details"}</DialogTitle>
            <DialogDescription>
              {intToDateIntString(run.from_date_int)} – {intToDateIntString(run.to_date_int)} · <span className="font-mono">{endpoint.endpoint}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor="koon-record-search" className="text-sm font-medium">{isAr ? "بحث في الطلب أو البيانات" : "Search order or record data"}</label>
              <div className="flex gap-2">
                <Input id="koon-record-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applySearch(); }} placeholder={isAr ? "رقم الطلب أو مفتاح السجل" : "Order number or record key"} />
                <Button variant="outline" onClick={applySearch}><Search className="h-4 w-4 mr-2" />{isAr ? "بحث" : "Search"}</Button>
              </div>
            </div>
            <div className="w-full lg:w-48 space-y-1">
              <label className="text-sm font-medium">{isAr ? "الحالة" : "Status"}</label>
              <Select value={statusFilter} onValueChange={(value: ItemStatusFilter) => { setPage(1); setStatusFilter(value); }}>
                <SelectTrigger aria-label="Filter records by status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="pending">{isAr ? "في قائمة الإرسال" : "Queued"}</SelectItem>
                  <SelectItem value="success">{isAr ? "تم الإرسال" : "Sent"}</SelectItem>
                  <SelectItem value="failed">{isAr ? "فشل" : "Failed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadItems} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />{isAr ? "تحديث" : "Refresh"}</Button>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            {isAr ? "إعادة الإرسال تخص السجل المحدد فقط. تحقق من KOON قبل إعادة إرسال أي دفعة فاشلة لتجنب التكرار." : "Resend affects only the selected saved record. Verify KOON before resending a failed payment to avoid duplicates."}
          </div>

          {retryItem && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <h3 className="font-semibold">{isAr ? "إعادة إرسال هذا السجل؟" : "Resend this record?"}</h3>
            <p className="text-sm text-muted-foreground">{isAr ? "سيتم إرسال جسم الطلب المحفوظ لهذا السجل فقط. للمدفوعات، تحقق أولاً أن KOON لم يقبل المحاولة السابقة لتجنب التكرار." : "Only this record’s saved request body will be sent again. For payments, first verify KOON did not accept the earlier attempt to avoid duplicates."}</p>
            <p className="font-mono text-sm break-all">{retryItem.record_key}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={retrying} onClick={() => setRetryItem(undefined)}>{isAr ? "إلغاء" : "Cancel"}</Button>
              <Button variant="destructive" disabled={retrying} onClick={resend}>
                {retrying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}{isAr ? "إعادة إرسال" : "Resend"}
              </Button>
            </div>
          </div>}

          {loading ? <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">{isAr ? "لا توجد سجلات مطابقة" : "No matching records"}</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[1000px]">
                <TableHeader><TableRow>
                  <TableHead>{isAr ? "الطلب / السجل" : "Order / Record"}</TableHead>
                  <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isAr ? "المحاولات" : "Attempts"}</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>{isAr ? "نتيجة KOON" : "KOON Response"}</TableHead>
                  <TableHead>{isAr ? "آخر إرسال" : "Last Attempt"}</TableHead>
                  <TableHead>{isAr ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{items.map((item) => (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell className="font-mono text-sm break-all max-w-[240px]">{item.record_key}</TableCell>
                      <TableCell>{itemStatusBadge(item.status)}</TableCell>
                      <TableCell>{item.attempt_count}</TableCell>
                      <TableCell>{item.response_status || "—"}</TableCell>
                      <TableCell className="max-w-[280px]"><p className="truncate" title={item.response_message || ""}>{item.response_message || "—"}</p></TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{item.processed_at ? new Date(item.processed_at).toLocaleString(isAr ? "ar-EG" : "en-GB") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setBodyItem(bodyItem?.id === item.id ? undefined : item)}><FileJson className="h-4 w-4 mr-1" />{bodyItem?.id === item.id ? (isAr ? "إغلاق" : "Close") : (isAr ? "البيانات" : "Body")}</Button>
                          {canRetryKoonBackfillItem(item) && <Button size="sm" variant="destructive" onClick={() => setRetryItem(item)}><RotateCcw className="h-4 w-4 mr-1" />{isAr ? "إعادة إرسال" : "Resend"}</Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                    {bodyItem?.id === item.id && <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="whitespace-normal">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 py-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold mb-2">{isAr ? "جسم الطلب المرسل إلى KOON" : "Request Body Sent to KOON"}</h3>
                            <pre className="rounded-md bg-muted p-4 text-xs whitespace-pre-wrap break-all max-h-72 overflow-auto">{JSON.stringify(item.payload, null, 2)}</pre>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold mb-2">{isAr ? "نتيجة KOON" : "KOON Response"}</h3>
                            <pre className="rounded-md bg-muted p-4 text-xs whitespace-pre-wrap break-all max-h-72 overflow-auto">{item.response_message || (isAr ? "لم يتم الإرسال بعد" : "Not sent yet")}</pre>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>}
                  </Fragment>
                ))}</TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} {isAr ? "سجل" : "records"} · {isAr ? "صفحة" : "Page"} {page} / {pageCount}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4 mr-1" />{isAr ? "السابق" : "Previous"}</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>{isAr ? "التالي" : "Next"}<ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
