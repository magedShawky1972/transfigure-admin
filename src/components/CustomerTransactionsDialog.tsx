import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  order_number: string;
  created_at_date: string;
  brand_name: string;
  product_name: string;
  qty: number;
  total: number;
  payment_method: string;
  payment_type: string;
  order_status: string;
}

interface CustomerTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone: string | null;
  customerName: string | null;
}

export const CustomerTransactionsDialog = ({
  open,
  onOpenChange,
  customerPhone,
  customerName,
}: CustomerTransactionsDialogProps) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<keyof Transaction | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Filter state
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  useEffect(() => {
    if (open && customerPhone) {
      fetchTransactions();
    }
  }, [open, customerPhone]);

  const fetchTransactions = async () => {
    if (!customerPhone) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("purpletransaction")
        .select("*")
        .eq("customer_phone", customerPhone)
        .order("created_at_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get unique brands and products for filters
  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(transactions.map(t => t.brand_name).filter(Boolean)));
    return uniqueBrands.sort();
  }, [transactions]);

  const products = useMemo(() => {
    const uniqueProducts = Array.from(new Set(transactions.map(t => t.product_name).filter(Boolean)));
    return uniqueProducts.sort();
  }, [transactions]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply date filter
    if (dateFrom) {
      filtered = filtered.filter(t => {
        if (!t.created_at_date) return false;
        const transDate = new Date(t.created_at_date);
        return transDate >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter(t => {
        if (!t.created_at_date) return false;
        const transDate = new Date(t.created_at_date);
        return transDate <= dateTo;
      });
    }

    // Apply brand filter
    if (selectedBrand !== "all") {
      filtered = filtered.filter(t => t.brand_name === selectedBrand);
    }

    // Apply product filter
    if (selectedProduct !== "all") {
      filtered = filtered.filter(t => t.product_name === selectedProduct);
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = a[sortColumn] as string;
        let bVal: string | number = b[sortColumn] as string;

        // Handle numeric values (total, qty)
        if (sortColumn === "total") {
          aVal = parseFloat(String(aVal)?.replace(/[^0-9.-]/g, "") || "0");
          bVal = parseFloat(String(bVal)?.replace(/[^0-9.-]/g, "") || "0");
        } else if (sortColumn === "qty") {
          aVal = parseFloat(String(aVal) || "0");
          bVal = parseFloat(String(bVal) || "0");
        } else if (sortColumn === "created_at_date") {
          aVal = new Date(String(aVal)).getTime();
          bVal = new Date(String(bVal)).getTime();
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [transactions, dateFrom, dateTo, selectedBrand, selectedProduct, sortColumn, sortDirection]);

  const handleSort = (column: keyof Transaction) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof Transaction }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  const formatCurrency = (amount: number | null | undefined) => {
    const num = amount || 0;
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getTotalAmount = () => {
    return filteredAndSortedTransactions.reduce((sum, t) => {
      return sum + (t.total || 0);
    }, 0);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedBrand("all");
    setSelectedProduct("all");
    setSortColumn(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {loading && <LoadingOverlay progress={50} message="Loading transactions..." />}
        
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {t("customerSetup.customerTransactions")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View all transactions for this customer
          </DialogDescription>
          <div className="flex items-center gap-4 pt-2">
            <div>
              <span className="text-sm text-muted-foreground">{t("customerSetup.name")}: </span>
              <span className="font-semibold">{customerName}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">{t("customerSetup.phone")}: </span>
              <span className="font-mono font-semibold">{customerPhone}</span>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {filteredAndSortedTransactions.length} {t("dashboard.transactions")}
            </Badge>
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pb-3 border-b">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM dd, yyyy") : t("dashboard.from")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !dateTo && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM dd, yyyy") : t("dashboard.to")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger>
              <SelectValue placeholder={t("customerSetup.filterByBrand")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger>
              <SelectValue placeholder={t("customerSetup.filterByProduct")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {products.map((product) => (
                <SelectItem key={product} value={product}>
                  {product}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={clearFilters}>
            {t("common.clearFilters") || "Clear Filters"}
          </Button>
        </div>

        <div dir={language === "ar" ? "rtl" : "ltr"} className="flex-1 overflow-auto border rounded-md">
          <Table className="min-w-[1100px]">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[140px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("order_number")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.orderNumber") || t("dashboard.orderNumber")}
                    <SortIcon column="order_number" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("created_at_date")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.date") || t("dashboard.date")}
                    <SortIcon column="created_at_date" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("brand_name")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.brand")}
                    <SortIcon column="brand_name" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[150px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("product_name")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.product")}
                    <SortIcon column="product_name" />
                  </Button>
                </TableHead>
                <TableHead className="text-center min-w-[100px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("qty")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.quantity") || t("dashboard.quantity")}
                    <SortIcon column="qty" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("order_status")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.status") || t("dashboard.status")}
                    <SortIcon column="order_status" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("payment_method")}
                    className="h-8 p-0 hover-bg-transparent"
                  >
                    {t("customerSetup.paymentMethod") || t("dashboard.paymentMethod")}
                    <SortIcon column="payment_method" />
                  </Button>
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("payment_type")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.paymentType") || t("transactions.paymentType")}
                    <SortIcon column="payment_type" />
                  </Button>
                </TableHead>
                <TableHead className="text-right min-w-[120px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("total")}
                    className="h-8 p-0 hover:bg-transparent"
                  >
                    {t("customerSetup.total") || t("dashboard.total")}
                    <SortIcon column="total" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {loading ? t("common.loading") || "Loading..." : t("customerSetup.noTransactions") || "No transactions found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-mono text-sm">
                      {transaction.order_number || "-"}
                    </TableCell>
                    <TableCell>
                      {transaction.created_at_date
                        ? format(new Date(transaction.created_at_date), "MMM dd, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>{transaction.brand_name || "-"}</TableCell>
                    <TableCell>{transaction.product_name || "-"}</TableCell>
                    <TableCell className="text-center">{transaction.qty || "-"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={transaction.order_status === "completed" ? "default" : "secondary"}
                      >
                        {transaction.order_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.payment_method || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.payment_type || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filteredAndSortedTransactions.length > 0 && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredAndSortedTransactions.length}</span>
              {" "}
              <span>{t("customerSetup.totalTransactionsCount")}</span>
            </div>
            <div className="text-right">
              <span className="text-sm text-muted-foreground mr-2">
                {t("customerSetup.totalAmount")}:
              </span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(getTotalAmount())}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
