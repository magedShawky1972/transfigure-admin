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

interface DiffRow {
  orderNumber: string;
  lineNo: number;
  field: string;
  excelValue: string;
  apiValue: string;
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
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    if (open && excelData.length > 0) {
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
      // Extract order numbers from Excel data
      const keys = excelData.length > 0 ? Object.keys(excelData[0]) : [];
      const orderKey = findKey(keys, 'ordernumber') ||
        keys.find(k => k.toLowerCase().includes('order') && k.toLowerCase().includes('num'));

      if (!orderKey) {
        setLoading(false);
        return;
      }

      const orderNumbers = [...new Set(
        excelData
          .map(r => String(r[orderKey] || '').trim())
          .filter(Boolean)
      )];

      // Fetch existing DB records for these orders
      const dbRecords = new Map<string, any>();
      for (let i = 0; i < orderNumbers.length; i += 500) {
        const batch = orderNumbers.slice(i, i + 500);
        const { data } = await supabase
          .from('purpletransaction')
          .select('ordernumber, line_no, user_name, vendor_name, customer_name, total, cost_sold, product_name, brand_name')
          .in('ordernumber', batch);

        (data || []).forEach(row => {
          dbRecords.set(`${row.ordernumber}|${row.line_no || 1}`, row);
        });
      }

      // Compare fields
      const fieldsToCompare = ['user_name', 'vendor_name', 'customer_name', 'total', 'cost_sold', 'product_name', 'brand_name'];
      const diffRows: DiffRow[] = [];
      let matches = 0;

      // Group Excel by order+line
      const excelByOrderLine = new Map<string, any>();
      const lineCounters = new Map<string, number>();

      const lineKey = findKey(keys, 'lineno', 'linenumber', 'line_no', 'line') ||
        keys.find(k => k.toLowerCase().replace(/[_\s]/g, '').includes('lineno'));

      excelData.forEach(row => {
        const orderNum = String(row[orderKey] || '').trim();
        if (!orderNum) return;
        const lineNo = lineKey ? (parseInt(String(row[lineKey])) || 1) : 
          ((lineCounters.get(orderNum) || 0) + 1);
        lineCounters.set(orderNum, lineNo);

        const key = `${orderNum}|${lineNo}`;
        excelByOrderLine.set(key, row);
      });

      excelByOrderLine.forEach((excelRow, key) => {
        const dbRow = dbRecords.get(key);
        if (!dbRow) return; // Only compare records that exist in both

        const [orderNumber, lineNoStr] = key.split('|');
        const lineNo = parseInt(lineNoStr);
        let hasDiff = false;

        fieldsToCompare.forEach(field => {
          const excelVal = String(excelRow[field] ?? excelRow[field.replace(/_/g, ' ')] ?? '').trim();
          const dbVal = String(dbRow[field] ?? '').trim();

          if (excelVal && dbVal && excelVal !== dbVal) {
            // For numeric fields, compare as numbers
            if (['total', 'cost_sold'].includes(field)) {
              const exNum = parseFloat(excelVal.replace(/[,\s]/g, '')) || 0;
              const dbNum = parseFloat(dbVal.replace(/[,\s]/g, '')) || 0;
              if (Math.abs(exNum - dbNum) < 0.01) return;
            }

            diffRows.push({
              orderNumber,
              lineNo,
              field,
              excelValue: excelVal,
              apiValue: dbVal,
            });
            hasDiff = true;
          }
        });

        if (!hasDiff) matches++;
      });

      setDiffs(diffRows);
      setMatchCount(matches);
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
            The system will compare existing API data with Excel data before uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
          <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            Overlapping dates: {overlappingDates.join(', ')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Records from these dates may already exist from API sync. Excel upload will update existing records with Excel data.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Comparing API data vs Excel data...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                <CheckCircle2 className="h-4 w-4 mx-auto text-green-600 mb-1" />
                <p className="text-xs text-muted-foreground">Matching Records</p>
                <p className="text-lg font-bold text-green-600">{matchCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-center">
                <AlertCircle className="h-4 w-4 mx-auto text-destructive mb-1" />
                <p className="text-xs text-muted-foreground">Differences Found</p>
                <p className="text-lg font-bold text-destructive">{diffs.length}</p>
              </div>
            </div>

            {diffs.length > 0 ? (
              <div className="flex-1 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-center">Line</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>API (DB) Value</TableHead>
                      <TableHead>Excel Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffs.slice(0, 200).map((d, i) => (
                      <TableRow key={i} className="bg-destructive/5">
                        <TableCell className="font-mono text-sm">{d.orderNumber}</TableCell>
                        <TableCell className="text-center">{d.lineNo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{d.field}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.apiValue}</TableCell>
                        <TableCell className="text-sm font-medium">{d.excelValue}</TableCell>
                      </TableRow>
                    ))}
                    {diffs.length > 200 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                          ... and {diffs.length - 200} more differences
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center bg-green-500/5 rounded-lg border border-green-500/20">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium text-green-600">No differences found between API and Excel data</p>
                <p className="text-xs text-muted-foreground mt-1">All overlapping records match perfectly</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancel Upload
              </Button>
              <Button onClick={onConfirm} className="flex-1">
                {diffs.length > 0 ? `Confirm & Upload (${diffs.length} changes)` : 'Confirm & Upload'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
