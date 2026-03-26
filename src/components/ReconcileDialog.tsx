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

interface LineDetail {
  lineNo: number;
  excelTotal: number;
  dbTotal: number;
}

interface ReconcileResult {
  orderNumber: string;
  lines: LineDetail[];
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
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && excelData.length > 0) {
      runReconciliation();
    }
  }, [open]);

  const findKey = (keys: string[], ...patterns: string[]) => {
    for (const pattern of patterns) {
      const found = keys.find(k => k.toLowerCase().replace(/[_\s]/g, '') === pattern);
      if (found) return found;
    }
    return undefined;
  };

  const runReconciliation = async () => {
    setLoading(true);
    try {
      if (excelData.length > 0) {
        console.log('[Reconcile] Excel row keys:', Object.keys(excelData[0]));
        console.log('[Reconcile] Sample row:', JSON.stringify(excelData[0]).substring(0, 500));
      }

      // Build per-order, per-line from Excel
      // Auto-assign sequential line numbers per order (1, 2, 3...) just like the upload does
      const excelByOrderLine = new Map<string, Map<number, number>>();
      const orderLineCounter = new Map<string, number>();
      
      excelData.forEach((row: any) => {
        const keys = Object.keys(row);
        const orderKey = findKey(keys, 'ordernumber') 
          || keys.find(k => k.toLowerCase().includes('order') && k.toLowerCase().includes('num'));
        const orderNum = orderKey ? String(row[orderKey]).trim() : '';
        if (!orderNum) return;

        // Auto-assign sequential line number per order (matching upload logic)
        const currentLine = (orderLineCounter.get(orderNum) || 0) + 1;
        orderLineCounter.set(orderNum, currentLine);
        const lineNo = currentLine;

        const totalKey = keys.find(k => k.toLowerCase().trim() === 'total');
        const rawTotal = totalKey ? row[totalKey] : 0;
        const total = parseFloat(String(rawTotal).replace(/[,\s]/g, '')) || 0;

        if (!excelByOrderLine.has(orderNum)) {
          excelByOrderLine.set(orderNum, new Map());
        }
        const lineMap = excelByOrderLine.get(orderNum)!;
        lineMap.set(lineNo, total);
      });

      const orderNums = Array.from(excelByOrderLine.keys());

      // Fetch DB data per order+line
      const dbByOrderLine = new Map<string, Map<number, number>>();
      for (let i = 0; i < orderNums.length; i += 500) {
        const batch = orderNums.slice(i, i + 500);
        const { data } = await supabase
          .from('purpletransaction')
          .select('ordernumber, line_no, total')
          .in('ordernumber', batch);

        (data || []).forEach((row: any) => {
          const num = String(row.ordernumber || '');
          const lineNo = parseInt(row.line_no) || 1;
          const total = parseFloat(row.total) || 0;
          if (!dbByOrderLine.has(num)) {
            dbByOrderLine.set(num, new Map());
          }
          const lineMap = dbByOrderLine.get(num)!;
          lineMap.set(lineNo, (lineMap.get(lineNo) || 0) + total);
        });
      }

      // Compare per order, with line-level detail
      const reconcileResults: ReconcileResult[] = [];
      excelByOrderLine.forEach((excelLines, orderNumber) => {
        const dbLines = dbByOrderLine.get(orderNumber);
        
        // Collect all unique line numbers
        const allLineNos = new Set<number>();
        excelLines.forEach((_, ln) => allLineNos.add(ln));
        if (dbLines) dbLines.forEach((_, ln) => allLineNos.add(ln));
        
        const lines: LineDetail[] = Array.from(allLineNos).sort((a, b) => a - b).map(ln => ({
          lineNo: ln,
          excelTotal: excelLines.get(ln) || 0,
          dbTotal: dbLines?.get(ln) || 0,
        }));

        const excelTotal = lines.reduce((s, l) => s + l.excelTotal, 0);
        const dbTotal = lines.reduce((s, l) => s + l.dbTotal, 0);
        const diff = Math.round((excelTotal - dbTotal) * 100) / 100;

        reconcileResults.push({
          orderNumber,
          lines,
          excelTotal,
          dbTotal,
          difference: diff,
          status: !dbLines ? 'missing' : Math.abs(diff) < 0.01 ? 'match' : 'mismatch',
        });
      });

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

  const toggleExpand = (orderNumber: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  };

  const filtered = filter === 'all' ? results : filter === 'differences' ? results.filter(r => r.status !== 'match') : results.filter(r => r.status === filter);
  const matched = results.filter(r => r.status === 'match').length;
  const mismatched = results.filter(r => r.status === 'mismatch').length;
  const missing = results.filter(r => r.status === 'missing').length;
  const totalExcel = results.reduce((s, r) => s + r.excelTotal, 0);
  const totalDb = results.reduce((s, r) => s + r.dbTotal, 0);
  const totalDiff = Math.round((totalExcel - totalDb) * 100) / 100;

  const exportToExcel = () => {
    const rows: any[] = [];
    results.forEach(r => {
      if (r.lines.length > 1) {
        r.lines.forEach(l => {
          rows.push({
            'Order Number': r.orderNumber,
            'Line': l.lineNo,
            'Excel Total': l.excelTotal,
            'DB Total': l.dbTotal,
            'Difference': Math.round((l.excelTotal - l.dbTotal) * 100) / 100,
            'Status': '',
          });
        });
        rows.push({
          'Order Number': `${r.orderNumber} (Sum)`,
          'Line': '',
          'Excel Total': r.excelTotal,
          'DB Total': r.dbTotal,
          'Difference': r.difference,
          'Status': r.status,
        });
      } else {
        rows.push({
          'Order Number': r.orderNumber,
          'Line': r.lines[0]?.lineNo || 1,
          'Excel Total': r.excelTotal,
          'DB Total': r.dbTotal,
          'Difference': r.difference,
          'Status': r.status,
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reconciliation');
    XLSX.writeFile(wb, `reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Reconcile: Excel vs Database</DialogTitle>
          <DialogDescription>Comparing order totals (with line-level detail) between uploaded Excel and purpletransaction table</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Reconciling...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <button onClick={() => setFilter('all')} className={`p-2 rounded-lg border text-center transition-colors ${filter === 'all' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{results.length}</p>
              </button>
              <button onClick={() => setFilter('differences')} className={`p-2 rounded-lg border text-center transition-colors ${filter === 'differences' ? 'border-orange-500 bg-orange-500/10' : 'border-border'}`}>
                <p className="text-xs text-muted-foreground">Differences</p>
                <p className="text-lg font-bold text-orange-600">{mismatched + missing}</p>
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
                  {fmt(totalDiff)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Excel Total</p>
                <p className="text-lg font-semibold">{fmt(totalExcel)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">DB Total</p>
                <p className="text-lg font-semibold">{fmt(totalDb)}</p>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead className="text-center">Line</TableHead>
                    <TableHead className="text-right">Excel Total</TableHead>
                    <TableHead className="text-right">DB Total</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const hasMultiLines = r.lines.length > 1;
                    const isExpanded = expandedOrders.has(r.orderNumber);
                    return (
                      <>
                        {/* Order summary row */}
                        <TableRow
                          key={r.orderNumber}
                          className={`${
                            r.status === 'match' ? 'bg-green-500/5' :
                            r.status === 'mismatch' ? 'bg-destructive/5' :
                            'bg-yellow-500/5'
                          } ${hasMultiLines ? 'cursor-pointer' : ''}`}
                          onClick={() => hasMultiLines && toggleExpand(r.orderNumber)}
                        >
                          <TableCell className="font-mono text-sm">
                            {hasMultiLines && <span className="mr-1 text-muted-foreground">{isExpanded ? '▼' : '▶'}</span>}
                            {r.orderNumber}
                            {hasMultiLines && <span className="ml-1 text-xs text-muted-foreground">({r.lines.length} lines)</span>}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{hasMultiLines ? 'Sum' : r.lines[0]?.lineNo || 1}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.excelTotal)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(r.dbTotal)}</TableCell>
                          <TableCell className={`text-right font-semibold ${Math.abs(r.difference) < 0.01 ? '' : 'text-destructive'}`}>
                            {fmt(r.difference)}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.status === 'match' && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Match</Badge>}
                            {r.status === 'mismatch' && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><AlertCircle className="h-3 w-3 mr-1" />Mismatch</Badge>}
                            {r.status === 'missing' && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><HelpCircle className="h-3 w-3 mr-1" />Missing</Badge>}
                          </TableCell>
                        </TableRow>
                        {/* Expanded line details */}
                        {hasMultiLines && isExpanded && r.lines.map((line) => {
                          const lineDiff = Math.round((line.excelTotal - line.dbTotal) * 100) / 100;
                          return (
                            <TableRow key={`${r.orderNumber}-${line.lineNo}`} className="bg-muted/30">
                              <TableCell className="pl-10 text-xs text-muted-foreground">↳ Line</TableCell>
                              <TableCell className="text-center text-sm">{line.lineNo}</TableCell>
                              <TableCell className="text-right text-sm">{fmt(line.excelTotal)}</TableCell>
                              <TableCell className="text-right text-sm">{fmt(line.dbTotal)}</TableCell>
                              <TableCell className={`text-right text-sm ${Math.abs(lineDiff) < 0.01 ? '' : 'text-destructive'}`}>
                                {fmt(lineDiff)}
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          );
                        })}
                      </>
                    );
                  })}
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
