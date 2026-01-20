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
import { AlertTriangle, RefreshCw, SkipForward } from "lucide-react";

interface DuplicateInfo {
  key: string;
  existingCount: number;
  newCount: number;
}

interface DuplicateRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateInfo[];
  totalNewRecords: number;
  totalDuplicates: number;
  onAction: (action: 'update' | 'skip' | 'cancel') => void;
  duplicateKeyColumn?: string;
  duplicateMessage?: string;
}

export function DuplicateRecordsDialog({
  open,
  onOpenChange,
  duplicates,
  totalNewRecords,
  totalDuplicates,
  onAction,
  duplicateKeyColumn,
  duplicateMessage,
}: DuplicateRecordsDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = (action: 'update' | 'skip' | 'cancel') => {
    setIsProcessing(true);
    onAction(action);
  };

  const handleClose = () => {
    if (!isProcessing) {
      onAction('cancel');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isProcessing && onOpenChange(o)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Records Detected
          </DialogTitle>
          <DialogDescription>
            {duplicateMessage || `Found ${totalDuplicates} records that already exist in the database.`}
            {' '}Choose how to handle them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-600">
                {totalNewRecords - totalDuplicates} New
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                {totalDuplicates} Duplicates
              </Badge>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Duplicate {duplicateKeyColumn || 'keys'}:
              </p>
              <ScrollArea className="h-[200px] rounded-md border p-3">
                <div className="space-y-1">
                  {duplicates.slice(0, 50).map((dup, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                    >
                      <span className="font-mono text-xs">{dup.key}</span>
                      <Badge variant="secondary" className="text-xs">
                        {dup.existingCount} existing
                      </Badge>
                    </div>
                  ))}
                  {duplicates.length > 50 && (
                    <p className="text-xs text-muted-foreground pt-2">
                      ... and {duplicates.length - 50} more
                    </p>
                  )}
                </div>
              </ScrollArea>
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
