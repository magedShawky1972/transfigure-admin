import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileSearch, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OrderDetail {
  original_order_number: string;
  aggregation_date: string;
  brand_name: string | null;
  product_name: string | null;
  qty: number;
  total: number;
  payment_method: string | null;
  payment_brand: string | null;
  user_name: string | null;
}

export const AggregatedInvoiceSearchDialog = ({ language }: { language: string }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OrderDetail[]>([]);
  const [searched, setSearched] = useState(false);
  const [aggregationDate, setAggregationDate] = useState<string>("");

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      // Step 1: Get mapping records
      const { data: mappings, error: mapError } = await supabase
        .from("aggregated_order_mapping")
        .select("original_order_number, aggregation_date, brand_name, payment_method, payment_brand, user_name")
        .eq("aggregated_order_number", searchValue.trim());

      if (mapError) throw mapError;

      if (!mappings?.length) {
        setResults([]);
        setAggregationDate("");
        toast({
          title: language === "ar" ? "لا توجد نتائج" : "No results",
          description: language === "ar"
            ? "لم يتم العثور على طلبات لهذا الرقم المجمع"
            : "No orders found for this aggregated invoice number",
        });
        setLoading(false);
        return;
      }

      setAggregationDate(mappings[0].aggregation_date);

      // Step 2: Get transaction details for each original order
      const orderNumbers = [...new Set(mappings.map(m => m.original_order_number))];
      const { data: txns, error: txnError } = await supabase
        .from("purpletransaction")
        .select("order_number, product_name, qty, total, brand_name, payment_method, payment_brand, user_name")
        .in("order_number", orderNumbers);

      if (txnError) throw txnError;

      // Merge: use transaction data for product/qty/total, fallback to mapping
      const details: OrderDetail[] = [];
      if (txns?.length) {
        txns.forEach(tx => {
          details.push({
            original_order_number: tx.order_number,
            aggregation_date: mappings[0].aggregation_date,
            brand_name: tx.brand_name,
            product_name: tx.product_name,
            qty: tx.qty || 0,
            total: tx.total || 0,
            payment_method: tx.payment_method,
            payment_brand: tx.payment_brand,
            user_name: tx.user_name,
          });
        });
      } else {
        // Fallback if no transactions found
        mappings.forEach(m => {
          details.push({
            original_order_number: m.original_order_number,
            aggregation_date: m.aggregation_date,
            brand_name: m.brand_name,
            product_name: null,
            qty: 0,
            total: 0,
            payment_method: m.payment_method,
            payment_brand: m.payment_brand,
            user_name: m.user_name,
          });
        });
      }

      details.sort((a, b) => a.original_order_number.localeCompare(b.original_order_number));
      setResults(details);
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const grandTotal = useMemo(() => results.reduce((sum, r) => sum + (r.total || 0), 0), [results]);
  const totalQty = useMemo(() => results.reduce((sum, r) => sum + (r.qty || 0), 0), [results]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResults([]); setSearchValue(""); setSearched(false); setAggregationDate(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSearch className="h-4 w-4 mr-1" />
          {language === "ar" ? "بحث فاتورة مجمعة" : "Aggregated Invoice"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {language === "ar" ? "بحث برقم الفاتورة المجمعة" : "Search by Aggregated Invoice Number"}
          </DialogTitle>
          <DialogDescription>
            {language === "ar"
              ? "أدخل رقم الفاتورة المجمعة لعرض تفاصيل الطلبات"
              : "Enter the aggregated invoice number to view order details"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder={language === "ar" ? "رقم الفاتورة المجمعة..." : "Aggregated invoice number..."}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading || !searchValue.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            {language === "ar" ? "بحث" : "Search"}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary">
              {results.length} {language === "ar" ? "سطر" : "line(s)"}
            </Badge>
            {aggregationDate && (
              <span className="text-sm text-muted-foreground">
                {language === "ar" ? "تاريخ التجميع:" : "Aggregation Date:"}{" "}
                <span className="font-medium">{aggregationDate}</span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {language === "ar" ? "إجمالي الكمية:" : "Total Qty:"}{" "}
                <span className="font-bold text-foreground">{totalQty}</span>
              </span>
              <span className="text-muted-foreground">
                {language === "ar" ? "الإجمالي:" : "Grand Total:"}{" "}
                <span className="font-bold text-primary">{formatCurrency(grandTotal)}</span>
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{language === "ar" ? "رقم الطلب الأصلي" : "Original Order #"}</TableHead>
                <TableHead>{language === "ar" ? "الماركة" : "Brand"}</TableHead>
                <TableHead>{language === "ar" ? "المنتج" : "Product"}</TableHead>
                <TableHead className="text-center">{language === "ar" ? "الكمية" : "Qty"}</TableHead>
                <TableHead className="text-right">{language === "ar" ? "الإجمالي" : "Total"}</TableHead>
                <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</TableHead>
                <TableHead>{language === "ar" ? "ماركة الدفع" : "Payment Brand"}</TableHead>
                <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searched && results.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد نتائج" : "No results found"}
                  </TableCell>
                </TableRow>
              ) : (
                results.map((item, idx) => (
                  <TableRow key={`${item.original_order_number}-${idx}`}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono font-medium">{item.original_order_number}</TableCell>
                    <TableCell>{item.brand_name || "-"}</TableCell>
                    <TableCell>{item.product_name || "-"}</TableCell>
                    <TableCell className="text-center">{item.qty || "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.payment_method || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.payment_brand || "-"}</Badge>
                    </TableCell>
                    <TableCell>{item.user_name || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
