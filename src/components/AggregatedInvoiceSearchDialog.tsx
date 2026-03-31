import { useState } from "react";
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

interface AggregatedMapping {
  id: string;
  aggregated_order_number: string;
  original_order_number: string;
  aggregation_date: string;
  brand_name: string | null;
  payment_method: string | null;
  payment_brand: string | null;
  user_name: string | null;
}

export const AggregatedInvoiceSearchDialog = ({ language }: { language: string }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AggregatedMapping[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from("aggregated_order_mapping")
        .select("*")
        .eq("aggregated_order_number", searchValue.trim())
        .order("original_order_number", { ascending: true });

      if (error) throw error;
      setResults(data || []);
      if (!data?.length) {
        toast({
          title: language === "ar" ? "لا توجد نتائج" : "No results",
          description: language === "ar"
            ? "لم يتم العثور على طلبات لهذا الرقم المجمع"
            : "No orders found for this aggregated invoice number",
        });
      }
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

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResults([]); setSearchValue(""); setSearched(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSearch className="h-4 w-4 mr-1" />
          {language === "ar" ? "بحث فاتورة مجمعة" : "Aggregated Invoice"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
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
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {results.length} {language === "ar" ? "طلب" : "order(s)"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "تاريخ التجميع:" : "Aggregation Date:"}{" "}
              <span className="font-medium">{results[0].aggregation_date}</span>
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{language === "ar" ? "رقم الطلب الأصلي" : "Original Order #"}</TableHead>
                <TableHead>{language === "ar" ? "الماركة" : "Brand"}</TableHead>
                <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</TableHead>
                <TableHead>{language === "ar" ? "ماركة الدفع" : "Payment Brand"}</TableHead>
                <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searched && results.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد نتائج" : "No results found"}
                  </TableCell>
                </TableRow>
              ) : (
                results.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono font-medium">{item.original_order_number}</TableCell>
                    <TableCell>{item.brand_name || "-"}</TableCell>
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
