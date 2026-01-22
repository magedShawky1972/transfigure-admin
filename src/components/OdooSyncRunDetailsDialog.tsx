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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw, ShoppingCart, Package } from "lucide-react";

type Supplier = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

export type OdooSyncRunLite = {
  id: string;
  from_date: string;
  to_date: string;
};

type DetailRow = {
  id: string;
  order_number: string;
  order_date?: string | null;
  sync_status: string;
  error_message: string | null;
  step_customer: string | null;
  step_brand: string | null;
  step_product: string | null;
  step_order: string | null;
  step_purchase: string | null;
  product_names: string | null;
  payment_method: string | null;
  payment_brand: string | null;
  total_qty?: number | null;
  vendor_name?: string | null;
  supplier_code?: string | null;
  original_orders?: string[];
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
  const errorMsg = (row.error_message || "").toLowerCase();
  
  // Check the actual error message first - more reliable than step statuses
  const hasOrderError = errorMsg.includes("order:") && !errorMsg.includes("already exists");
  const hasPurchaseError = errorMsg.includes("purchase:") || errorMsg.includes("supplier");
  
  // "already exists" for order means order was sent - focus on purchase
  const orderAlreadyExists = errorMsg.includes("already exists");
  
  // Check step statuses
  const orderFailed = row.step_order === "failed" || row.step_order === "error";
  const purchaseFailed = row.step_purchase === "failed" || row.step_purchase === "error";
  const purchasePending = row.step_purchase === "pending";
  
  // If error says "already exists", order is actually OK - check purchase
  if (orderAlreadyExists) {
    if (purchaseFailed || purchasePending || hasPurchaseError) {
      return "purchase";
    }
    // Order exists and no purchase issue - might be fully synced
    return "none";
  }
  
  // Both failed
  if ((orderFailed || hasOrderError) && (purchaseFailed || hasPurchaseError)) {
    return "both";
  }
  
  // Only order failed
  if (orderFailed || hasOrderError) {
    return "order";
  }
  
  // Only purchase failed/pending
  if (purchaseFailed || purchasePending || hasPurchaseError) {
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, string>>({});
  const [skuProductMap, setSkuProductMap] = useState<Record<string, string>>({});

  const fetchDetails = useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      // Cast to avoid excessively-deep TS instantiation from generated types
      const result: any = await supabase
        .from("odoo_sync_run_details")
        .select(
          "id, order_number, order_date, sync_status, error_message, step_customer, step_brand, step_product, step_order, step_purchase, product_names, payment_method, payment_brand"
        )
        .eq("run_id", run.id)
        .order("created_at", { ascending: true });

      if (result.error) throw result.error;
      
      const detailRows = (result.data || []) as DetailRow[];
      
      // Fetch original orders and payment_method for aggregate order numbers
      const aggregatedPattern = /^\d{12}$/; // Pattern like 202511040001
      const aggregateOrderNumbers = detailRows
        .map(r => r.order_number)
        .filter(on => aggregatedPattern.test(on));
      
      const originalOrdersMap: Record<string, string[]> = {};
      const mappingPaymentMethodMap: Record<string, string> = {};
      
      if (aggregateOrderNumbers.length > 0) {
        // Batch fetch to avoid 1000-row limit
        const batchSize = 50; // Query 50 aggregate orders at a time
        
        for (let i = 0; i < aggregateOrderNumbers.length; i += batchSize) {
          const batch = aggregateOrderNumbers.slice(i, i + batchSize);
          const mappingResult: any = await supabase
            .from("aggregated_order_mapping")
            .select("aggregated_order_number, original_order_number, payment_method")
            .in("aggregated_order_number", batch);
          
          if (mappingResult.data) {
            for (const m of mappingResult.data as { aggregated_order_number: string; original_order_number: string; payment_method: string | null }[]) {
              if (!originalOrdersMap[m.aggregated_order_number]) {
                originalOrdersMap[m.aggregated_order_number] = [];
              }
              originalOrdersMap[m.aggregated_order_number].push(m.original_order_number);
              // Store payment_method from mapping (first one wins)
              if (m.payment_method && !mappingPaymentMethodMap[m.aggregated_order_number]) {
                mappingPaymentMethodMap[m.aggregated_order_number] = m.payment_method;
              }
            }
          }
        }
        
        // Attach original orders and payment_method to rows
        for (const row of detailRows) {
          if (originalOrdersMap[row.order_number]) {
            row.original_orders = originalOrdersMap[row.order_number];
          }
          // Set payment_method from mapping if available
          if (mappingPaymentMethodMap[row.order_number] && !row.payment_method) {
            row.payment_method = mappingPaymentMethodMap[row.order_number];
          }
        }
      }
      
      // For ALL rows, get vendor/supplier/payment/qty info from purpletransaction
      if (detailRows.length > 0) {
        // Build lookup orders: for aggregated orders use original_orders, otherwise use order_number
        const lookupOrderNumbers: string[] = [];
        const aggregateToOriginalMap: Record<string, string[]> = {};
        
        for (const row of detailRows) {
          if (row.original_orders && row.original_orders.length > 0) {
            aggregateToOriginalMap[row.order_number] = row.original_orders;
            lookupOrderNumbers.push(...row.original_orders);
          } else {
            lookupOrderNumbers.push(row.order_number);
          }
        }
        
        const uniqueLookupOrders = [...new Set(lookupOrderNumbers)];
        
        // Get vendor names, payment_method, and qty from purpletransaction
        const txResult: any = await supabase
          .from("purpletransaction")
          .select("order_number, vendor_name, payment_method, qty")
          .in("order_number", uniqueLookupOrders);
        
        if (txResult.data) {
          const vendorMap: Record<string, string> = {};
          const paymentMethodMap: Record<string, string> = {};
          const qtyMap: Record<string, number> = {};

          for (const tx of txResult.data as {
            order_number: string;
            vendor_name: string | null;
            payment_method: string | null;
            qty: number | null;
          }[]) {
            if (tx.vendor_name && !vendorMap[tx.order_number]) {
              vendorMap[tx.order_number] = tx.vendor_name;
            }
            if (tx.payment_method && !paymentMethodMap[tx.order_number]) {
              paymentMethodMap[tx.order_number] = tx.payment_method;
            }
            qtyMap[tx.order_number] = (qtyMap[tx.order_number] || 0) + (tx.qty || 0);
          }

          // Supplier code lookup is optional (vendor_name may be missing)
          const vendorNames = [...new Set(Object.values(vendorMap))];
          let supplierMap: Record<string, string> = {};
          if (vendorNames.length > 0) {
            const supplierResult: any = await supabase
              .from("suppliers")
              .select("supplier_name, supplier_code")
              .in("supplier_name", vendorNames);

            if (supplierResult.data) {
              for (const s of supplierResult.data as { supplier_name: string; supplier_code: string }[]) {
                supplierMap[s.supplier_name] = s.supplier_code;
              }
            }
          }

          // Attach vendor/supplier/payment/qty info to rows (always, even if vendor_name is missing)
          for (const row of detailRows) {
            const originalOrders = aggregateToOriginalMap[row.order_number];
            if (originalOrders && originalOrders.length > 0) {
              const firstOriginal = originalOrders[0];
              const vendorName = vendorMap[firstOriginal];
              if (vendorName) {
                row.vendor_name = vendorName;
                row.supplier_code = supplierMap[vendorName] || null;
              }
              row.payment_method = paymentMethodMap[firstOriginal] || row.payment_method || null;
              row.total_qty = originalOrders.reduce((sum, on) => sum + (qtyMap[on] || 0), 0);
            } else {
              const vendorName = vendorMap[row.order_number];
              if (vendorName) {
                row.vendor_name = vendorName;
                row.supplier_code = supplierMap[vendorName] || null;
              }
              row.payment_method = paymentMethodMap[row.order_number] || row.payment_method || null;
              row.total_qty = qtyMap[row.order_number] || null;
            }
          }
        }
      }
      
      // For orphaned aggregated orders (no mapping, no direct tx match), try to recover data by date
      const orphanedRows = detailRows.filter(row => 
        /^\d{12}$/.test(row.order_number) && 
        !row.original_orders?.length && 
        !row.payment_method && 
        row.order_date
      );
      
      if (orphanedRows.length > 0) {
        // Group by date
        const dateGroups: Record<string, DetailRow[]> = {};
        for (const row of orphanedRows) {
          if (row.order_date) {
            if (!dateGroups[row.order_date]) dateGroups[row.order_date] = [];
            dateGroups[row.order_date].push(row);
          }
        }
        
        // For each date, try to find transactions and match by product names
        for (const [date, rows] of Object.entries(dateGroups)) {
          const txByDate: any = await supabase
            .from("purpletransaction")
            .select("order_number, product_name, payment_method, qty")
            .eq("created_at_date", date)
            .limit(500);
          
          if (txByDate.data && txByDate.data.length > 0) {
            for (const row of rows) {
              // Try to match by product_names field
              if (row.product_names) {
                const rowProducts = row.product_names.split(",").map((p: string) => p.trim().toLowerCase());
                const matchedTxs = txByDate.data.filter((tx: any) => 
                  tx.product_name && rowProducts.some((rp: string) => 
                    tx.product_name.toLowerCase().includes(rp) || rp.includes(tx.product_name.toLowerCase())
                  )
                );
                
                if (matchedTxs.length > 0) {
                  const firstMatch = matchedTxs[0];
                  if (firstMatch.payment_method && !row.payment_method) {
                    row.payment_method = firstMatch.payment_method;
                  }
                  if (!row.total_qty) {
                    row.total_qty = matchedTxs.reduce((sum: number, tx: any) => sum + (tx.qty || 0), 0);
                  }
                }
              }
            }
          }
        }
      }
      
      // Extract SKUs/IDs from error messages and fetch product names.
      // Note: Some products have NULL sku in DB; error messages may still show "SKU: 2135" but that's actually product_id.
      const skuRegex = /SKU:\s*([A-Za-z0-9_-]+)/gi;
      const skuTokens = new Set<string>();
      const numericIds = new Set<string>();

      for (const row of detailRows) {
        if (!row.error_message) continue;
        let match;
        while ((match = skuRegex.exec(row.error_message)) !== null) {
          const token = String(match[1]).trim();
          skuTokens.add(token);
          if (/^\d+$/.test(token)) numericIds.add(token);
        }
      }

      if (skuTokens.size > 0) {
        const tokenArray = Array.from(skuTokens);
        const idArray = Array.from(numericIds);

        const newSkuProductMap: Record<string, string> = {};

        // Lookup by sku
        const skuResult: any = await (supabase as any)
          .from("products")
          .select("sku, product_id, product_name")
          .in("sku", tokenArray);

        if (skuResult.data) {
          for (const p of skuResult.data as { sku: string | null; product_id: number | string; product_name: string }[]) {
            if (p.sku) newSkuProductMap[String(p.sku)] = p.product_name;
          }
        }

        // Lookup numeric tokens by product_id (covers cases where sku is NULL)
        if (idArray.length > 0) {
          const idResult: any = await (supabase as any)
            .from("products")
            .select("sku, product_id, product_name")
            .in("product_id", idArray.map(Number));

          if (idResult.data) {
            for (const p of idResult.data as { sku: string | null; product_id: number | string; product_name: string }[]) {
              newSkuProductMap[String(p.product_id)] = p.product_name;
              if (p.sku) newSkuProductMap[String(p.sku)] = p.product_name;
            }
          }
        }

        setSkuProductMap(newSkuProductMap);
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
    if (open) {
      fetchDetails();
      // Fetch suppliers for dropdown
      supabase
        .from("suppliers")
        .select("id, supplier_code, supplier_name")
        .eq("status", "active")
        .order("supplier_name")
        .then(({ data }) => {
          setSuppliers((data as Supplier[]) || []);
        });
    } else {
      // Reset selected suppliers when dialog closes
      setSelectedSuppliers({});
    }
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
    async (detailId: string, retryType: "all" | "order" | "purchase" = "all", supplierCode?: string) => {
      setRetryingId(`${detailId}_${retryType}`);
      try {
        const { error } = await supabase.functions.invoke("retry-odoo-sync-detail", {
          body: { detailId, retryType, supplierCode },
        });
        if (error) throw error;
        // Clear selected supplier for this row after successful retry
        setSelectedSuppliers(prev => {
          const next = { ...prev };
          delete next[detailId];
          return next;
        });
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
                          {r.payment_method ? (
                            <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-600 border-cyan-500">
                              {r.payment_method}
                            </Badge>
                          ) : isErrored && (
                            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                              {language === "ar" ? "طريقة الدفع: غير متوفر" : "Payment: N/A"}
                            </Badge>
                          )}
                          {r.total_qty != null && r.total_qty > 0 ? (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500">
                              {language === "ar" ? "الكمية" : "Qty"}: {r.total_qty}
                            </Badge>
                          ) : isErrored && (
                            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                              {language === "ar" ? "الكمية: غير متوفر" : "Qty: N/A"}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Original orders for aggregated order numbers */}
                        {r.original_orders && r.original_orders.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">{language === "ar" ? "الطلبات الأصلية" : "Original Orders"}:</span>{" "}
                            <span className="text-primary">{r.original_orders.join(", ")}</span>
                          </div>
                        )}
                        
                        {/* Error message with SKU product name */}
                        {r.error_message && (
                          <div className="text-sm text-red-500 mt-1 break-words">
                            ⚠ {r.error_message.replace(/SKU:\s*([A-Za-z0-9_-]+)/gi, (match, sku) => {
                              const productName = skuProductMap[sku];
                              return productName ? `SKU: ${sku} (${productName})` : match;
                            })}
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
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{language === "ar" ? "كود المورد" : "Supplier Code"}:</span>{" "}
                                {r.supplier_code ? (
                                  <span className="text-green-600">{r.supplier_code}</span>
                                ) : (
                                  <Select
                                    value={selectedSuppliers[r.id] || ""}
                                    onValueChange={(value) => setSelectedSuppliers(prev => ({ ...prev, [r.id]: value }))}
                                  >
                                    <SelectTrigger className="w-[180px] h-8 text-sm border-orange-400">
                                      <SelectValue placeholder={language === "ar" ? "اختر المورد" : "Select Supplier"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.supplier_code}>
                                          {s.supplier_name} ({s.supplier_code})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
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
                              onClick={() => retryDetail(r.id, "purchase", selectedSuppliers[r.id])}
                              disabled={retryingId !== null || (!r.supplier_code && !selectedSuppliers[r.id])}
                              title={!r.supplier_code && !selectedSuppliers[r.id] ? (language === "ar" ? "يرجى اختيار المورد أولاً" : "Please select a supplier first") : ""}
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
                                onClick={() => retryDetail(r.id, "purchase", selectedSuppliers[r.id])}
                                disabled={retryingId !== null || (!r.supplier_code && !selectedSuppliers[r.id])}
                                title={!r.supplier_code && !selectedSuppliers[r.id] ? (language === "ar" ? "يرجى اختيار المورد أولاً" : "Please select a supplier first") : ""}
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
