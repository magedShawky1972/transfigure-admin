import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Archive, Upload } from "lucide-react";

interface TableProgress {
  tableName: string;
  rowsFetched: number;
  totalRows: number;
  chunksTotal: number;
  chunksFetched: number;
  status: 'pending' | 'fetching' | 'done' | 'error';
}

interface BackupProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tables: TableProgress[];
  currentTable: string | null;
  currentChunk: number;
  totalChunks: number;
  totalRowsFetched: number;
  totalRowsExpected: number;
  isComplete: boolean;
  isRTL: boolean;
  backupPhase?: 'fetching' | 'compressing' | 'uploading' | 'complete';
}

export const BackupProgressDialog = ({
  isOpen,
  tables,
  currentTable,
  currentChunk,
  totalChunks,
  totalRowsFetched,
  totalRowsExpected,
  isComplete,
  isRTL,
  backupPhase = 'fetching'
}: BackupProgressDialogProps) => {
  const overallProgress = totalRowsExpected > 0 
    ? Math.min(100, (totalRowsFetched / totalRowsExpected) * 100) 
    : 0;

  const completedTables = tables.filter(t => t.status === 'done').length;
  const totalTables = tables.length;

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {isRTL ? 'تقدم النسخ الاحتياطي للبيانات' : 'Data Backup Progress'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {isRTL ? 'التقدم الكلي' : 'Overall Progress'}
              </span>
              <span className="font-medium">
                {totalRowsFetched.toLocaleString()} / {totalRowsExpected.toLocaleString()} {isRTL ? 'سجل' : 'rows'}
              </span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {completedTables} / {totalTables} {isRTL ? 'جداول' : 'tables'}
              </span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
          </div>

          {/* Current Table with Chunk Progress */}
          {currentTable && !isComplete && (
            <div className="p-3 bg-primary/10 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {isRTL ? 'جاري جلب:' : 'Fetching:'} <code className="bg-muted px-1 rounded">{currentTable}</code>
                </span>
              </div>
              {totalChunks > 1 && (
                <div className="text-xs text-muted-foreground">
                  {isRTL ? `الجزء ${currentChunk} من ${totalChunks}` : `Chunk ${currentChunk} of ${totalChunks}`}
                </div>
              )}
            </div>
          )}

          {/* Tables List */}
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
            {tables.map((table) => (
              <div 
                key={table.tableName}
                className={`flex items-center justify-between py-1.5 px-2 rounded text-sm ${
                  table.status === 'fetching' ? 'bg-primary/10' : 
                  table.status === 'done' ? 'bg-green-500/10' : 
                  table.status === 'error' ? 'bg-destructive/10' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {table.status === 'fetching' && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
                  )}
                  {table.status === 'done' && (
                    <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  )}
                  {table.status === 'pending' && (
                    <div className="h-3 w-3 rounded-full border border-muted-foreground/30 flex-shrink-0" />
                  )}
                  <span className="font-mono text-xs truncate">{table.tableName}</span>
                  {table.chunksTotal > 1 && table.status === 'fetching' && (
                    <span className="text-xs text-muted-foreground">
                      ({table.chunksFetched}/{table.chunksTotal})
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {table.status === 'done' ? table.rowsFetched.toLocaleString() : 
                   table.status === 'fetching' ? `${table.rowsFetched.toLocaleString()}...` : 
                   table.totalRows.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Post-processing phases */}
          {backupPhase === 'compressing' && (
            <div className="p-3 bg-amber-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-amber-600 animate-pulse" />
                <span className="text-sm font-medium text-amber-700">
                  {isRTL ? 'جاري ضغط البيانات...' : 'Compressing data...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? 'قد يستغرق هذا بعض الوقت للملفات الكبيرة' : 'This may take a moment for large files'}
              </p>
            </div>
          )}

          {backupPhase === 'uploading' && (
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600 animate-pulse" />
                <span className="text-sm font-medium text-blue-700">
                  {isRTL ? 'جاري رفع الملف إلى التخزين...' : 'Uploading to storage...'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? 'يرجى عدم إغلاق هذه النافذة' : 'Please do not close this window'}
              </p>
            </div>
          )}

          {isComplete && backupPhase === 'complete' && (
            <div className="p-3 bg-green-500/10 rounded-lg text-center">
              <p className="text-sm font-medium text-green-600">
                {isRTL ? 'اكتمل النسخ الاحتياطي بنجاح!' : 'Backup completed successfully!'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};