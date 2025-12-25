import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, FileText, Upload, Loader2, CheckCircle2, AlertCircle, FileArchive, Play, LogOut, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface RestoreProgress {
  structure: 'idle' | 'parsing' | 'executing' | 'done' | 'error';
  data: 'idle' | 'parsing' | 'executing' | 'done' | 'error';
}

interface TableRestoreItem {
  tableName: string;
  rowsToInsert: number;
  rowsInserted: number;
  status: 'pending' | 'inserting' | 'done' | 'error';
  errorMessage?: string;
}

interface SystemState {
  tableExists: boolean;
  usersCount: number;
  needsRestore: boolean;
  needsInitialUser: boolean;
}

const SystemRestore = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false);
  const [userConfirmedRestore, setUserConfirmedRestore] = useState(false);
  
  const [progress, setProgress] = useState<RestoreProgress>({ structure: 'idle', data: 'idle' });
  const [structureFile, setStructureFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [structurePreview, setStructurePreview] = useState<string[]>([]);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [tableRestoreList, setTableRestoreList] = useState<TableRestoreItem[]>([]);
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const [totalRowsInserted, setTotalRowsInserted] = useState(0);
  const [totalRowsExpected, setTotalRowsExpected] = useState(0);
  const [isRestoreComplete, setIsRestoreComplete] = useState(false);
  const [restoreErrors, setRestoreErrors] = useState<string[]>([]);
  
  const structureInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  // Check system state on mount
  useEffect(() => {
    checkSystemState();
  }, []);

  const checkSystemState = async () => {
    setCheckingSystem(true);
    try {
      const { getSystemState } = await import("@/lib/systemState");
      const data = await getSystemState();

      setSystemState(data);

      // If database needs restore, show confirmation dialog
      if (data.needsRestore) {
        setShowRestoreConfirmation(true);
      } else {
        // Database is fine, user came here from menu - allow access
        setUserConfirmedRestore(true);
      }
    } catch (error) {
      console.error("Error checking system state:", error);
      // If error, assume user came here intentionally
      setSystemState(null);
      setUserConfirmedRestore(true);
    } finally {
      setCheckingSystem(false);
    }
  };

  const handleConfirmRestore = () => {
    setShowRestoreConfirmation(false);
    setUserConfirmedRestore(true);
  };

  const handleDeclineRestore = () => {
    setShowRestoreConfirmation(false);
    navigate("/auth");
  };

  const handleStructureFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.sql')) {
      toast.error(isRTL ? 'يرجى اختيار ملف SQL' : 'Please select a .sql file');
      return;
    }
    
    setStructureFile(file);
    
    // Preview first few lines
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('--')).slice(0, 10);
      setStructurePreview(lines);
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  const handleDataFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.sql.gz') && !file.name.endsWith('.sql')) {
      toast.error(isRTL ? 'يرجى اختيار ملف SQL أو SQL.GZ' : 'Please select a .sql or .sql.gz file');
      return;
    }
    
    setDataFile(file);
  };

  const decompressGzip = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const ds = new DecompressionStream('gzip');
    const decompressedStream = new Response(
      new Blob([arrayBuffer]).stream().pipeThrough(ds)
    ).body;
    
    if (!decompressedStream) throw new Error('Failed to create decompression stream');
    
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new TextDecoder().decode(result);
  };

  const parseInsertStatements = (sql: string): Map<string, string[]> => {
    const tableInserts = new Map<string, string[]>();
    
    // Match INSERT INTO statements
    const insertRegex = /INSERT\s+INTO\s+(?:public\.)?(\w+)\s*\([^)]+\)\s*VALUES\s*\([^;]+\);?/gi;
    let match;
    
    while ((match = insertRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const statement = match[0];
      
      if (!tableInserts.has(tableName)) {
        tableInserts.set(tableName, []);
      }
      tableInserts.get(tableName)!.push(statement);
    }
    
    return tableInserts;
  };

  const handleRestoreStructure = async () => {
    if (!structureFile) {
      toast.error(isRTL ? 'يرجى اختيار ملف الهيكل أولاً' : 'Please select a structure file first');
      return;
    }
    
    setProgress(prev => ({ ...prev, structure: 'parsing' }));
    setRestoreErrors([]);
    
    try {
      const sql = await structureFile.text();
      
      // Split into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      setProgress(prev => ({ ...prev, structure: 'executing' }));
      
      const errors: string[] = [];
      let successCount = 0;
      
      for (const statement of statements) {
        try {
          // Execute via exec_sql function
          const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (error) {
            errors.push(`Statement error: ${error.message}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          errors.push(`Execution error: ${err.message}`);
        }
      }
      
      if (errors.length > 0) {
        setRestoreErrors(errors);
        setProgress(prev => ({ ...prev, structure: 'error' }));
        toast.warning(
          isRTL 
            ? `تم تنفيذ ${successCount} عبارة مع ${errors.length} أخطاء` 
            : `Executed ${successCount} statements with ${errors.length} errors`
        );
      } else {
        setProgress(prev => ({ ...prev, structure: 'done' }));
        toast.success(
          isRTL 
            ? `تم استعادة الهيكل بنجاح (${successCount} عبارة)` 
            : `Structure restored successfully (${successCount} statements)`
        );
      }
    } catch (error: any) {
      console.error('Error restoring structure:', error);
      setProgress(prev => ({ ...prev, structure: 'error' }));
      toast.error(error.message || (isRTL ? 'فشل في استعادة الهيكل' : 'Failed to restore structure'));
    }
  };

  const handleRestoreData = async () => {
    if (!dataFile) {
      toast.error(isRTL ? 'يرجى اختيار ملف البيانات أولاً' : 'Please select a data file first');
      return;
    }
    
    setProgress(prev => ({ ...prev, data: 'parsing' }));
    setShowProgressDialog(true);
    setIsRestoreComplete(false);
    setRestoreErrors([]);
    setTableRestoreList([]);
    setTotalRowsInserted(0);
    setTotalRowsExpected(0);
    
    try {
      let sql: string;
      
      if (dataFile.name.endsWith('.gz')) {
        sql = await decompressGzip(dataFile);
      } else {
        sql = await dataFile.text();
      }
      
      // Parse INSERT statements by table
      const tableInserts = parseInsertStatements(sql);
      
      if (tableInserts.size === 0) {
        toast.error(isRTL ? 'لم يتم العثور على عبارات INSERT' : 'No INSERT statements found');
        setProgress(prev => ({ ...prev, data: 'error' }));
        return;
      }
      
      // Initialize progress list
      const progressList: TableRestoreItem[] = [];
      let totalRows = 0;
      
      tableInserts.forEach((statements, tableName) => {
        progressList.push({
          tableName,
          rowsToInsert: statements.length,
          rowsInserted: 0,
          status: 'pending'
        });
        totalRows += statements.length;
      });
      
      setTableRestoreList(progressList);
      setTotalRowsExpected(totalRows);
      
      // Yield to let UI render
      await new Promise(r => setTimeout(r, 50));
      
      setProgress(prev => ({ ...prev, data: 'executing' }));
      
      const errors: string[] = [];
      let insertedTotal = 0;
      
      // Process each table
      for (let i = 0; i < progressList.length; i++) {
        const item = progressList[i];
        const statements = tableInserts.get(item.tableName)!;
        
        setCurrentTable(item.tableName);
        
        // Update status to inserting
        setTableRestoreList(prev => prev.map((t, idx) => 
          idx === i ? { ...t, status: 'inserting' } : t
        ));
        
        await new Promise(r => setTimeout(r, 10));
        
        let tableInserted = 0;
        
        // Execute in batches of 50
        const batchSize = 50;
        for (let j = 0; j < statements.length; j += batchSize) {
          const batch = statements.slice(j, Math.min(j + batchSize, statements.length));
          const batchSql = batch.join('\n');
          
          try {
            const { error } = await supabase.rpc('exec_sql', { sql: batchSql });
            if (error) {
              errors.push(`${item.tableName}: ${error.message}`);
            } else {
              tableInserted += batch.length;
              insertedTotal += batch.length;
            }
          } catch (err: any) {
            errors.push(`${item.tableName}: ${err.message}`);
          }
          
          // Update progress
          setTableRestoreList(prev => prev.map((t, idx) => 
            idx === i ? { ...t, rowsInserted: tableInserted } : t
          ));
          setTotalRowsInserted(insertedTotal);
          
          // Yield to UI
          await new Promise(r => setTimeout(r, 5));
        }
        
        // Mark as done
        const hasErrors = errors.some(e => e.startsWith(item.tableName));
        setTableRestoreList(prev => prev.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status: hasErrors ? 'error' : 'done',
            rowsInserted: tableInserted 
          } : t
        ));
      }
      
      setCurrentTable(null);
      setIsRestoreComplete(true);
      
      if (errors.length > 0) {
        setRestoreErrors(errors);
        setProgress(prev => ({ ...prev, data: 'error' }));
        toast.warning(
          isRTL 
            ? `تم إدراج ${insertedTotal} صف مع ${errors.length} أخطاء` 
            : `Inserted ${insertedTotal} rows with ${errors.length} errors`
        );
      } else {
        setProgress(prev => ({ ...prev, data: 'done' }));
        toast.success(
          isRTL 
            ? `تم استعادة البيانات بنجاح (${insertedTotal} صف)` 
            : `Data restored successfully (${insertedTotal} rows)`
        );
      }
    } catch (error: any) {
      console.error('Error restoring data:', error);
      setProgress(prev => ({ ...prev, data: 'error' }));
      setIsRestoreComplete(true);
      toast.error(error.message || (isRTL ? 'فشل في استعادة البيانات' : 'Failed to restore data'));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'parsing':
      case 'executing':
      case 'inserting':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return null;
    }
  };

  const overallProgress = totalRowsExpected > 0 
    ? Math.round((totalRowsInserted / totalRowsExpected) * 100) 
    : 0;

  // Show loading state while checking system
  if (checkingSystem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              {isRTL ? 'جاري فحص حالة النظام...' : 'Checking system state...'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show confirmation dialog when database needs restore
  if (showRestoreConfirmation && !userConfirmedRestore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-lg mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-xl">
              {isRTL ? 'لم يتم العثور على جداول قاعدة البيانات' : 'Database Tables Not Found'}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {isRTL 
                ? 'النظام لم يتمكن من العثور على أي جداول في قاعدة البيانات. هل تريد استعادة قاعدة البيانات؟' 
                : 'The system could not find any tables in the database. Do you want to restore the database?'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              {isRTL ? (
                <ul className="list-disc list-inside space-y-1">
                  <li>ستحتاج إلى ملف هيكل قاعدة البيانات (.sql)</li>
                  <li>ستحتاج إلى ملف البيانات (.sql.gz أو .sql)</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  <li>You will need a database structure file (.sql)</li>
                  <li>You will need a data file (.sql.gz or .sql)</li>
                </ul>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDeclineRestore}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {isRTL ? 'لا، العودة' : 'No, Go Back'}
              </Button>
              <Button
                onClick={handleConfirmRestore}
                className="flex-1"
              >
                <Database className="h-4 w-4 mr-2" />
                {isRTL ? 'نعم، استعادة' : 'Yes, Restore'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`container mx-auto p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {isRTL ? 'استعادة النظام' : 'System Restore'}
        </h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Structure Restore Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {isRTL ? 'استعادة هيكل قاعدة البيانات' : 'Restore Database Structure'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'استعادة الجداول والفهارس والسياسات من ملف SQL' 
                : 'Restore tables, indexes, and policies from SQL file'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={structureInputRef}
              type="file"
              accept=".sql"
              className="hidden"
              onChange={handleStructureFileSelect}
            />
            
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => structureInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isRTL ? 'اختر ملف الهيكل (.sql)' : 'Select Structure File (.sql)'}
              </Button>
              
              {structureFile && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{structureFile.name}</span>
                    <Badge variant="secondary">{(structureFile.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                  
                  {structurePreview.length > 0 && (
                    <div className="text-xs text-muted-foreground bg-background p-2 rounded max-h-24 overflow-auto font-mono">
                      {structurePreview.map((line, i) => (
                        <div key={i} className="truncate">{line.substring(0, 80)}...</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <Button
                onClick={handleRestoreStructure}
                disabled={!structureFile || progress.structure === 'parsing' || progress.structure === 'executing'}
                className="w-full"
              >
                {progress.structure === 'parsing' || progress.structure === 'executing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isRTL ? 'جاري الاستعادة...' : 'Restoring...'}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {isRTL ? 'استعادة الهيكل' : 'Restore Structure'}
                  </>
                )}
              </Button>
              
              {progress.structure === 'done' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {isRTL ? 'تم استعادة الهيكل بنجاح' : 'Structure restored successfully'}
                </div>
              )}
              
              {progress.structure === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {isRTL ? 'حدثت أخطاء أثناء الاستعادة' : 'Errors occurred during restore'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Restore Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="h-5 w-5" />
              {isRTL ? 'استعادة بيانات قاعدة البيانات' : 'Restore Database Data'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'استعادة البيانات من ملف SQL مضغوط' 
                : 'Restore data from compressed SQL file'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={dataInputRef}
              type="file"
              accept=".sql,.sql.gz,.gz"
              className="hidden"
              onChange={handleDataFileSelect}
            />
            
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={() => dataInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isRTL ? 'اختر ملف البيانات (.sql.gz)' : 'Select Data File (.sql.gz)'}
              </Button>
              
              {dataFile && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileArchive className="h-4 w-4" />
                    <span className="font-medium">{dataFile.name}</span>
                    <Badge variant="secondary">{(dataFile.size / (1024 * 1024)).toFixed(2)} MB</Badge>
                  </div>
                </div>
              )}
              
              <Button
                onClick={handleRestoreData}
                disabled={!dataFile || progress.data === 'parsing' || progress.data === 'executing'}
                className="w-full"
              >
                {progress.data === 'parsing' || progress.data === 'executing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isRTL ? 'جاري الاستعادة...' : 'Restoring...'}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {isRTL ? 'استعادة البيانات' : 'Restore Data'}
                  </>
                )}
              </Button>
              
              {progress.data === 'done' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {isRTL ? 'تم استعادة البيانات بنجاح' : 'Data restored successfully'}
                </div>
              )}
              
              {progress.data === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {isRTL ? 'حدثت أخطاء أثناء الاستعادة' : 'Errors occurred during restore'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Errors Display */}
      {restoreErrors.length > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {isRTL ? 'أخطاء الاستعادة' : 'Restore Errors'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-1 font-mono text-sm">
                {restoreErrors.map((error, i) => (
                  <div key={i} className="text-destructive p-2 bg-destructive/10 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isRestoreComplete ? (
                progress.data === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              {isRTL ? 'تقدم استعادة البيانات' : 'Data Restore Progress'}
            </DialogTitle>
            <DialogDescription>
              {isRestoreComplete
                ? (isRTL ? 'اكتملت عملية الاستعادة' : 'Restore operation completed')
                : (isRTL ? `جاري استعادة: ${currentTable || '...'}` : `Restoring: ${currentTable || '...'}`)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{isRTL ? 'التقدم الإجمالي' : 'Overall Progress'}</span>
                <span>{totalRowsInserted.toLocaleString()} / {totalRowsExpected.toLocaleString()} ({overallProgress}%)</span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </div>
            
            {/* Table Progress List */}
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'الجدول' : 'Table'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الصفوف' : 'Rows'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRestoreList.map((item, idx) => (
                    <TableRow key={idx} className={item.status === 'inserting' ? 'bg-primary/5' : ''}>
                      <TableCell className="font-mono text-sm">{item.tableName}</TableCell>
                      <TableCell className="text-center">
                        {item.rowsInserted} / {item.rowsToInsert}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(item.status)}
                          <Badge variant={
                            item.status === 'done' ? 'default' :
                            item.status === 'error' ? 'destructive' :
                            item.status === 'inserting' ? 'secondary' :
                            'outline'
                          }>
                            {item.status}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          
          {/* Logout button after restore completes */}
          {isRestoreComplete && (
            <div className="flex justify-center pt-4 border-t">
              <Button 
                onClick={() => {
                  sessionStorage.removeItem("sysadmin_session");
                  navigate("/auth");
                }}
                className="w-full"
              >
                <LogOut className="h-4 w-4 me-2" />
                {isRTL ? 'الذهاب إلى تسجيل الدخول' : 'Go to Login'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemRestore;
