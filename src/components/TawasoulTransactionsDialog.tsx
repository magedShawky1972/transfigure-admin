import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  order_number: string;
  created_at_date: string;
  brand_name: string;
  product_name: string;
  qty: number;
  total: number;
  payment_method: string;
  order_status: string;
}

interface TawasoulTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone: string;
  customerName: string | null;
}

export const TawasoulTransactionsDialog = ({
  open,
  onOpenChange,
  customerPhone,
  customerName,
}: TawasoulTransactionsDialogProps) => {
  const { language } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [dayFilter, setDayFilter] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (open && customerPhone) {
      fetchTransactions();
    }
  }, [open, customerPhone, dayFilter]);

  const fetchTransactions = async () => {
    if (!customerPhone) return;
    
    setLoading(true);
    try {
      // Calculate date range based on day filter
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - dayFilter);
      fromDate.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("purpletransaction")
        .select("id, order_number, created_at_date, brand_name, product_name, qty, total, payment_method, order_status")
        .eq("customer_phone", customerPhone)
        .gte("created_at_date", fromDate.toISOString())
        .lte("created_at_date", toDate.toISOString())
        .order("created_at_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    const num = amount || 0;
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const totalAmount = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.total || 0), 0);
  }, [transactions]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return format(date, "dd/MM HH:mm", { locale: language === "ar" ? ar : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {language === "ar" ? "معاملات العميل" : "Customer Transactions"}
          </DialogTitle>
          <div className="flex items-center gap-4 pt-2">
            <span className="font-medium">
              {customerName || (language === "ar" ? "عميل" : "Customer")}
            </span>
            <Badge variant="secondary">
              {transactions.length} {language === "ar" ? "معاملة" : "transactions"}
            </Badge>
          </div>
        </DialogHeader>

        {/* Day Filter Buttons */}
        <div className="flex gap-2 pb-3 border-b">
          {([1, 2, 3] as const).map((days) => (
            <Button
              key={days}
              variant={dayFilter === days ? "default" : "outline"}
              size="sm"
              onClick={() => setDayFilter(days)}
            >
              {language === "ar" 
                ? days === 1 ? "يوم واحد" : `${days} أيام`
                : days === 1 ? "1 Day" : `${days} Days`}
            </Button>
          ))}
        </div>

        {/* Transactions Table */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا توجد معاملات" : "No transactions found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{language === "ar" ? "رقم الطلب" : "Order #"}</TableHead>
                  <TableHead>{language === "ar" ? "المنتج" : "Product"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "الكمية" : "Qty"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-sm">
                      {formatDate(transaction.created_at_date)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {transaction.order_number?.slice(-8) || "-"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm">
                      {transaction.product_name || "-"}
                    </TableCell>
                    <TableCell className="text-center">{transaction.qty || 1}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={transaction.order_status === "completed" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {transaction.order_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Total */}
        {transactions.length > 0 && (
          <div className="flex justify-between items-center pt-3 border-t">
            <span className="text-sm text-muted-foreground">
              {language === "ar" ? "الإجمالي" : "Total"}
            </span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
