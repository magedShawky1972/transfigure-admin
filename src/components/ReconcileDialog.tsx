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
import { Loader2, CheckCircle2, AlertCircle, HelpCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ReconcileResult {
  orderNumber: string;
  excelTotal: number;
  dbTotal: number;
  difference: number;
  status: 'match' | 'mismatch' | 'missing';
}

interface ReconcileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excelData: any[];
}

export const ReconcileDialog = ({ open, onOpenChange, excelData }: ReconcileDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ReconcileResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'match' | 'mismatch' | 'missing' | 'differences'>('differences');

  useEffect(() => {
    if (open && excelData.length > 0) {
      runReconciliation();
    }
  }, [open]);

  const runReconciliation = async () => {
    setLoading(true);
    try {
      // Group Excel data by order number
      const excelByOrder = new Map<string, number>();
      excelData.forEach((row: any) => {
        const orderNum = String(row.ordernumber || row['Order Number'] || row.order_number || '').trim();
        if (!orderNum) return;
        const total = parseFloat(String(row.total || row.Total || 0).replace(/[,\s]/g, '')) || 0;
        excelByOrder.set(orderNum, (excelByOrder.get(orderNum) || 0) + total);
      });

      const orderNums = Array.from(excelByOrder.keys());

      // Fetch DB data in batches
      const dbByOrder = new Map<string, number>();
      for (let i = 0; i < orderNums.length; i += 500) {
        const batch = orderNums.slice(i, i + 500);
        const { data } = await supabase
          .from('purpletransaction')
          .select('ordernumber, total')
          .in('ordernumber', batch);

        (data || []).forEach((row: any) => {
          const num = String(row.ordernumber || '');
          const total = parseFloat(row.total) || 0;
          dbByOrder.set(num, (dbByOrder.get(num) || 0) + total);
        });
      }

      // Compare
      const reconcileResults: ReconcileResult[] = [];
      excelByOrder.forEach((excelTotal, orderNumber) => {
        const dbTotal = dbByOrder.get(orderNumber);
        if (dbTotal === undefined) {
          reconcileResults.push({ orderNumber, excelTotal, dbTotal: 0, difference: excelTotal, status: 'missing' });
        } else {
          const diff = Math.round((excelTotal - dbTotal) * 100) / 100;
          reconcileResults.push({
            orderNumber,
            excelTotal,
            dbTotal,
            difference: diff,
            status: Math.abs(diff) < 0.01 ? 'match' : 'mismatch',
          });
        }
      });

      // Sort: mismatch first, then missing, then match
      reconcileResults.sort((a, b) => {
        const order = { mismatch: 0, missing: 1, match: 2 };
        return order[a.status] - order[b.status];
      });

      setResults(reconcileResults);
    } catch (error) {
      console.error('Reconciliation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? results : filter === 'differences' ? results.filter(r => r.status !== 'match') : results.filter(r => r.status === filter);
  const matched = results.filter(r => r.status === 'match').length;
  const mismatched = results.filter(r => r.status === 'mismatch').length;
  const missing = results.filter(r => r.status === 'missing').length;
  const totalExcel = results.reduce((s, r) => s + r.excelTotal, 0);
  const totalDb = results.reduce((s, r) => s + r.dbTotal, 0);
  const totalDiff = Math.round((totalExcel - totalDb) * 100) / 100;

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(results.map(r => ({
      'Order Number': r.orderNumber,
      'Excel Total': r.excelTotal,
      'DB Total': r.dbTotal,
      'Difference': r.difference,
      'Status': r.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reconciliation');
    XLSX.writeFile(wb, `reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Reconcile: Excel vs Database</DialogTitle>
          <DialogDescription>Comparing order totals between uploaded Excel and purpletransaction table</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Reconciling...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <button onClick={() => setFilter('all')} className={`p-2 rounded-lg border text-center transition-colors ${filter === 'all' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{results.length}</p>
              </button>
              <button onClick={() => setFilter('match')} className={`p-2 rounded-lg border text-center transition-colors ${filter === 'match' ? 'border-green-500 bg-green-500/10' : 'border-border'}`}>
                <p className="text-xs text-muted-foreground">Matched</p>
                <p className="text-lg font-bold text-green-600">{matched}</p>
              </button>
              <button onClick={() => setFilter('mismatch')} className={`p-2 rounded-lg border text-center transition-colors ${filter === 'mismatch' ? 'border-destructive bg-destructive/10' : 'border-border'}`}>
                <p className="text-xs text-muted-foreground">Mismatch</p>
                <p className="text-lg font-bold text-destructive">{mismatched}</p>
              </button>
              <button onClick={() => setFilter('missing')} className={`p-2 rounded-lg border text-center transition-colors ${filter === 'missing' ? 'border-yellow-500 bg-yellow-500/10' : 'border-border'}`}>
                <p className="text-xs text-muted-foreground">Missing</p>
                <p className="text-lg font-bold text-yellow-600">{missing}</p>
              </button>
              <div className="p-2 rounded-lg border border-border text-center">
                <p className="text-xs text-muted-foreground">Difference</p>
                <p className={`text-lg font-bold ${Math.abs(totalDiff) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                  {totalDiff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Excel Total</p>
                <p className="text-lg font-semibold">{totalExcel.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">DB Total</p>
                <p className="text-lg font-semibold">{totalDb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead className="text-right">Excel Total</TableHead>
                    <TableHead className="text-right">DB Total</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.orderNumber}
                      className={
                        r.status === 'match' ? 'bg-green-500/5' :
                        r.status === 'mismatch' ? 'bg-destructive/5' :
                        'bg-yellow-500/5'
                      }
                    >
                      <TableCell className="font-mono text-sm">{r.orderNumber}</TableCell>
                      <TableCell className="text-right">{r.excelTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{r.dbTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className={`text-right font-semibold ${Math.abs(r.difference) < 0.01 ? '' : 'text-destructive'}`}>
                        {r.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.status === 'match' && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Match</Badge>}
                        {r.status === 'mismatch' && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><AlertCircle className="h-3 w-3 mr-1" />Mismatch</Badge>}
                        {r.status === 'missing' && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><HelpCircle className="h-3 w-3 mr-1" />Missing</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={exportToExcel} className="flex-1">
                <Download className="h-4 w-4 mr-2" />Export to Excel
              </Button>
              <Button onClick={() => onOpenChange(false)} className="flex-1">Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
