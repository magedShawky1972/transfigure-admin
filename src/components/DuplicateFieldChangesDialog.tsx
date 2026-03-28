import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertTriangle, RefreshCw, SkipForward, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

interface FieldChange {
  field: string;
  dbValue: any;
  excelValue: any;
}

interface RecordFieldChange {
  key: string;
  keyParts: Record<string, string>;
  changes: FieldChange[];
}

interface DuplicateFieldChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldChanges: RecordFieldChange[];
  totalRecords: number;
  duplicateCount: number;
  newRecordCount: number;
  onAction: (action: 'update' | 'skip' | 'cancel') => void;
  duplicateKeyColumn?: string;
  duplicateMessage?: string;
}

export function DuplicateFieldChangesDialog({
  open,
  onOpenChange,
  fieldChanges,
  totalRecords,
  duplicateCount,
  newRecordCount,
  onAction,
  duplicateKeyColumn,
  duplicateMessage,
}: DuplicateFieldChangesDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const handleAction = (action: 'update' | 'skip' | 'cancel') => {
    setIsProcessing(true);
    onAction(action);
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(fieldChanges.map(fc => fc.key)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '(empty)';
    if (val === '') return '(empty)';
    return String(val);
  };

  const noChangesCount = duplicateCount - fieldChanges.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !isProcessing && onOpenChange(o)}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Records Update Preview
          </DialogTitle>
          <DialogDescription>
            {duplicateMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 text-sm flex-wrap">
            <Badge variant="outline" className="bg-green-500/10 text-green-600">
              {newRecordCount} New
            </Badge>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
              {fieldChanges.length} Will Update
            </Badge>
            {noChangesCount > 0 && (
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                {noChangesCount} No Changes
              </Badge>
            )}
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
              {totalRecords} Total
            </Badge>
          </div>

          {fieldChanges.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Field Changes Detail ({fieldChanges.length} records):
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">
                    Collapse All
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="h-[400px] rounded-md border">
                <div className="p-2 space-y-1">
                  {fieldChanges.map((record, idx) => {
                    const isExpanded = expandedKeys.has(record.key);
                    const keyDisplay = Object.entries(record.keyParts)
                      .map(([col, val]) => `${col}: ${val}`)
                      .join(' | ');
                    
                    return (
                      <Collapsible key={idx} open={isExpanded} onOpenChange={() => toggleExpanded(record.key)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer border border-border/50">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-mono text-xs">{keyDisplay}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {record.changes.length} field{record.changes.length > 1 ? 's' : ''}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 mb-2 rounded-md border overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="h-8 text-xs w-[25%]">Field</TableHead>
                                  <TableHead className="h-8 text-xs w-[30%]">DB Value</TableHead>
                                  <TableHead className="h-8 text-xs w-[15px]"></TableHead>
                                  <TableHead className="h-8 text-xs w-[30%]">Excel Value</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {record.changes.map((change, cIdx) => (
                                  <TableRow key={cIdx} className="hover:bg-muted/30">
                                    <TableCell className="py-1.5 text-xs font-medium">
                                      {change.field}
                                    </TableCell>
                                    <TableCell className="py-1.5 text-xs">
                                      <span className={change.dbValue === null || change.dbValue === undefined || change.dbValue === '' 
                                        ? 'text-muted-foreground italic' 
                                        : 'text-destructive'}>
                                        {formatValue(change.dbValue)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-1.5">
                                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    </TableCell>
                                    <TableCell className="py-1.5 text-xs">
                                      <span className="text-green-600 font-medium">
                                        {formatValue(change.excelValue)}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {fieldChanges.length === 0 && duplicateCount > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">All {duplicateCount} duplicate records are identical — no fields will change.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleAction('cancel')}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleAction('skip')}
            disabled={isProcessing}
            className="gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Skip Duplicates (Insert New Only)
          </Button>
          <Button
            onClick={() => handleAction('update')}
            disabled={isProcessing}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Update Existing Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
