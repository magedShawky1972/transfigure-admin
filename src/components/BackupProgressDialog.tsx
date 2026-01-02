import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Archive, Upload, Database, AlertCircle } from "lucide-react";

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
  errorMessage?: string;
}

export const BackupProgressDialog = ({
  isOpen,
  onClose,
  tables,
  currentTable,
  currentChunk,
  totalChunks,
  totalRowsFetched,
  totalRowsExpected,
  isComplete,
  isRTL,
  backupPhase = 'fetching',
  errorMessage
}: BackupProgressDialogProps) => {
  const overallProgress = totalRowsExpected > 0 
    ? Math.min(100, (totalRowsFetched / totalRowsExpected) * 100) 
    : 0;

  const completedTables = tables.filter(t => t.status === 'done').length;
  const totalTables = tables.length;

  // Step indicator
  const steps = [
    { key: 'fetching', label: isRTL ? 'جلب البيانات' : 'Fetching Data', icon: Database },
    { key: 'compressing', label: isRTL ? 'ضغط البيانات' : 'Compressing', icon: Archive },
    { key: 'uploading', label: isRTL ? 'رفع الملف' : 'Uploading', icon: Upload },
    { key: 'complete', label: isRTL ? 'اكتمل' : 'Complete', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === backupPhase);

  // Allow closing only when complete or on error
  const canClose = isComplete || !!errorMessage;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && canClose && onClose()}>
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
          <DialogDescription>
            {isRTL ? 'يرجى عدم إغلاق النافذة حتى اكتمال العملية' : 'Please do not close this window until the process is complete'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step Progress Indicator */}
          <div className="flex items-center justify-between px-2 py-3 bg-muted/50 rounded-lg">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === currentStepIndex;
              const isCompleted = idx < currentStepIndex;
              const isPending = idx > currentStepIndex;
              
              return (
                <div key={step.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full transition-all
                    ${isActive ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' : ''}
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isPending ? 'bg-muted-foreground/20 text-muted-foreground' : ''}
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={`text-xs text-center ${isActive ? 'font-semibold text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current Phase Status */}
          {backupPhase === 'fetching' && (
            <div className="p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">
                  {isRTL ? 'جاري جلب البيانات من قاعدة البيانات...' : 'Fetching data from database...'}
                </span>
              </div>
              {currentTable && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? 'الجدول الحالي:' : 'Current table:'} <code className="bg-muted px-1 rounded">{currentTable}</code>
                  {totalChunks > 1 && ` (${currentChunk}/${totalChunks})`}
                </p>
              )}
            </div>
          )}

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
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {isRTL ? 'اكتمل النسخ الاحتياطي بنجاح!' : 'Backup completed successfully!'}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-destructive/10 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {isRTL ? 'حدث خطأ' : 'An error occurred'}
                </span>
              </div>
              <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
            </div>
          )}

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

          {/* Tables List */}
          <div className="max-h-[250px] overflow-y-auto space-y-1 pr-2">
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
                  {table.status === 'error' && (
                    <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
};