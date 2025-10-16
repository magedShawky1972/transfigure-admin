import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Transaction {
  id: string;
  order_number: string;
  created_at_date: string;
  brand_name: string;
  product_name: string;
  qty: string;
  total: string;
  payment_method: string;
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
  const { t } = useLanguage();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

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

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount?.replace(/[^0-9.-]/g, "") || "0");
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getTotalAmount = () => {
    return transactions.reduce((sum, t) => {
      const amount = parseFloat(t.total?.replace(/[^0-9.-]/g, "") || "0");
      return sum + amount;
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
        {loading && <LoadingOverlay progress={50} message="Loading transactions..." />}
        
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {t("customerSetup.customerTransactions")}
          </DialogTitle>
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
              {transactions.length} {t("dashboard.transactions")}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[140px]">{t("customerSetup.orderNumber") || t("dashboard.orderNumber")}</TableHead>
                <TableHead className="min-w-[120px]">{t("customerSetup.date") || t("dashboard.date")}</TableHead>
                <TableHead className="min-w-[120px]">{t("customerSetup.brand")}</TableHead>
                <TableHead className="min-w-[150px]">{t("customerSetup.product")}</TableHead>
                <TableHead className="text-center min-w-[100px]">{t("customerSetup.quantity") || t("dashboard.quantity")}</TableHead>
                <TableHead className="min-w-[140px]">{t("customerSetup.paymentMethod") || t("dashboard.paymentMethod")}</TableHead>
                <TableHead className="min-w-[120px]">{t("customerSetup.status") || t("dashboard.status")}</TableHead>
                <TableHead className="text-right min-w-[120px]">{t("customerSetup.total") || t("dashboard.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {loading ? t("common.loading") || "Loading..." : t("customerSetup.noTransactions") || "No transactions found"}
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
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
                      <Badge variant="outline">{transaction.payment_method || "-"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={transaction.order_status === "completed" ? "default" : "secondary"}
                      >
                        {transaction.order_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {transactions.length > 0 && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{transactions.length}</span>
              {" "}
              <span>{t("customerSetup.totalTransactionsCount")}</span>
            </div>
            <div className="text-right">
              <span className="text-sm text-muted-foreground mr-2">
                {t("customerSetup.totalAmount")}:
              </span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(getTotalAmount().toString())}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
