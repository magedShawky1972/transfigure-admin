import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface PivotData {
  [key: string]: {
    [key: string]: number | number[];
  };
}

const PivotTable = () => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rowField, setRowField] = useState<string>("brand_name");
  const [columnField, setColumnField] = useState<string>("product_name");
  const [valueField, setValueField] = useState<string>("total");
  const [aggregation, setAggregation] = useState<string>("sum");
  const [pivotData, setPivotData] = useState<PivotData>({});
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[]>([]);

  const fieldOptions = [
    { value: "brand_name", label: t("dashboard.brand") },
    { value: "product_name", label: t("dashboard.product") },
    { value: "customer_name", label: t("dashboard.customer") },
    { value: "payment_method", label: t("transactions.paymentMethod") },
    { value: "payment_type", label: t("transactions.paymentType") },
    { value: "user_name", label: t("transactions.userName") },
  ];

  const valueOptions = [
    { value: "total", label: t("dashboard.amount") },
    { value: "profit", label: t("dashboard.profit") },
    { value: "qty", label: t("transactions.qty") },
    { value: "cost_price", label: t("transactions.costPrice") },
    { value: "unit_price", label: t("transactions.unitPrice") },
  ];

  const aggregationOptions = [
    { value: "sum", label: t("pivotTable.sum") },
    { value: "count", label: t("pivotTable.count") },
    { value: "avg", label: t("pivotTable.average") },
    { value: "min", label: t("pivotTable.min") },
    { value: "max", label: t("pivotTable.max") },
  ];

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      generatePivotTable();
    }
  }, [transactions, rowField, columnField, valueField, aggregation]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purpletransaction')
        .select('*')
        .order('created_at_date', { ascending: false });

      if (error) throw error;
      if (data) {
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: t("common.error"),
        description: "Failed to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseNumber = (value?: string | null) => {
    if (value == null) return 0;
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (amount: number) => {
    if (!isFinite(amount)) amount = 0;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ر.س`;
  };

  const formatValue = (value: number) => {
    if (valueField === "total" || valueField === "profit" || valueField === "cost_price" || valueField === "unit_price") {
      return formatCurrency(value);
    }
    return value.toFixed(2);
  };

  const generatePivotTable = () => {
    const pivot: PivotData = {};
    const colSet = new Set<string>();
    const rowSet = new Set<string>();

    // Initialize pivot structure
    transactions.forEach(transaction => {
      const rowValue = transaction[rowField] || "N/A";
      const colValue = transaction[columnField] || "N/A";
      
      rowSet.add(rowValue);
      colSet.add(colValue);

      if (!pivot[rowValue]) {
        pivot[rowValue] = {};
      }
      if (!pivot[rowValue][colValue]) {
        pivot[rowValue][colValue] = aggregation === "count" ? 0 : 0;
      }
    });

    // Calculate aggregations
    transactions.forEach(transaction => {
      const rowValue = transaction[rowField] || "N/A";
      const colValue = transaction[columnField] || "N/A";
      const value = parseNumber(transaction[valueField]);

      const valuesKey = colValue + "_values";
      if (!pivot[rowValue][valuesKey]) {
        pivot[rowValue][valuesKey] = [];
      }
      (pivot[rowValue][valuesKey] as number[]).push(value);
    });

    // Apply aggregation function
    Object.keys(pivot).forEach(row => {
      Object.keys(pivot[row]).forEach(col => {
        if (col.endsWith("_values")) {
          const values = pivot[row][col] as number[];
          const actualCol = col.replace("_values", "");
          
          switch (aggregation) {
            case "sum":
              pivot[row][actualCol] = values.reduce((a, b) => a + b, 0);
              break;
            case "count":
              pivot[row][actualCol] = values.length;
              break;
            case "avg":
              pivot[row][actualCol] = values.reduce((a, b) => a + b, 0) / values.length;
              break;
            case "min":
              pivot[row][actualCol] = Math.min(...values);
              break;
            case "max":
              pivot[row][actualCol] = Math.max(...values);
              break;
          }
          delete pivot[row][col]; // Remove helper array
        }
      });
    });

    setPivotData(pivot);
    setColumns(Array.from(colSet).sort());
    setRows(Array.from(rowSet).sort());
  };

  const calculateRowTotal = (rowKey: string) => {
    return columns.reduce((sum, col) => {
      const value = pivotData[rowKey]?.[col];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  };

  const calculateColumnTotal = (colKey: string) => {
    return rows.reduce((sum, row) => {
      const value = pivotData[row]?.[colKey];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  };

  const calculateGrandTotal = () => {
    return rows.reduce((sum, row) => {
      return sum + calculateRowTotal(row);
    }, 0);
  };

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("pivotTable.title")}</h1>
        <p className="text-muted-foreground">
          {t("pivotTable.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("pivotTable.configuration")}</CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchTransactions}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("pivotTable.rowField")}
              </label>
              <Select value={rowField} onValueChange={setRowField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("pivotTable.columnField")}
              </label>
              <Select value={columnField} onValueChange={setColumnField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("pivotTable.valueField")}
              </label>
              <Select value={valueField} onValueChange={setValueField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {valueOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("pivotTable.aggregation")}
              </label>
              <Select value={aggregation} onValueChange={setAggregation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aggregationOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={generatePivotTable} className="w-full">
                {t("pivotTable.generate")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("pivotTable.result")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-16 text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : rows.length === 0 || columns.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {t("dashboard.noData")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold bg-muted">
                      {fieldOptions.find(f => f.value === rowField)?.label} / {fieldOptions.find(f => f.value === columnField)?.label}
                    </TableHead>
                    {columns.map(col => (
                      <TableHead key={col} className="text-center bg-muted">
                        {col}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold bg-muted">
                      {t("pivotTable.total")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row}>
                      <TableCell className="font-medium bg-muted/50">
                        {row}
                      </TableCell>
                      {columns.map(col => (
                        <TableCell key={col} className="text-center">
                          {formatValue(typeof pivotData[row]?.[col] === 'number' ? pivotData[row][col] as number : 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-medium bg-muted/50">
                        {formatValue(calculateRowTotal(row))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted">
                    <TableCell>{t("pivotTable.total")}</TableCell>
                    {columns.map(col => (
                      <TableCell key={col} className="text-center">
                        {formatValue(calculateColumnTotal(col))}
                      </TableCell>
                    ))}
                    <TableCell className="text-center">
                      {formatValue(calculateGrandTotal())}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PivotTable;
