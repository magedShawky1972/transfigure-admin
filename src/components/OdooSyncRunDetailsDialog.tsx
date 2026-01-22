import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, ShoppingCart, Package } from "lucide-react";

export type OdooSyncRunLite = {
  id: string;
  from_date: string;
  to_date: string;
};

type DetailRow = {
  id: string;
  order_number: string;
  sync_status: string;
  error_message: string | null;
  step_customer: string | null;
  step_brand: string | null;
  step_product: string | null;
  step_order: string | null;
  step_purchase: string | null;
  product_names: string | null;
  vendor_name?: string | null;
  supplier_code?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: OdooSyncRunLite | null;
  language: "ar" | "en" | string;
  initialFilter: "failed" | "success";
};

type FailureType = "order" | "purchase" | "both" | "other" | "none";

function detectFailureType(row: DetailRow): FailureType {
  const orderFailed = row.step_order === "failed" || row.step_order === "error";
  const purchaseFailed = row.step_purchase === "failed" || row.step_purchase === "error";
  const purchasePending = row.step_purchase === "pending";
  
  // If order failed, that's the main issue
  if (orderFailed) {
    return purchaseFailed ? "both" : "order";
  }
  
  // If order succeeded but purchase failed or pending with error
  if (purchaseFailed || (purchasePending && row.error_message?.toLowerCase().includes("purchase"))) {
    return "purchase";
  }
  
  // Check other steps
  const customerFailed = row.step_customer === "failed" || row.step_customer === "error";
  const brandFailed = row.step_brand === "failed" || row.step_brand === "error";
  const productFailed = row.step_product === "failed" || row.step_product === "error";
  
  if (customerFailed || brandFailed || productFailed) {
    return "other";
  }
  
  // If sync_status is failed but no specific step failed
  if (["failed", "partial", "error"].includes(row.sync_status)) {
    // Check error message for hints
    if (row.error_message?.toLowerCase().includes("purchase") || row.error_message?.toLowerCase().includes("supplier")) {
      return "purchase";
    }
    if (row.error_message?.toLowerCase().includes("order")) {
      return "order";
    }
    return "other";
  }
  
  return "none";
}

export function OdooSyncRunDetailsDialog({
  open,
  onOpenChange,
  run,
  language,
  initialFilter,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      // Cast to avoid excessively-deep TS instantiation from generated types
      const result: any = await supabase
        .from("odoo_sync_run_details")
        .select(
          "id, order_number, sync_status, error_message, step_customer, step_brand, step_product, step_order, step_purchase, product_names"
        )
        .eq("run_id", run.id)
        .order("created_at", { ascending: true });

      if (result.error) throw result.error;
      
      const detailRows = (result.data || []) as DetailRow[];
      
      // For failed rows, try to get vendor/supplier info from purpletransaction
      const failedRows = detailRows.filter(r => ["failed", "partial", "error"].includes(r.sync_status));
      if (failedRows.length > 0) {
        const orderNumbers = failedRows.map(r => r.order_number);
        
        // Get vendor names from purpletransaction
        const txResult: any = await supabase
          .from("purpletransaction")
          .select("order_number, vendor_name")
          .in("order_number", orderNumbers);
        
        if (txResult.data) {
          const vendorMap: Record<string, string> = {};
          for (const tx of txResult.data as { order_number: string; vendor_name: string | null }[]) {
            if (tx.vendor_name && !vendorMap[tx.order_number]) {
              vendorMap[tx.order_number] = tx.vendor_name;
            }
          }
          
          // Get supplier codes for vendor names
          const vendorNames = [...new Set(Object.values(vendorMap))];
          if (vendorNames.length > 0) {
            const supplierResult: any = await supabase
              .from("suppliers")
              .select("supplier_name, supplier_code")
              .in("supplier_name", vendorNames);
            
            const supplierMap: Record<string, string> = {};
            if (supplierResult.data) {
              for (const s of supplierResult.data as { supplier_name: string; supplier_code: string }[]) {
                supplierMap[s.supplier_name] = s.supplier_code;
              }
            }
            
            // Attach vendor/supplier info to rows
            for (const row of detailRows) {
              const vendorName = vendorMap[row.order_number];
              if (vendorName) {
                row.vendor_name = vendorName;
                row.supplier_code = supplierMap[vendorName] || null;
              }
            }
          }
        }
      }
      
      setRows(detailRows);
    } catch (e) {
      console.error("Error loading run details", e);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar"
            ? "فشل في تحميل تفاصيل الإرسال"
            : "Failed to load run details",
      });
    } finally {
      setLoading(false);
    }
  }, [run, language]);

  useEffect(() => {
    if (open) fetchDetails();
  }, [open, fetchDetails]);

  const computed = useMemo(() => {
    const success = rows.filter((r) => r.sync_status === "success").length;
    const failed = rows.filter((r) => ["failed", "partial", "error"].includes(r.sync_status)).length;
    return { success, failed, total: rows.length };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (initialFilter === "success") return rows.filter((r) => r.sync_status === "success");
    return rows.filter((r) => ["failed", "partial", "error"].includes(r.sync_status));
  }, [rows, initialFilter]);

  const getStatusBadge = (status: string) => {
    if (status === "success") return <Badge className="bg-green-600">{language === "ar" ? "نجاح" : "Success"}</Badge>;
    if (status === "partial") return <Badge className="bg-orange-500">{language === "ar" ? "جزئي" : "Partial"}</Badge>;
    if (status === "failed" || status === "error") return <Badge variant="destructive">{language === "ar" ? "فشل" : "Failed"}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getFailureTypeBadge = (failureType: FailureType) => {
    switch (failureType) {
      case "order":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><ShoppingCart className="h-3 w-3 mr-1" />{language === "ar" ? "أمر بيع" : "Sales Order"}</Badge>;
      case "purchase":
        return <Badge variant="outline" className="text-purple-600 border-purple-600"><Package className="h-3 w-3 mr-1" />{language === "ar" ? "أمر شراء" : "Purchase Order"}</Badge>;
      case "both":
        return <Badge variant="outline" className="text-red-600 border-red-600">{language === "ar" ? "بيع + شراء" : "Sales + Purchase"}</Badge>;
      case "other":
        return <Badge variant="outline">{language === "ar" ? "خطوة أخرى" : "Other Step"}</Badge>;
      default:
        return null;
    }
  };

  const retryDetail = useCallback(
    async (detailId: string, retryType: "all" | "order" | "purchase" = "all") => {
      setRetryingId(`${detailId}_${retryType}`);
      try {
        const { error } = await supabase.functions.invoke("retry-odoo-sync-detail", {
          body: { detailId, retryType },
        });
        if (error) throw error;
        await fetchDetails();
        toast({
          title: language === "ar" ? "تمت إعادة المحاولة" : "Retried",
          description:
            language === "ar"
              ? "تم تحديث حالة السجل"
              : "Record status updated",
        });
      } catch (e) {
        console.error("Retry failed", e);
        toast({
          variant: "destructive",
          title: language === "ar" ? "خطأ" : "Error",
          description:
            language === "ar"
              ? "فشل في إعادة المحاولة"
              : "Failed to retry",
        });
      } finally {
        setRetryingId(null);
      }
    },
    [fetchDetails, language]
  );

  const retryAll = useCallback(async () => {
    const errored = rows.filter((r) => ["failed", "partial", "error"].includes(r.sync_status));
    if (errored.length === 0) return;

    setRetryingId("__all__");
    try {
      let ok = 0;
      let bad = 0;
      for (const r of errored) {
        const failureType = detectFailureType(r);
        // Determine what to retry based on failure type
        let retryType: "all" | "order" | "purchase" = "all";
        if (failureType === "purchase") retryType = "purchase";
        else if (failureType === "order") retryType = "order";
        
        const { error } = await supabase.functions.invoke("retry-odoo-sync-detail", {
          body: { detailId: r.id, retryType },
        });
        if (error) bad++;
        else ok++;
      }
      await fetchDetails();
      toast({
        title: language === "ar" ? "اكتملت إعادة المحاولة" : "Retry Complete",
        description:
          language === "ar" ? `نجح: ${ok}، فشل: ${bad}` : `Success: ${ok}, Failed: ${bad}`,
      });
    } finally {
      setRetryingId(null);
    }
  }, [rows, fetchDetails, language]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {language === "ar" ? "تفاصيل الإرسال" : "Run Details"} — {run?.from_date} → {run?.to_date}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {language === "ar" ? "الإجمالي" : "Total"}: {computed.total} · {language === "ar" ? "نجاح" : "Success"}: {computed.success} · {language === "ar" ? "فشل/جزئي" : "Failed/Partial"}: {computed.failed}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDetails}
              disabled={loading || retryingId !== null}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : language === "ar" ? "تحديث" : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={retryAll}
              disabled={retryingId !== null || rows.every((r) => r.sync_status === "success")}
            >
              {retryingId === "__all__" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {language === "ar" ? "إعادة محاولة الكل" : "Retry All"}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[520px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {language === "ar" ? "لا توجد سجلات" : "No records"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((r) => {
                const isErrored = ["failed", "partial", "error"].includes(r.sync_status);
                const failureType = detectFailureType(r);
                const isPurchaseIssue = failureType === "purchase";
                const isOrderIssue = failureType === "order";
                const isBothIssue = failureType === "both";
                
                return (
                  <div key={r.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.order_number}</span>
                          {getStatusBadge(r.sync_status)}
                          {isErrored && getFailureTypeBadge(failureType)}
                        </div>
                        
                        {/* Error message */}
                        {r.error_message && (
                          <div className="text-sm text-red-500 mt-1 break-words">
                            ⚠ {r.error_message}
                          </div>
                        )}
                        
                        {/* Product names */}
                        {r.product_names && (
                          <div className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">{language === "ar" ? "المنتجات" : "Products"}:</span>{" "}
                            {r.product_names}
                          </div>
                        )}
                        
                        {/* Supplier info for purchase issues */}
                        {isErrored && (isPurchaseIssue || isBothIssue) && (
                          <div className="text-sm mt-2 p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-4 flex-wrap">
                              <span>
                                <span className="font-medium">{language === "ar" ? "المورد" : "Vendor"}:</span>{" "}
                                {r.vendor_name || <span className="text-orange-500">{language === "ar" ? "غير محدد" : "Not set"}</span>}
                              </span>
                              <span>
                                <span className="font-medium">{language === "ar" ? "كود المورد" : "Supplier Code"}:</span>{" "}
                                {r.supplier_code || <span className="text-red-500">{language === "ar" ? "غير موجود" : "Missing"}</span>}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Step status for other failures */}
                        {isErrored && failureType === "other" && (
                          <div className="text-xs text-muted-foreground mt-2">
                            {language === "ar" ? "الخطوات" : "Steps"}: 
                            {" "}{language === "ar" ? "عميل" : "Customer"}: {r.step_customer || "-"} | 
                            {" "}{language === "ar" ? "علامة" : "Brand"}: {r.step_brand || "-"} | 
                            {" "}{language === "ar" ? "منتج" : "Product"}: {r.step_product || "-"} | 
                            {" "}{language === "ar" ? "بيع" : "Order"}: {r.step_order || "-"} | 
                            {" "}{language === "ar" ? "شراء" : "Purchase"}: {r.step_purchase || "-"}
                          </div>
                        )}
                      </div>

                      {/* Retry buttons */}
                      {isErrored && (
                        <div className="flex flex-col gap-1 shrink-0">
                          {/* Show specific retry button based on failure type */}
                          {isPurchaseIssue && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1 text-purple-600"
                              onClick={() => retryDetail(r.id, "purchase")}
                              disabled={retryingId !== null}
                            >
                              {retryingId === `${r.id}_purchase` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Package className="h-3 w-3" />
                              )}
                              {language === "ar" ? "إعادة الشراء" : "Retry Purchase"}
                            </Button>
                          )}
                          
                          {isOrderIssue && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1 text-blue-600"
                              onClick={() => retryDetail(r.id, "order")}
                              disabled={retryingId !== null}
                            >
                              {retryingId === `${r.id}_order` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ShoppingCart className="h-3 w-3" />
                              )}
                              {language === "ar" ? "إعادة البيع" : "Retry Sales"}
                            </Button>
                          )}
                          
                          {isBothIssue && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-1 text-blue-600"
                                onClick={() => retryDetail(r.id, "order")}
                                disabled={retryingId !== null}
                              >
                                {retryingId === `${r.id}_order` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShoppingCart className="h-3 w-3" />
                                )}
                                {language === "ar" ? "إعادة البيع" : "Retry Sales"}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-1 text-purple-600"
                                onClick={() => retryDetail(r.id, "purchase")}
                                disabled={retryingId !== null}
                              >
                                {retryingId === `${r.id}_purchase` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Package className="h-3 w-3" />
                                )}
                                {language === "ar" ? "إعادة الشراء" : "Retry Purchase"}
                              </Button>
                            </>
                          )}
                          
                          {/* Fallback retry all for other failures */}
                          {failureType === "other" && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1"
                              onClick={() => retryDetail(r.id, "all")}
                              disabled={retryingId !== null}
                            >
                              {retryingId === `${r.id}_all` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              {language === "ar" ? "إعادة المحاولة" : "Retry All"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
