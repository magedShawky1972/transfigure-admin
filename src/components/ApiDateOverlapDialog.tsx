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
import { Loader2, AlertTriangle, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface DateSummary {
  date: string;
  dbCount: number;
  dbTotal: number;
  dbSources: string[];
  excelCount: number;
  excelTotal: number;
}

interface OrderDiff {
  orderNumber: string;
  dbTotal: number;
  dbCount: number;
  excelTotal: number;
  excelCount: number;
  status: 'match' | 'different' | 'db_only' | 'excel_only';
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [orderDiffs, setOrderDiffs] = useState<OrderDiff[]>([]);
  const [detailsFilter, setDetailsFilter] = useState<'all' | 'different' | 'db_only' | 'excel_only'>('all');

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

      const dbByDate = new Map<string, { count: number; total: number; sources: Set<string> }>();
      for (const dateStr of overlappingDates) {
        const dayStart = `${dateStr}T00:00:00`;
        const dayEnd = `${dateStr}T23:59:59.999`;
        const entry = { count: 0, total: 0, sources: new Set<string>() };
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data } = await supabase
            .from('purpletransaction')
            .select('total, source')
            .gte('created_at_date', dayStart)
            .lte('created_at_date', dayEnd)
            .range(from, from + pageSize - 1);
          if (!data || data.length === 0) break;
          data.forEach((row: any) => {
            entry.count++;
            entry.total += parseFloat(String(row.total)) || 0;
            if (row.source) entry.sources.add(row.source);
          });
          if (data.length < pageSize) break;
          from += pageSize;
        }
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

  const loadDetails = async (dateStr: string) => {
    if (expandedDate === dateStr) {
      setExpandedDate(null);
      return;
    }
    setExpandedDate(dateStr);
    setDetailsLoading(true);
    setDetailsFilter('all');
    try {
      const dayStart = `${dateStr}T00:00:00`;
      const dayEnd = `${dateStr}T23:59:59.999`;
      const dbOrders = new Map<string, { total: number; count: number }>();
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from('purpletransaction')
          .select('order_number, total')
          .gte('created_at_date', dayStart)
          .lte('created_at_date', dayEnd)
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        data.forEach((row: any) => {
          const canonicalOrder = String(row.order_number || 'unknown').trim();
          const existing = dbOrders.get(canonicalOrder) || { total: 0, count: 0 };
          existing.total += parseFloat(String(row.total).replace(/[,\s]/g, '')) || 0;
          existing.count++;
          dbOrders.set(canonicalOrder, existing);
        });
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const keys = excelData.length > 0 ? Object.keys(excelData[0]) : [];
      const totalKey = findKey(keys, 'total') || keys.find(k => k.toLowerCase() === 'total');
      const dateKey = findKey(keys, 'createdatdate', 'createatdate', 'createdat', 'createddate') ||
        keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes('createdatdate'));
      const orderKey = findKey(keys, 'ordernumber', 'orderno', 'order_number') ||
        keys.find(k => {
          const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalized === 'ordernumber' || normalized === 'orderno';
        });

      const excelOrders = new Map<string, { total: number; count: number }>();
      excelData.forEach((row: any) => {
        let rowDate: string | null = null;
        if (dateKey) {
          const raw = row[dateKey];
          if (raw) {
            const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/);
            if (m) rowDate = m[1];
          }
        }
        if (rowDate !== dateStr && overlappingDates.length === 1) rowDate = dateStr;
        if (rowDate !== dateStr) return;

        const canonicalOrder = orderKey ? String(row[orderKey] || 'unknown').trim() : 'unknown';
        const rowTotal = totalKey ? (parseFloat(String(row[totalKey]).replace(/[,\s]/g, '')) || 0) : 0;
        const existing = excelOrders.get(canonicalOrder) || { total: 0, count: 0 };
        existing.total += rowTotal;
        existing.count++;
        excelOrders.set(canonicalOrder, existing);
      });

      const allOrderNumbers = new Set([...dbOrders.keys(), ...excelOrders.keys()]);
      const diffs: OrderDiff[] = [];
      allOrderNumbers.forEach((on) => {
        const db = dbOrders.get(on);
        const ex = excelOrders.get(on);
        let status: OrderDiff['status'] = 'match';
        if (db && !ex) status = 'db_only';
        else if (!db && ex) status = 'excel_only';
        else if (db && ex && Math.abs(db.total - ex.total) > 0.01) status = 'different';
        diffs.push({
          orderNumber: on,
          dbTotal: db?.total || 0,
          dbCount: db?.count || 0,
          excelTotal: ex?.total || 0,
          excelCount: ex?.count || 0,
          status,
        });
      });
      diffs.sort((a, b) => Math.abs(b.excelTotal - b.dbTotal) - Math.abs(a.excelTotal - a.dbTotal));
      setOrderDiffs(diffs);
    } catch (err) {
      console.error('Error loading details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const differenceOrders = orderDiffs.filter(d => Math.abs(d.excelTotal - d.dbTotal) > 0.01);
  const filteredDiffs = detailsFilter === 'all'
    ? orderDiffs
    : detailsFilter === 'different'
      ? [...differenceOrders].sort((a, b) => Math.abs(b.excelTotal - b.dbTotal) - Math.abs(a.excelTotal - a.dbTotal))
      : orderDiffs.filter(d => d.status === detailsFilter);
  const diffCounts = {
    all: orderDiffs.length,
    different: differenceOrders.length,
    db_only: orderDiffs.filter(d => d.status === 'db_only').length,
    excel_only: orderDiffs.filter(d => d.status === 'excel_only').length,
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
                      <TableHead className="text-center">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateSummaries.map((d) => (
                      <>
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
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadDetails(d.date)}
                              className="h-7 px-2 text-xs"
                            >
                              {expandedDate === d.date ? (
                                <><ChevronUp className="h-3 w-3 mr-1" /> Hide</>
                              ) : (
                                <><ChevronDown className="h-3 w-3 mr-1" /> Details</>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedDate === d.date && (
                          <TableRow key={`${d.date}-details`}>
                            <TableCell colSpan={8} className="p-0">
                              <div className="bg-muted/30 p-3 border-t">
                                {detailsLoading ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading order details...</span>
                                  </div>
                                ) : (
                                  <>
                                    {/* Difference breakdown summary */}
                                    {(() => {
                                      const matchOrders = orderDiffs.filter(o => o.status === 'match');
                                      const diffOrders = orderDiffs.filter(o => o.status === 'different');
                                      const dbOnlyOrders = orderDiffs.filter(o => o.status === 'db_only');
                                      const excelOnlyOrders = orderDiffs.filter(o => o.status === 'excel_only');
                                      const dbOnlyTotal = dbOnlyOrders.reduce((s, o) => s + o.dbTotal, 0);
                                      const excelOnlyTotal = excelOnlyOrders.reduce((s, o) => s + o.excelTotal, 0);
                                      const matchTotal = matchOrders.reduce((s, o) => s + o.dbTotal, 0);
                                      const diffDbTotal = diffOrders.reduce((s, o) => s + o.dbTotal, 0);
                                      const diffExTotal = diffOrders.reduce((s, o) => s + o.excelTotal, 0);
                                      const netDiff = excelOnlyTotal - dbOnlyTotal + (diffExTotal - diffDbTotal);
                                      return (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-xs">
                                          <div className="rounded border border-green-500/30 bg-green-500/5 p-2 text-center">
                                            <p className="text-muted-foreground">Matched</p>
                                            <p className="font-bold text-green-500">{matchOrders.length} orders</p>
                                            <p className="text-muted-foreground">{matchTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                          </div>
                                          <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-2 text-center">
                                            <p className="text-muted-foreground">Different Totals</p>
                                            <p className="font-bold text-yellow-500">{diffOrders.length} orders</p>
                                            <p className="text-muted-foreground">Δ {(diffExTotal - diffDbTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                          </div>
                                          <div className="rounded border border-blue-500/30 bg-blue-500/5 p-2 text-center">
                                            <p className="text-muted-foreground">DB Only</p>
                                            <p className="font-bold text-blue-500">{dbOnlyOrders.length} orders</p>
                                            <p className="text-muted-foreground">-{dbOnlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                          </div>
                                          <div className="rounded border border-primary/30 bg-primary/5 p-2 text-center">
                                            <p className="text-muted-foreground">Excel Only (New)</p>
                                            <p className="font-bold text-primary">{excelOnlyOrders.length} orders</p>
                                            <p className="text-muted-foreground">+{excelOnlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    {diffCounts.db_only > 0 && diffCounts.excel_only > 0 && diffCounts.different === 0 && (
                                      <div className="mb-2 p-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-muted-foreground">
                                        <strong>Note:</strong> API and Excel use different order numbers, so orders cannot be matched individually. 
                                        The +{((d.excelTotal - d.dbTotal)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} difference reflects the net total gap between all DB-only and Excel-only orders.
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <span className="text-xs font-medium text-muted-foreground">Filter:</span>
                                      {(['all', 'different', 'db_only', 'excel_only'] as const).map(f => (
                                        <Badge
                                          key={f}
                                          variant={detailsFilter === f ? 'default' : 'outline'}
                                          className="cursor-pointer text-xs"
                                          onClick={() => setDetailsFilter(f)}
                                        >
                                          {f === 'all' ? 'All' : f === 'different' ? 'Diff' : f === 'db_only' ? 'DB Only' : 'Excel Only'}
                                          {' '}({diffCounts[f]})
                                        </Badge>
                                      ))}
                                    </div>
                                    <div className="max-h-48 overflow-auto rounded border bg-background">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs">Order #</TableHead>
                                            <TableHead className="text-xs text-center">Status</TableHead>
                                            <TableHead className="text-xs text-center">DB Lines</TableHead>
                                            <TableHead className="text-xs text-right">DB Total</TableHead>
                                            <TableHead className="text-xs text-center">Excel Lines</TableHead>
                                            <TableHead className="text-xs text-right">Excel Total</TableHead>
                                            <TableHead className="text-xs text-right">Diff</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {filteredDiffs.length === 0 ? (
                                            <TableRow>
                                              <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-3">
                                                No records match this filter
                                              </TableCell>
                                            </TableRow>
                                          ) : filteredDiffs.slice(0, 200).map((od) => (
                                            <TableRow key={od.orderNumber} className="text-xs">
                                              <TableCell className="font-mono py-1">{od.orderNumber}</TableCell>
                                              <TableCell className="text-center py-1">
                                                <Badge variant="outline" className={`text-[10px] ${
                                                  od.status === 'match' ? 'border-green-500 text-green-500' :
                                                  od.status === 'different' ? 'border-yellow-500 text-yellow-500' :
                                                  od.status === 'db_only' ? 'border-blue-500 text-blue-500' :
                                                  'border-primary text-primary'
                                                }`}>
                                                  {od.status === 'match' ? '✓ Match' : od.status === 'different' ? '≠ Diff' : od.status === 'db_only' ? 'DB Only' : 'New'}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-center py-1">{od.dbCount || '-'}</TableCell>
                                              <TableCell className="text-right font-mono py-1">{od.dbTotal ? od.dbTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                              <TableCell className="text-center py-1">{od.excelCount || '-'}</TableCell>
                                              <TableCell className="text-right font-mono py-1">{od.excelTotal ? od.excelTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</TableCell>
                                              <TableCell className="text-right font-mono py-1">
                                                {od.status !== 'match' ? (
                                                  <span className={od.excelTotal - od.dbTotal > 0 ? 'text-green-500' : 'text-destructive'}>
                                                    {(od.excelTotal - od.dbTotal) > 0 ? '+' : ''}{(od.excelTotal - od.dbTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </span>
                                                ) : '-'}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                      {filteredDiffs.length > 200 && (
                                        <p className="text-xs text-muted-foreground text-center py-1">
                                          Showing first 200 of {filteredDiffs.length} orders
                                        </p>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
