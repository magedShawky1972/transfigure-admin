import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ClearData = () => {
  const { t } = useLanguage();
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_tables')
        .select('table_name')
        .eq('status', 'active');

      if (error) throw error;
      if (data) {
        setTables(data.map((t) => t.table_name));
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast.error(t("clearData.error"));
    }
  };

  const handleClearClick = () => {
    if (!selectedTable) {
      toast.error(t("clearData.selectTableFirst"));
      return;
    }
    if (!fromDate || !toDate) {
      toast.error(t("clearData.selectDates"));
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmClear = async () => {
    if (!selectedTable || !fromDate || !toDate) return;

    setIsClearing(true);
    try {
      // Normalize table name to lowercase to match database identifiers
      const tableName = selectedTable.toLowerCase();
      // First, check which date column the table has
      const { data: sampleData } = await (supabase as any)
        .from(tableName)
        .select('*')
        .limit(1);

      // Determine which date column to use
      const dateColumn = sampleData && sampleData[0] && 'created_at_date' in sampleData[0] 
        ? 'created_at_date' 
        : 'created_at';

      // Format dates for comparison - set to start and end of day
      const fromDateStart = new Date(fromDate);
      fromDateStart.setHours(0, 0, 0, 0);
      
      const toDateEnd = new Date(toDate);
      toDateEnd.setHours(23, 59, 59, 999);

      // For created_at_date (timestamp without time zone), use date format without timezone
      // For created_at (timestamp with time zone), use ISO format
      const fromDateStr = dateColumn === 'created_at_date' 
        ? fromDateStart.toISOString().split('T')[0] + ' 00:00:00'
        : fromDateStart.toISOString();
      
      const toDateStr = dateColumn === 'created_at_date'
        ? toDateEnd.toISOString().split('T')[0] + ' 23:59:59'
        : toDateEnd.toISOString();

      console.log('Clearing data:', { tableName, dateColumn, fromDateStr, toDateStr });

      // Delete data within the date range
      const { error, count } = await (supabase as any)
        .from(tableName)
        .delete({ count: 'exact' })
        .gte(dateColumn, fromDateStr)
        .lte(dateColumn, toDateStr);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('Records deleted:', count);

      toast.success(t("clearData.success"));
      setSelectedTable("");
      setFromDate(undefined);
      setToDate(undefined);
    } catch (error) {
      console.error('Error clearing data:', error);
      toast.error(t("clearData.error"));
    } finally {
      setIsClearing(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("clearData.title")}</h1>
        <p className="text-muted-foreground">{t("clearData.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("clearData.title")}</CardTitle>
          <CardDescription>{t("clearData.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("clearData.selectTable")}</label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder={t("clearData.selectTablePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("clearData.fromDate")}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !fromDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "PPP") : <span>{t("clearData.fromDate")}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("clearData.toDate")}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !toDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "PPP") : <span>{t("clearData.toDate")}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button onClick={handleClearClick} variant="destructive" className="w-full">
            {t("clearData.clearButton")}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clearData.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clearData.confirmMessage")
                .replace("{table}", selectedTable)
                .replace("{fromDate}", fromDate ? format(fromDate, "PPP") : "")
                .replace("{toDate}", toDate ? format(toDate, "PPP") : "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("clearData.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear} disabled={isClearing}>
              {t("clearData.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClearData;
