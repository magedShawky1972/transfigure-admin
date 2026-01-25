import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileSpreadsheet, Printer, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Transaction {
  id: string;
  created_at: string;
  brand_name: string | null;
  product_name: string | null;
  qty: number | null;
  total: number | null;
  user_name: string | null;
}

const ManualShiftTransactionReport = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return format(date, "yyyy-MM-dd");
  });
  const [toDate, setToDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [users, setUsers] = useState<string[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      // Load users only within selected date range (same filter as report)
      const fromDateInt = dateToInt(fromDate);
      const toDateInt = dateToInt(toDate);

      const allUserNames = new Set<string>();
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      let safetyIters = 0;

      while (hasMore && safetyIters < 50) {
        safetyIters += 1;
        const { data, error } = await supabase
          .from("purpletransaction")
          .select("user_name")
          .gte("created_at_date_int", fromDateInt)
          .lte("created_at_date_int", toDateInt)
          .eq("is_deleted", false)
          .not("user_name", "is", null)
          .order("user_name", { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error("Error fetching users:", error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          data.forEach((d) => {
            if (d.user_name) allUserNames.add(d.user_name);
          });
          offset += batchSize;
          hasMore = data.length === batchSize;
        }
      }

      const uniqueUsers = Array.from(allUserNames).sort();
      setUsers(uniqueUsers);

      // Reset selected user if it no longer exists in the new date range
      if (selectedUser !== "all" && !allUserNames.has(selectedUser)) {
        setSelectedUser("all");
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const dateToInt = (dateStr: string): number => {
    return parseInt(dateStr.replace(/-/g, ""), 10);
  };

  const fetchReport = async () => {
    setLoading(true);
    setHasRun(true);

    try {
      const fromDateInt = dateToInt(fromDate);
      const toDateInt = dateToInt(toDate);

      let query = supabase
        .from("purpletransaction")
        .select("id, created_at, brand_name, product_name, qty, total, user_name")
        .gte("created_at_date_int", fromDateInt)
        .lte("created_at_date_int", toDateInt)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      if (selectedUser !== "all") {
        query = query.eq("user_name", selectedUser);
      }

      const { data: txData, error: txError } = await query;

      if (txError) throw txError;

      if (!txData || txData.length === 0) {
        setTransactions([]);
        toast.info(isRTL ? "لا توجد معاملات في الفترة المحددة" : "No transactions found in the selected period");
        return;
      }

      setTransactions(txData);
      toast.success(isRTL ? `تم تحميل ${txData.length} معاملة` : `Loaded ${txData.length} transactions`);
    } catch (error: any) {
      console.error("Error fetching report:", error);
      toast.error(isRTL ? "خطأ في تحميل التقرير" : "Error loading report");
    } finally {
      setLoading(false);
    }
  };

  // Group transactions by user, then by brand
  const groupedData = useMemo(() => {
    const byUser = new Map<string, { userName: string; brands: Map<string, Transaction[]> }>();

    transactions.forEach((tx) => {
      const userName = tx.user_name || "Unknown";
      if (!byUser.has(userName)) {
        byUser.set(userName, { userName, brands: new Map() });
      }
      const userGroup = byUser.get(userName)!;
      const brandName = tx.brand_name || "Unknown";
      if (!userGroup.brands.has(brandName)) {
        userGroup.brands.set(brandName, []);
      }
      userGroup.brands.get(brandName)!.push(tx);
    });

    return byUser;
  }, [transactions]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => ({
        qty: acc.qty + (tx.qty || 0),
        total: acc.total + (tx.total || 0),
      }),
      { qty: 0, total: 0 }
    );
  }, [transactions]);

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy-MM-dd HH:mm");
    } catch {
      return dateStr;
    }
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      toast.error(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const rows: any[] = [];

    groupedData.forEach((userGroup, userName) => {
      let userQty = 0;
      let userTotal = 0;

      userGroup.brands.forEach((txList, brandName) => {
        const brandQty = txList.reduce((sum, tx) => sum + (tx.qty || 0), 0);
        const brandTotal = txList.reduce((sum, tx) => sum + (tx.total || 0), 0);

        txList.forEach((tx) => {
          rows.push({
            [isRTL ? "المستخدم" : "User"]: userName,
            [isRTL ? "العلامة التجارية" : "Brand"]: brandName,
            [isRTL ? "التاريخ والوقت" : "Date Time"]: formatDateTime(tx.created_at),
            [isRTL ? "المنتج" : "Product"]: tx.product_name,
            [isRTL ? "الكمية" : "Qty"]: tx.qty || 0,
            [isRTL ? "المبلغ" : "Total"]: tx.total || 0,
          });
        });

        rows.push({
          [isRTL ? "المستخدم" : "User"]: "",
          [isRTL ? "العلامة التجارية" : "Brand"]: isRTL ? `إجمالي ${brandName}` : `${brandName} Total`,
          [isRTL ? "التاريخ والوقت" : "Date Time"]: "",
          [isRTL ? "المنتج" : "Product"]: "",
          [isRTL ? "الكمية" : "Qty"]: brandQty,
          [isRTL ? "المبلغ" : "Total"]: brandTotal,
        });

        userQty += brandQty;
        userTotal += brandTotal;
      });

      rows.push({
        [isRTL ? "المستخدم" : "User"]: isRTL ? `إجمالي ${userName}` : `${userName} Total`,
        [isRTL ? "العلامة التجارية" : "Brand"]: "",
        [isRTL ? "التاريخ والوقت" : "Date Time"]: "",
        [isRTL ? "المنتج" : "Product"]: "",
        [isRTL ? "الكمية" : "Qty"]: userQty,
        [isRTL ? "المبلغ" : "Total"]: userTotal,
      });
    });

    rows.push({
      [isRTL ? "المستخدم" : "User"]: isRTL ? "الإجمالي الكلي" : "Grand Total",
      [isRTL ? "العلامة التجارية" : "Brand"]: "",
      [isRTL ? "التاريخ والوقت" : "Date Time"]: "",
      [isRTL ? "المنتج" : "Product"]: "",
      [isRTL ? "الكمية" : "Qty"]: grandTotals.qty,
      [isRTL ? "المبلغ" : "Total"]: grandTotals.total,
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تقرير المعاملات اليدوية" : "Manual Transactions");

    if (isRTL) {
      ws["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 10 }, { wch: 15 }];
      ws["!dir"] = "rtl";
    }

    XLSX.writeFile(wb, `manual-shift-transactions-${fromDate}-to-${toDate}.xlsx`);
    toast.success(isRTL ? "تم تصدير التقرير" : "Report exported");
  };

  return (
    <div className="space-y-6 print:space-y-2">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; color: black !important; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            .print-header { display: block !important; }
            table { font-size: 10px; border-collapse: collapse; }
            table, th, td { border: none !important; }
            th { border-bottom: 1px solid #000 !important; }
            .brand-total { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; }
            .user-total { background-color: #e5e7eb !important; -webkit-print-color-adjust: exact; }
            .grand-total { background-color: #d1d5db !important; -webkit-print-color-adjust: exact; font-weight: bold; }
          }
          .print-header { display: none; }
        `}
      </style>

      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isRTL ? "رجوع" : "Back"}
          </Button>
          <h1 className="text-2xl font-bold">
            {isRTL ? "تقرير معاملات المناوبة اليدوية" : "Manual Shift Transaction Report"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {isRTL ? "تصدير" : "Export"}
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={transactions.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>{isRTL ? "فلاتر التقرير" : "Report Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "المستخدم" : "User"}</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "جميع المستخدمين" : "All Users"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "جميع المستخدمين" : "All Users"}</SelectItem>
                  {usersLoading ? (
                    <SelectItem value="__loading" disabled>
                      {isRTL ? "جاري تحميل المستخدمين..." : "Loading users..."}
                    </SelectItem>
                  ) : (
                    users.map((userName) => (
                      <SelectItem key={userName} value={userName}>
                        {userName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchReport} disabled={loading} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                {loading ? (isRTL ? "جاري التحميل..." : "Loading...") : isRTL ? "تحميل التقرير" : "Run Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="print-area">
        <div className="print-header text-center mb-4">
          <h1 className="text-xl font-bold">
            {isRTL ? "تقرير معاملات المناوبة اليدوية" : "Manual Shift Transaction Report"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? `من ${fromDate} إلى ${toDate}` : `From ${fromDate} to ${toDate}`}
          </p>
        </div>

        {hasRun && transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {isRTL ? "لا توجد معاملات في الفترة المحددة" : "No transactions found in the selected period"}
            </CardContent>
          </Card>
        ) : transactions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "التاريخ والوقت" : "Date Time"}</TableHead>
                    <TableHead>{isRTL ? "العلامة التجارية" : "Brand"}</TableHead>
                    <TableHead>{isRTL ? "المنتج" : "Product"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "المبلغ" : "Total"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(groupedData.entries()).map(([userName, userGroup]) => {
                    let userQty = 0;
                    let userTotal = 0;

                    return (
                      <>
                        <TableRow key={`user-header-${userName}`} className="bg-primary/5">
                          <TableCell colSpan={5} className="font-semibold">
                            {isRTL ? `المستخدم: ${userName}` : `User: ${userName}`}
                          </TableCell>
                        </TableRow>
                        {Array.from(userGroup.brands.entries()).flatMap(([brandName, txList]) => {
                          const brandQty = txList.reduce((sum, tx) => sum + (tx.qty || 0), 0);
                          const brandTotal = txList.reduce((sum, tx) => sum + (tx.total || 0), 0);
                          userQty += brandQty;
                          userTotal += brandTotal;

                          return [
                            ...txList.map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                                <TableCell>{brandName}</TableCell>
                                <TableCell>{tx.product_name}</TableCell>
                                <TableCell className="text-center">{tx.qty || 0}</TableCell>
                                <TableCell className="text-right">{formatNumber(tx.total || 0)}</TableCell>
                              </TableRow>
                            )),
                            <TableRow key={`brand-total-${userName}-${brandName}`} className="brand-total bg-muted/50 font-medium">
                              <TableCell colSpan={2}>
                                {isRTL ? `إجمالي ${brandName}` : `${brandName} Subtotal`}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-center">{brandQty}</TableCell>
                              <TableCell className="text-right">{formatNumber(brandTotal)}</TableCell>
                            </TableRow>,
                          ];
                        })}
                        <TableRow key={`user-total-${userName}`} className="user-total bg-muted font-semibold">
                          <TableCell colSpan={2}>
                            {isRTL ? `إجمالي ${userName}` : `${userName} Total`}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-center">{userQty}</TableCell>
                          <TableCell className="text-right">{formatNumber(userTotal)}</TableCell>
                        </TableRow>
                      </>
                    );
                  })}
                  {transactions.length > 0 && (
                    <TableRow className="grand-total bg-primary/10 font-bold text-lg">
                      <TableCell colSpan={2}>{isRTL ? "الإجمالي الكلي" : "Grand Total"}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center">{grandTotals.qty}</TableCell>
                      <TableCell className="text-right">{formatNumber(grandTotals.total)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
};

export default ManualShiftTransactionReport;
