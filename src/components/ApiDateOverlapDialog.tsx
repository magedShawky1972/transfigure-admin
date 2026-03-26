import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

interface DateSummary {
  date: string;
  dbCount: number;
  dbTotal: number;
  dbSources: string[];
  excelCount: number;
  excelTotal: number;
}

interface ApiDateOverlapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excelData: any[];
  overlappingDates: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ApiDateOverlapDialog = ({
  open,
  onOpenChange,
  excelData,
  overlappingDates,
  onConfirm,
  onCancel,
}: ApiDateOverlapDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [dateSummaries, setDateSummaries] = useState<DateSummary[]>([]);
  const [totalDbRecords, setTotalDbRecords] = useState(0);
  const [totalDbAmount, setTotalDbAmount] = useState(0);
  const [totalExcelRecords, setTotalExcelRecords] = useState(0);
  const [totalExcelAmount, setTotalExcelAmount] = useState(0);

  useEffect(() => {
    if (open && overlappingDates.length > 0) {
      compareData();
    }
  }, [open]);

  const findKey = (keys: string[], ...patterns: string[]) => {
    for (const p of patterns) {
      const f = keys.find(k => k.toLowerCase().replace(/[_\s]/g, '') === p);
      if (f) return f;
    }
    return undefined;
  };

  const compareData = async () => {
    setLoading(true);
    try {
      const keys = excelData.length > 0 ? Object.keys(excelData[0]) : [];
      const totalKey = findKey(keys, 'total') || keys.find(k => k.toLowerCase() === 'total');
      const dateKey = findKey(keys, 'createdatdate', 'createatdate', 'createdat', 'createddate') ||
        keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('createdatdate'));

      // Build Excel summaries per date
      const excelByDate = new Map<string, { count: number; total: number }>();
      excelData.forEach((row: any) => {
        let dateVal: string | null = null;
        if (dateKey) {
          const raw = row[dateKey];
          if (raw) {
            const str = String(raw).trim();
            const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
            if (m) dateVal = m[1];
          }
        }
        if (!dateVal) {
          // Try to match from overlapping dates
          for (const d of overlappingDates) {
            dateVal = d;
            break;
          }
        }
        if (!dateVal) return;
        const rowTotal = totalKey ? (parseFloat(String(row[totalKey]).replace(/[,\s]/g, '')) || 0) : 0;
        const existing = excelByDate.get(dateVal) || { count: 0, total: 0 };
        existing.count++;
        existing.total += rowTotal;
        excelByDate.set(dateVal, existing);
      });

      // Query existing DB records for overlapping dates
      const dbByDate = new Map<string, { count: number; total: number; sources: Set<string> }>();
      for (const dateStr of overlappingDates) {
        const { data } = await supabase
          .from('purpletransaction')
          .select('total, source')
          .eq('created_at_date', dateStr);

        const entry = { count: 0, total: 0, sources: new Set<string>() };
        (data || []).forEach((row: any) => {
          entry.count++;
          entry.total += parseFloat(String(row.total)) || 0;
          if (row.source) entry.sources.add(row.source);
        });
        dbByDate.set(dateStr, entry);
      }

      const summaries: DateSummary[] = overlappingDates.map(date => {
        const db = dbByDate.get(date) || { count: 0, total: 0, sources: new Set<string>() };
        const excel = excelByDate.get(date) || { count: 0, total: 0 };
        return {
          date,
          dbCount: db.count,
          dbTotal: db.total,
          dbSources: Array.from(db.sources),
          excelCount: excel.count,
          excelTotal: excel.total,
        };
      });

      setDateSummaries(summaries);
      setTotalDbRecords(summaries.reduce((s, d) => s + d.dbCount, 0));
      setTotalDbAmount(summaries.reduce((s, d) => s + d.dbTotal, 0));
      setTotalExcelRecords(summaries.reduce((s, d) => s + d.excelCount, 0));
      setTotalExcelAmount(summaries.reduce((s, d) => s + d.excelTotal, 0));
    } catch (error) {
      console.error('Error comparing data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            API Date Overlap Detected
          </DialogTitle>
          <DialogDescription>
            The Excel data includes dates that overlap with the API sync period. 
            The system will compare records already uploaded by API with this Excel file before upload starts.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            Overlapping dates: {overlappingDates.join(', ')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Records from these dates already exist in the database. Review the summary below before continuing. Existing records will be updated and missing records will be added.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Checking existing records...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                <AlertCircle className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                <p className="text-xs text-muted-foreground">Existing DB Records</p>
                <p className="text-lg font-bold text-blue-500">{totalDbRecords.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{totalDbAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <CheckCircle2 className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Excel Records to Upload</p>
                <p className="text-lg font-bold text-primary">{totalExcelRecords.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{totalExcelAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {dateSummaries.length > 0 && (
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">DB Records</TableHead>
                      <TableHead className="text-right">DB Total</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead className="text-center">Excel Records</TableHead>
                      <TableHead className="text-right">Excel Total</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateSummaries.map((d) => (
                      <TableRow key={d.date} className={d.dbCount > 0 ? 'bg-yellow-500/5' : ''}>
                        <TableCell className="font-mono text-sm font-medium">{d.date}</TableCell>
                        <TableCell className="text-center">{d.dbCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{d.dbTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          {d.dbSources.map(s => (
                            <Badge key={s} variant="outline" className="text-xs mr-1">{s}</Badge>
                          ))}
                        </TableCell>
                        <TableCell className="text-center">{d.excelCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{d.excelTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {(d.excelTotal - d.dbTotal) !== 0 ? (
                            <span className={d.excelTotal - d.dbTotal > 0 ? 'text-green-500' : 'text-destructive'}>
                              {(d.excelTotal - d.dbTotal) > 0 ? '+' : ''}{(d.excelTotal - d.dbTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-green-500">Match</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {totalDbRecords > 0 && (
              <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  ⚠ {totalDbRecords.toLocaleString()} existing records found for these dates. 
                  Uploading will update matching orders and add new ones.
                </p>
              </div>
            )}

            {totalDbRecords === 0 && (
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                <p className="text-sm font-medium text-green-600">
                  No existing records found for these dates. All records will be added as new.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel Upload
              </Button>
              <Button onClick={onConfirm} className="flex-1">
                Confirm & Continue to Upload
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
