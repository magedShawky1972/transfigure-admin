import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface AggregatedOrderMapping {
  id: string;
  aggregated_order_number: string;
  original_order_number: string;
  aggregation_date: string;
  brand_name: string | null;
  payment_brand: string | null;
  payment_method: string | null;
  user_name: string | null;
  created_at: string;
}

interface GroupedOrder {
  aggregated_order_number: string;
  aggregation_date: string;
  original_orders: AggregatedOrderMapping[];
  total_count: number;
}

export default function AggregatedOrderReport() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<AggregatedOrderMapping[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  const fetchMappings = async () => {
    if (!fromDate || !toDate) {
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى تحديد التواريخ" : "Please select dates",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("aggregated_order_mapping")
        .select("*")
        .gte("aggregation_date", fromDate)
        .lte("aggregation_date", toDate)
        .order("aggregation_date", { ascending: false })
        .order("aggregated_order_number", { ascending: true });

      if (error) throw error;

      setMappings(data || []);

      // Group by aggregated_order_number
      const grouped = (data || []).reduce((acc: Record<string, GroupedOrder>, item) => {
        if (!acc[item.aggregated_order_number]) {
          acc[item.aggregated_order_number] = {
            aggregated_order_number: item.aggregated_order_number,
            aggregation_date: item.aggregation_date,
            original_orders: [],
            total_count: 0,
          };
        }
        acc[item.aggregated_order_number].original_orders.push(item);
        acc[item.aggregated_order_number].total_count++;
        return acc;
      }, {});

      setGroupedOrders(Object.values(grouped).sort((a, b) => 
        b.aggregation_date.localeCompare(a.aggregation_date) || 
        a.aggregated_order_number.localeCompare(b.aggregated_order_number)
      ));
    } catch (error) {
      console.error("Error fetching mappings:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في تحميل البيانات" : "Failed to load data",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredGroupedOrders = groupedOrders.filter((group) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      group.aggregated_order_number.toLowerCase().includes(search) ||
      group.original_orders.some((o) =>
        o.original_order_number.toLowerCase().includes(search) ||
        o.brand_name?.toLowerCase().includes(search) ||
        o.payment_brand?.toLowerCase().includes(search)
      )
    );
  });

  const filteredMappings = mappings.filter((m) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      m.aggregated_order_number.toLowerCase().includes(search) ||
      m.original_order_number.toLowerCase().includes(search) ||
      m.brand_name?.toLowerCase().includes(search) ||
      m.payment_brand?.toLowerCase().includes(search)
    );
  });

  const exportToExcel = () => {
    const exportData = mappings.map((m) => ({
      [language === "ar" ? "رقم الطلب المجمع" : "Aggregated Order"]: m.aggregated_order_number,
      [language === "ar" ? "رقم الطلب الأصلي" : "Original Order"]: m.original_order_number,
      [language === "ar" ? "تاريخ التجميع" : "Aggregation Date"]: m.aggregation_date,
      [language === "ar" ? "البراند" : "Brand"]: m.brand_name || "",
      [language === "ar" ? "طريقة الدفع" : "Payment Method"]: m.payment_method || "",
      [language === "ar" ? "مزود الدفع" : "Payment Brand"]: m.payment_brand || "",
      [language === "ar" ? "المستخدم" : "User"]: m.user_name || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aggregated Orders");
    XLSX.writeFile(wb, `aggregated_orders_${fromDate}_${toDate}.xlsx`);

    toast({
      title: language === "ar" ? "تم التصدير" : "Exported",
      description: language === "ar" ? "تم تصدير البيانات بنجاح" : "Data exported successfully",
    });
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {language === "ar" ? "تقرير مطابقة الطلبات المجمعة" : "Aggregated Order Mapping Report"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "بحث" : "Search"}</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث..." : "Search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <Label>{language === "ar" ? "طريقة العرض" : "View Mode"}</Label>
              <Select value={viewMode} onValueChange={(v: "grouped" | "flat") => setViewMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">
                    {language === "ar" ? "مجمع" : "Grouped"}
                  </SelectItem>
                  <SelectItem value="flat">
                    {language === "ar" ? "مفصل" : "Flat"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchMappings} disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2">{language === "ar" ? "عرض" : "Search"}</span>
              </Button>
              <Button
                variant="outline"
                onClick={exportToExcel}
                disabled={mappings.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary */}
          {mappings.length > 0 && (
            <div className="flex flex-wrap gap-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {language === "ar" ? "إجمالي الطلبات المجمعة: " : "Total Aggregated Orders: "}
                {groupedOrders.length}
              </Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {language === "ar" ? "إجمالي الطلبات الأصلية: " : "Total Original Orders: "}
                {mappings.length}
              </Badge>
            </div>
          )}

          {/* Results */}
          <ScrollArea className="h-[600px]">
            {viewMode === "grouped" ? (
              <div className="space-y-4">
                {filteredGroupedOrders.map((group) => (
                  <Card key={group.aggregated_order_number} className="border">
                    <CardHeader className="py-3 bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="default" className="font-mono">
                            {group.aggregated_order_number}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {group.aggregation_date}
                          </span>
                        </div>
                        <Badge variant="outline">
                          {group.total_count} {language === "ar" ? "طلب" : "orders"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === "ar" ? "رقم الطلب الأصلي" : "Original Order"}</TableHead>
                            <TableHead>{language === "ar" ? "البراند" : "Brand"}</TableHead>
                            <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</TableHead>
                            <TableHead>{language === "ar" ? "مزود الدفع" : "Payment Brand"}</TableHead>
                            <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.original_orders.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono">{order.original_order_number}</TableCell>
                              <TableCell>{order.brand_name || "-"}</TableCell>
                              <TableCell>{order.payment_method || "-"}</TableCell>
                              <TableCell>{order.payment_brand || "-"}</TableCell>
                              <TableCell>{order.user_name || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "رقم الطلب المجمع" : "Aggregated Order"}</TableHead>
                    <TableHead>{language === "ar" ? "رقم الطلب الأصلي" : "Original Order"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ التجميع" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "البراند" : "Brand"}</TableHead>
                    <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment"}</TableHead>
                    <TableHead>{language === "ar" ? "مزود الدفع" : "Payment Brand"}</TableHead>
                    <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.aggregated_order_number}</TableCell>
                      <TableCell className="font-mono">{m.original_order_number}</TableCell>
                      <TableCell>{m.aggregation_date}</TableCell>
                      <TableCell>{m.brand_name || "-"}</TableCell>
                      <TableCell>{m.payment_method || "-"}</TableCell>
                      <TableCell>{m.payment_brand || "-"}</TableCell>
                      <TableCell>{m.user_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!loading && mappings.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {language === "ar"
                  ? "لا توجد بيانات. يرجى تحديد التواريخ والبحث"
                  : "No data. Please select dates and search"}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
