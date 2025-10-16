import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";

interface CustomerTotal {
  customer_phone: string;
  customer_name: string;
  creation_date: string;
  last_trans_date: string;
  total: number;
  status: string;
  is_blocked: boolean;
  block_reason: string | null;
}

const CustomerTotals = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customerTotals, setCustomerTotals] = useState<CustomerTotal[]>([]);

  const translations = {
    en: {
      title: "Customer Totals",
      phone: "Phone",
      name: "Customer Name",
      creationDate: "First Purchase",
      lastTransDate: "Last Purchase",
      total: "Total Spent",
      status: "Status",
      blocked: "Blocked",
      active: "Active",
      loading: "Loading customer totals...",
      error: "Error loading customer totals",
    },
    ar: {
      title: "إجماليات العملاء",
      phone: "الهاتف",
      name: "اسم العميل",
      creationDate: "أول عملية شراء",
      lastTransDate: "آخر عملية شراء",
      total: "إجمالي المبلغ",
      status: "الحالة",
      blocked: "محظور",
      active: "نشط",
      loading: "جاري تحميل إجماليات العملاء...",
      error: "خطأ في تحميل إجماليات العملاء",
    },
  };

  const t = translations[language as keyof typeof translations];

  useEffect(() => {
    fetchCustomerTotals();
  }, []);

  const fetchCustomerTotals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_totals")
        .select("*")
        .order("total", { ascending: false });

      if (error) throw error;
      setCustomerTotals(data || []);
    } catch (error: any) {
      console.error("Error fetching customer totals:", error);
      toast({
        title: t.error,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-6">
      {loading && <LoadingOverlay progress={50} message={t.loading} />}
      
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">{t.title}</h1>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.phone}</TableHead>
              <TableHead>{t.name}</TableHead>
              <TableHead>{t.creationDate}</TableHead>
              <TableHead>{t.lastTransDate}</TableHead>
              <TableHead className="text-right">{t.total}</TableHead>
              <TableHead>{t.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customerTotals.map((customer) => (
              <TableRow key={customer.customer_phone}>
                <TableCell className="font-mono">{customer.customer_phone}</TableCell>
                <TableCell>{customer.customer_name}</TableCell>
                <TableCell>
                  {customer.creation_date
                    ? format(new Date(customer.creation_date), "MMM dd, yyyy")
                    : "-"}
                </TableCell>
                <TableCell>
                  {customer.last_trans_date
                    ? format(new Date(customer.last_trans_date), "MMM dd, yyyy")
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(customer.total)}
                </TableCell>
                <TableCell>
                  {customer.is_blocked ? (
                    <Badge variant="destructive">{t.blocked}</Badge>
                  ) : (
                    <Badge variant="default">{t.active}</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CustomerTotals;
