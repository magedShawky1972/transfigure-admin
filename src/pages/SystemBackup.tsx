import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Database, FileText, Loader2, CheckCircle2, AlertCircle, RefreshCw, Trash2, Clock, HardDrive } from "lucide-react";
import { BackupProgressDialog } from "@/components/BackupProgressDialog";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface BackupProgress {
  structure: 'idle' | 'loading' | 'done' | 'error';
  data: 'idle' | 'loading' | 'done' | 'error';
}

interface TableProgressItem {
  tableName: string;
  rowsFetched: number;
  totalRows: number;
  chunksTotal: number;
  chunksFetched: number;
  status: 'pending' | 'fetching' | 'done' | 'error';
}

interface BackupRecord {
  id: string;
  backup_type: 'structure' | 'data';
  file_name: string;
  file_path: string;
  file_size: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const SystemBackup = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [progress, setProgress] = useState<BackupProgress>({ structure: 'idle', data: 'idle' });
  const [structureResult, setStructureResult] = useState<any>(null);
  const [dataResult, setDataResult] = useState<any>(null);
  
  // Progress dialog state
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [tableProgressList, setTableProgressList] = useState<TableProgressItem[]>([]);
  const [currentFetchingTable, setCurrentFetchingTable] = useState<string | null>(null);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunksForCurrentTable, setTotalChunksForCurrentTable] = useState(0);
  const [totalRowsFetched, setTotalRowsFetched] = useState(0);
  const [totalRowsExpected, setTotalRowsExpected] = useState(0);
  const [isBackupComplete, setIsBackupComplete] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  
  // Backup history state
  const [backupHistory, setBackupHistory] = useState<BackupRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch backup history on mount
  useEffect(() => {
    fetchBackupHistory();
  }, []);

  const fetchBackupHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('system_backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setBackupHistory((data || []) as BackupRecord[]);
    } catch (error) {
      console.error('Error fetching backup history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const generateStructureSQL = (data: any): string => {
    let sql = '-- Edara Database Structure Backup\n';
    sql += `-- Generated at: ${new Date().toISOString()}\n`;
    sql += '-- ================================================\n\n';

    // Generate CREATE TABLE statements from columns info
    if (data.columns && Array.isArray(data.columns) && data.columns.length > 0) {
      // Group columns by table
      const tableColumns: Record<string, any[]> = {};
      for (const col of data.columns) {
        if (!tableColumns[col.table_name]) {
          tableColumns[col.table_name] = [];
        }
        tableColumns[col.table_name].push(col);
      }

      // Primary keys map
      const pkMap: Record<string, string[]> = {};
      if (data.primaryKeys && Array.isArray(data.primaryKeys)) {
        for (const pk of data.primaryKeys) {
          if (!pkMap[pk.table_name]) {
            pkMap[pk.table_name] = [];
          }
          pkMap[pk.table_name].push(pk.column_name);
        }
      }

      sql += '-- ==================== TABLES ====================\n\n';

      // Table list with row counts
      if (data.tableRowCounts) {
        sql += '-- Table List with Row Counts:\n';
        for (const tableName of Object.keys(tableColumns).sort()) {
          const rowCount = data.tableRowCounts[tableName] || 0;
          sql += `-- ${tableName}: ${rowCount} rows\n`;
        }
        sql += '\n';
      }

      // CREATE TABLE statements
      for (const tableName of Object.keys(tableColumns).sort()) {
        sql += `-- Table: ${tableName}\n`;
        sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
        
        const cols = tableColumns[tableName];
        const colDefs: string[] = [];
        
        for (const col of cols) {
          let colDef = `  ${col.column_name} `;
          
          // Map data type
          if (col.udt_name === 'uuid') {
            colDef += 'UUID';
          } else if (col.udt_name === 'timestamptz') {
            colDef += 'TIMESTAMP WITH TIME ZONE';
          } else if (col.udt_name === 'timestamp') {
            colDef += 'TIMESTAMP WITHOUT TIME ZONE';
          } else if (col.udt_name === 'int4') {
            colDef += 'INTEGER';
          } else if (col.udt_name === 'int8') {
            colDef += 'BIGINT';
          } else if (col.udt_name === 'float8') {
            colDef += 'DOUBLE PRECISION';
          } else if (col.udt_name === 'float4') {
            colDef += 'REAL';
          } else if (col.udt_name === 'bool') {
            colDef += 'BOOLEAN';
          } else if (col.udt_name === 'jsonb') {
            colDef += 'JSONB';
          } else if (col.udt_name === 'json') {
            colDef += 'JSON';
          } else if (col.udt_name === '_text') {
            colDef += 'TEXT[]';
          } else if (col.udt_name === 'varchar' && col.character_maximum_length) {
            colDef += `VARCHAR(${col.character_maximum_length})`;
          } else if (col.udt_name === 'numeric' && col.numeric_precision) {
            colDef += `NUMERIC(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
          } else if (col.data_type) {
            colDef += col.data_type.toUpperCase();
          } else {
            colDef += 'TEXT';
          }
          
          // Default value
          if (col.column_default) {
            colDef += ` DEFAULT ${col.column_default}`;
          }
          
          // Nullable
          if (col.is_nullable === 'NO') {
            colDef += ' NOT NULL';
          }
          
          colDefs.push(colDef);
        }
        
        // Add primary key constraint if exists
        if (pkMap[tableName] && pkMap[tableName].length > 0) {
          colDefs.push(`  PRIMARY KEY (${pkMap[tableName].join(', ')})`);
        }
        
        sql += colDefs.join(',\n');
        sql += '\n);\n\n';
      }
    }

    // Foreign Keys
    if (data.foreignKeys && Array.isArray(data.foreignKeys) && data.foreignKeys.length > 0) {
      sql += '-- ==================== FOREIGN KEYS ====================\n\n';
      for (const fk of data.foreignKeys) {
        sql += `ALTER TABLE public.${fk.table_name}\n`;
        sql += `  ADD CONSTRAINT ${fk.constraint_name}\n`;
        sql += `  FOREIGN KEY (${fk.column_name})\n`;
        sql += `  REFERENCES public.${fk.foreign_table_name}(${fk.foreign_column_name});\n\n`;
      }
    }

    // Indexes
    if (data.indexes && Array.isArray(data.indexes) && data.indexes.length > 0) {
      sql += '-- ==================== INDEXES ====================\n\n';
      for (const idx of data.indexes) {
        // Skip primary key indexes
        if (idx.indexname && !idx.indexname.endsWith('_pkey')) {
          sql += `${idx.indexdef};\n`;
        }
      }
      sql += '\n';
    }

    // Functions
    if (data.functions && Array.isArray(data.functions) && data.functions.length > 0) {
      sql += '-- ==================== FUNCTIONS ====================\n\n';
      for (const func of data.functions) {
        if (func.function_definition) {
          sql += `${func.function_definition};\n\n`;
        }
      }
    }

    // Triggers
    if (data.triggers && Array.isArray(data.triggers) && data.triggers.length > 0) {
      sql += '-- ==================== TRIGGERS ====================\n\n';
      for (const trigger of data.triggers) {
        if (trigger.trigger_name && trigger.event_object_table) {
          sql += `CREATE TRIGGER ${trigger.trigger_name}\n`;
          sql += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
          sql += `  ON public.${trigger.event_object_table}\n`;
          sql += `  FOR EACH ROW\n`;
          sql += `  ${trigger.action_statement};\n\n`;
        }
      }
    }

    // RLS Policies
    if (data.policies && Array.isArray(data.policies) && data.policies.length > 0) {
      sql += '-- ==================== RLS POLICIES ====================\n\n';
      
      // First enable RLS on tables
      const tablesWithRLS = [...new Set(data.policies.map((p: any) => p.tablename))];
      for (const table of tablesWithRLS) {
        sql += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n`;
      }
      sql += '\n';
      
      for (const policy of data.policies) {
        if (policy.policyname && policy.tablename) {
          sql += `CREATE POLICY "${policy.policyname}"\n`;
          sql += `  ON public.${policy.tablename}\n`;
          sql += `  AS ${policy.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'}\n`;
          sql += `  FOR ${policy.cmd}\n`;
          sql += `  TO ${policy.roles || 'public'}\n`;
          if (policy.qual) {
            sql += `  USING (${policy.qual})\n`;
          }
          if (policy.with_check) {
            sql += `  WITH CHECK (${policy.with_check})\n`;
          }
          sql += ';\n\n';
        }
      }
    }

    return sql;
  };

  const generateDataSQL = (dataResultObj: any): string => {
    // dataResultObj can be { tables, truncated, maxRowsPerTable } or raw tableData
    const tableData: Record<string, any[]> = dataResultObj?.tables || dataResultObj || {};
    const truncated: Record<string, boolean> = dataResultObj?.truncated || {};

    let sql = '-- Edara Database Data Backup\n';
    sql += `-- Generated at: ${new Date().toISOString()}\n`;
    sql += '-- ================================================\n\n';

    const escapeValue = (value: any): string => {
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
      return `'${String(value).replace(/'/g, "''")}'`;
    };

    for (const tableName of Object.keys(tableData).sort()) {
      const rows = tableData[tableName];
      if (!rows || rows.length === 0) continue;

      const truncatedNote = truncated[tableName] ? ' (TRUNCATED - more rows exist)' : '';
      sql += `-- ==================== ${tableName.toUpperCase()} (${rows.length} rows)${truncatedNote} ====================\n\n`;
      
      // Get columns from first row
      const columns = Object.keys(rows[0]);
      
      for (const row of rows) {
        const values = columns.map(col => escapeValue(row[col]));
        sql += `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      sql += '\n';
    }

    return sql;
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCompressedFile = async (content: string, filename: string) => {
    try {
      // Convert string to Uint8Array
      const encoder = new TextEncoder();
      const data = encoder.encode(content);

      // Create a readable stream from the data
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        }
      });

      // Pipe through gzip compression
      const compressedStream = readableStream.pipeThrough(new CompressionStream('gzip'));

      // Read the compressed data
      const reader = compressedStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine chunks into a single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const compressedData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        compressedData.set(chunk, offset);
        offset += chunk.length;
      }

      // Create blob and download
      const blob = new Blob([compressedData], { type: 'application/gzip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Compression error:', error);
      return false;
    }
  };

  const handleBackupStructure = async () => {
    setProgress(prev => ({ ...prev, structure: 'loading' }));
    
    try {
      const { data, error } = await supabase.functions.invoke('database-backup', {
        body: { type: 'structure' }
      });

      if (error) throw error;
      
      if (data.success) {
        setStructureResult(data.data);
        setProgress(prev => ({ ...prev, structure: 'done' }));
        toast.success(isRTL ? 'تم جلب هيكل قاعدة البيانات بنجاح' : 'Database structure fetched successfully');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error backing up structure:', error);
      setProgress(prev => ({ ...prev, structure: 'error' }));
      toast.error(isRTL ? 'خطأ في نسخ الهيكل' : 'Error backing up structure');
    }
  };

  const handleBackupDataWithProgress = async () => {
    setProgress(prev => ({ ...prev, data: 'loading' }));
    setShowProgressDialog(true);
    setIsBackupComplete(false);
    setTotalRowsFetched(0);
    setCurrentChunk(0);
    setTotalChunksForCurrentTable(0);
    
    try {
      // Step 1: Get table list with row counts
      const { data: tableListData, error: tableListError } = await supabase.functions.invoke('database-backup', {
        body: { type: 'table-list' }
      });

      if (tableListError) throw tableListError;
      if (!tableListData.success) throw new Error(tableListData.error || 'Failed to get table list');

      const tables: string[] = tableListData.tables;
      const rowCounts: Record<string, number> = tableListData.rowCounts;

      // Chunk size for pagination (keep payload small to avoid network timeouts)
      const chunkSize = 2000;

      // Calculate total expected rows (ALL rows, no truncation)
      let expectedTotal = 0;
      for (const tbl of tables) {
        expectedTotal += rowCounts[tbl] || 0;
      }
      setTotalRowsExpected(expectedTotal);

      // Initialize progress list with chunk info
      const initialProgress: TableProgressItem[] = tables.map(tbl => {
        const totalRows = rowCounts[tbl] || 0;
        const chunksTotal = Math.ceil(totalRows / chunkSize) || 1;
        return {
          tableName: tbl,
          rowsFetched: 0,
          totalRows,
          chunksTotal,
          chunksFetched: 0,
          status: 'pending' as const
        };
      });
      setTableProgressList(initialProgress);

      // Step 2: Fetch each table, paginating large tables in chunks
      const allTableData: Record<string, unknown[]> = {};
      let accumulatedRows = 0;

      for (let i = 0; i < tables.length; i++) {
        const tbl = tables[i];
        const totalRowsForTable = rowCounts[tbl] || 0;
        const chunksTotal = Math.ceil(totalRowsForTable / chunkSize) || 1;
        
        setCurrentFetchingTable(tbl);
        setTotalChunksForCurrentTable(chunksTotal);
        
        // Update status to fetching
        setTableProgressList(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'fetching' as const } : item
        ));

        const tableRows: unknown[] = [];
        let hasError = false;

        // Fetch table in chunks
        for (let chunkIndex = 0; chunkIndex < chunksTotal; chunkIndex++) {
          setCurrentChunk(chunkIndex + 1);
          
          // Update chunks progress
          setTableProgressList(prev => prev.map((item, idx) => 
            idx === i ? { ...item, chunksFetched: chunkIndex, rowsFetched: tableRows.length } : item
          ));

          const offset = chunkIndex * chunkSize;

          // Network/timeouts can happen on big tables; retry a few times before failing the table.
          const invokeChunk = async (attempt: number): Promise<{ data: any; error: any }> => {
            const res = await supabase.functions.invoke('database-backup', {
              body: { type: 'data-single-table', tableName: tbl, chunkSize, offset }
            });
            if (!res.error && res.data?.success) return res as any;

            if (attempt >= 3) return res as any;
            const waitMs = 500 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, waitMs));
            return invokeChunk(attempt + 1);
          };

          const { data: tableData, error: tableError } = await invokeChunk(1);

          if (tableError || !tableData?.success) {
            console.error(`Error fetching ${tbl} chunk ${chunkIndex + 1}:`, tableError || tableData?.error);
            hasError = true;
            break;
          }

          const rows = tableData.data || [];
          tableRows.push(...rows);
          
          accumulatedRows += rows.length;
          setTotalRowsFetched(accumulatedRows);

          // Update progress with current rows fetched
          setTableProgressList(prev => prev.map((item, idx) => 
            idx === i ? { ...item, chunksFetched: chunkIndex + 1, rowsFetched: tableRows.length } : item
          ));

          // If we got fewer rows than chunkSize, we've reached the end
          if (!tableData.hasMore || rows.length < chunkSize) {
            break;
          }
        }

        if (hasError) {
          setTableProgressList(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'error' as const } : item
          ));
          continue;
        }

        if (tableRows.length > 0) {
          allTableData[tbl] = tableRows;
        }

        // Update status to done
        setTableProgressList(prev => prev.map((item, idx) => 
          idx === i ? { ...item, status: 'done' as const, rowsFetched: tableRows.length, chunksFetched: Math.ceil(tableRows.length / chunkSize) || 1 } : item
        ));
      }

      setCurrentFetchingTable(null);
      setCurrentChunk(0);
      setTotalChunksForCurrentTable(0);
      setIsBackupComplete(true);

      // Store result (no truncation anymore - all data fetched)
      setDataResult({
        tables: allTableData,
        truncated: {},
        maxRowsPerTable: null
      });
      setProgress(prev => ({ ...prev, data: 'done' }));
      toast.success(isRTL ? 'تم جلب بيانات قاعدة البيانات بنجاح' : 'Database data fetched successfully');

      // Auto-close dialog after 2 seconds
      setTimeout(() => {
        setShowProgressDialog(false);
      }, 2000);

    } catch (error) {
      console.error('Error backing up data:', error);
      setProgress(prev => ({ ...prev, data: 'error' }));
      setShowProgressDialog(false);
      toast.error(isRTL ? 'خطأ في نسخ البيانات' : 'Error backing up data');
    }
  };

  const handleDownloadStructure = () => {
    if (!structureResult) return;
    const sql = generateStructureSQL(structureResult);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(sql, `edara_structure_${timestamp}.sql`);
    toast.success(isRTL ? 'تم تحميل ملف الهيكل' : 'Structure file downloaded');
  };

  const handleDownloadData = async () => {
    // NOTE: For very large exports (e.g. 1M+ rows), building a single SQL string can
    // crash the browser with "RangeError: Invalid string length". We stream-generate
    // the SQL and compress it on the fly instead, then save to cloud storage.

    // Initialize progress dialog
    setShowProgressDialog(true);
    setIsBackupComplete(false);
    setTotalRowsFetched(0);
    setCurrentChunk(0);
    setTotalChunksForCurrentTable(0);
    setTableProgressList([]);
    setCurrentFetchingTable(null);
    
    setIsCompressing(true);
    toast.info(isRTL ? 'جاري إنشاء وضغط وحفظ الملف (قد يستغرق وقتاً)...' : 'Generating, compressing and saving file (this may take a while)...');

    const escapeValue = (value: any): string => {
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
      return `'${String(value).replace(/'/g, "''")}'`;
    };

    // Create backup record first
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `edara_data_${timestamp}.sql.gz`;
    const filePath = `data/${filename}`;

    let backupId: string | null = null;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert pending backup record
      const { data: backupRecord, error: insertError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'data',
          file_name: filename,
          file_path: filePath,
          status: 'processing',
          created_by: user?.id || null
        })
        .select()
        .single();

      if (insertError) throw insertError;
      backupId = backupRecord.id;

      // Refresh history to show processing
      fetchBackupHistory();

      // Allow UI to paint before heavy work starts
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Get table list + counts
      const { data: tableListData, error: tableListError } = await supabase.functions.invoke('database-backup', {
        body: { type: 'table-list' },
      });
      if (tableListError) throw tableListError;
      if (!tableListData?.success) throw new Error(tableListData?.error || 'Failed to get table list');

      const tables: string[] = tableListData.tables || [];
      const rowCounts: Record<string, number> = tableListData.rowCounts || {};

      // Keep chunks small to avoid timeouts
      const chunkSize = 2000;

      // Calculate total expected rows
      let expectedTotal = 0;
      for (const tbl of tables) {
        expectedTotal += rowCounts[tbl] || 0;
      }
      setTotalRowsExpected(expectedTotal);

      // Initialize progress list
      const sortedTables = tables.sort();
      const initialProgress: TableProgressItem[] = sortedTables.map(tbl => {
        const totalRows = rowCounts[tbl] || 0;
        const chunksTotal = Math.ceil(totalRows / chunkSize) || 1;
        return {
          tableName: tbl,
          rowsFetched: 0,
          totalRows,
          chunksTotal,
          chunksFetched: 0,
          status: 'pending' as const
        };
      });
      setTableProgressList(initialProgress);

      // Yield to let React paint the progress dialog with initial state
      await new Promise((r) => setTimeout(r, 50));

      // Build gzip stream writer (no huge intermediate string)
      const gzip = new CompressionStream('gzip');
      const writer = gzip.writable.getWriter();
      const encoder = new TextEncoder();

      const writeText = async (text: string) => {
        await writer.write(encoder.encode(text));
      };

      // Header
      await writeText('-- Edara Database Data Backup\n');
      await writeText(`-- Generated at: ${new Date().toISOString()}\n`);
      await writeText('-- ================================================\n\n');

      let exportedTables = 0;
      let accumulatedRows = 0;

      for (let tableIndex = 0; tableIndex < sortedTables.length; tableIndex++) {
        const tableName = sortedTables[tableIndex];
        const totalRows = rowCounts[tableName] || 0;
        if (totalRows === 0) {
          // Mark as done immediately
          setTableProgressList(prev => prev.map((item, idx) => 
            idx === tableIndex ? { ...item, status: 'done' as const } : item
          ));
          continue;
        }

        exportedTables += 1;

        const chunksTotal = Math.ceil(totalRows / chunkSize) || 1;
        setCurrentFetchingTable(tableName);
        setTotalChunksForCurrentTable(chunksTotal);

        // Update status to fetching
        setTableProgressList(prev => prev.map((item, idx) => 
          idx === tableIndex ? { ...item, status: 'fetching' as const } : item
        ));

        // Yield so React can paint the "fetching" status
        await new Promise((r) => setTimeout(r, 0));

        // Discover columns from the first non-empty chunk
        let columns: string[] | null = null;
        let wroteTableHeader = false;
        let tableRowsFetched = 0;

        for (let chunkIndex = 0; chunkIndex < chunksTotal; chunkIndex++) {
          setCurrentChunk(chunkIndex + 1);

          const offset = chunkIndex * chunkSize;

          const invokeChunk = async (attempt: number): Promise<{ data: any; error: any }> => {
            const res = await supabase.functions.invoke('database-backup', {
              body: { type: 'data-single-table', tableName, chunkSize, offset },
            });
            if (!res.error && res.data?.success) return res as any;
            if (attempt >= 3) return res as any;
            const waitMs = 500 * Math.pow(2, attempt - 1);
            await new Promise((r) => setTimeout(r, waitMs));
            return invokeChunk(attempt + 1);
          };

          const { data: tableData, error: tableError } = await invokeChunk(1);
          if (tableError || !tableData?.success) {
            throw new Error(tableData?.error || tableError?.message || `Failed to fetch ${tableName} chunk ${chunkIndex + 1}`);
          }

          const rows: any[] = tableData.data || [];
          if (rows.length === 0) {
            if (!tableData.hasMore) break;
            continue;
          }

          if (!columns) {
            columns = Object.keys(rows[0]);
            await writeText(`-- ==================== ${tableName.toUpperCase()} (${totalRows.toLocaleString()} rows) ====================\n\n`);
            wroteTableHeader = true;
          }

          if (!wroteTableHeader && columns) {
            await writeText(`-- ==================== ${tableName.toUpperCase()} (${totalRows.toLocaleString()} rows) ====================\n\n`);
            wroteTableHeader = true;
          }

          // Build INSERTs for this chunk in-memory (chunk-sized) then write once.
          // This is much faster than awaiting writer.write per row and allows the UI to update.
          const insertLines: string[] = [];
          for (const row of rows) {
            const values = columns.map((col) => escapeValue(row?.[col]));
            insertLines.push(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`);
          }
          insertLines.push('\n');
          await writeText(insertLines.join(''));

          // Update progress
          tableRowsFetched += rows.length;
          accumulatedRows += rows.length;
          setTotalRowsFetched(accumulatedRows);
          setTableProgressList(prev => prev.map((item, idx) => 
            idx === tableIndex ? { 
              ...item, 
              rowsFetched: tableRowsFetched,
              chunksFetched: chunkIndex + 1 
            } : item
          ));

          // Yield to the browser so React can paint the progress dialog
          await new Promise((r) => setTimeout(r, 0));

          if (!tableData.hasMore || rows.length < chunkSize) break;
        }

        // Mark table as done
        setTableProgressList(prev => prev.map((item, idx) => 
          idx === tableIndex ? { ...item, status: 'done' as const, rowsFetched: tableRowsFetched } : item
        ));

        // If table had rows but we never got any data back (rare), just skip it
        if (!columns) continue;
      }

      await writer.close();

      // Read compressed bytes
      const reader = gzip.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const compressedData = new Uint8Array(totalLength);
      let byteOffset = 0;
      for (const c of chunks) {
        compressedData.set(c, byteOffset);
        byteOffset += c.length;
      }

      // Upload to storage
      const blob = new Blob([compressedData], { type: 'application/gzip' });
      const { error: uploadError } = await supabase.storage
        .from('system-backups')
        .upload(filePath, blob, {
          contentType: 'application/gzip',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update backup record as completed
      await supabase
        .from('system_backups')
        .update({
          status: 'completed',
          file_size: totalLength,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupId);

      // Refresh history
      fetchBackupHistory();

      // Mark as complete
      setIsBackupComplete(true);
      setCurrentFetchingTable(null);

      toast.success(
        isRTL
          ? `تم حفظ النسخة الاحتياطية بنجاح (${exportedTables} جداول)`
          : `Backup saved successfully (${exportedTables} tables)`
      );

      // Auto close dialog after 2 seconds
      setTimeout(() => {
        setShowProgressDialog(false);
      }, 2000);
    } catch (error) {
      console.error('Backup error:', error);
      
      // Update backup record as failed
      if (backupId) {
        await supabase
          .from('system_backups')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', backupId);
        fetchBackupHistory();
      }
      
      toast.error(isRTL ? 'خطأ في إنشاء النسخة الاحتياطية' : 'Error creating backup');
      setShowProgressDialog(false);
    } finally {
      setIsCompressing(false);
      setCurrentFetchingTable(null);
      setCurrentChunk(0);
      setTotalChunksForCurrentTable(0);
    }
  };

  const handleDownloadFromHistory = async (backup: BackupRecord) => {
    if (backup.status !== 'completed') return;
    
    setDownloadingId(backup.id);
    try {
      const { data, error } = await supabase.storage
        .from('system-backups')
        .download(backup.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(isRTL ? 'تم بدء التحميل' : 'Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(isRTL ? 'خطأ في تحميل الملف' : 'Error downloading file');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteBackup = async (backup: BackupRecord) => {
    setDeletingId(backup.id);
    try {
      // Delete from storage first (if exists)
      if (backup.status === 'completed') {
        await supabase.storage
          .from('system-backups')
          .remove([backup.file_path]);
      }

      // Delete record from database
      const { error } = await supabase
        .from('system_backups')
        .delete()
        .eq('id', backup.id);

      if (error) throw error;

      toast.success(isRTL ? 'تم حذف النسخة الاحتياطية' : 'Backup deleted');
      fetchBackupHistory();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(isRTL ? 'خطأ في حذف النسخة الاحتياطية' : 'Error deleting backup');
    } finally {
      setDeletingId(null);
    }
  };

  const getBackupStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">{isRTL ? 'مكتمل' : 'Completed'}</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">{isRTL ? 'قيد المعالجة' : 'Processing'}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{isRTL ? 'فشل' : 'Failed'}</Badge>;
      default:
        return <Badge variant="secondary">{isRTL ? 'قيد الانتظار' : 'Pending'}</Badge>;
    }
  };

  const getStatusIcon = (status: 'idle' | 'loading' | 'done' | 'error') => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getTableCount = () => {
    if (Array.isArray(structureResult?.columns)) {
      const tables = new Set(structureResult.columns.map((c: any) => c.table_name));
      return tables.size;
    }
    return 0;
  };

  const getTotalRowCount = () => {
    if (structureResult?.tableRowCounts) {
      return Object.values(structureResult.tableRowCounts).reduce(
        (sum: number, count: any) => sum + (count || 0),
        0
      );
    }
    return 0;
  };

  const getFunctionsCount = () => {
    return structureResult?.functions?.length || 0;
  };

  const getTriggersCount = () => {
    return structureResult?.triggers?.length || 0;
  };

  const getPoliciesCount = () => {
    return structureResult?.policies?.length || 0;
  };

  const getDataRowCount = () => {
    // Rows INCLUDED in the export payload (may be truncated per table)
    if (!dataResult?.tables) return 0;
    return Object.values(dataResult.tables).reduce(
      (sum: number, rows: any) => sum + (rows?.length || 0),
      0
    );
  };

  const getDataTableCount = () => {
    // Tables INCLUDED in the export payload (tables with at least 1 exported row)
    if (!dataResult?.tables) return 0;
    return Object.values(dataResult.tables).filter((rows: any) => rows?.length > 0).length;
  };

  const getTruncatedTableCount = () => {
    if (!dataResult?.truncated) return 0;
    return Object.values(dataResult.truncated).filter(Boolean).length;
  };

  const getDatabaseTablesWithDataCount = () => {
    if (!structureResult?.tableRowCounts) return 0;
    return Object.values(structureResult.tableRowCounts).filter((c: any) => (c || 0) > 0)
      .length;
  };

  return (
    <>
    <div className={`container mx-auto p-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          {isRTL ? 'نسخ احتياطي للنظام' : 'System Backup'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isRTL 
            ? 'إنشاء نسخة احتياطية كاملة لقاعدة البيانات تشمل الهيكل والبيانات'
            : 'Create a complete database backup including structure and data'
          }
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Structure Backup Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {isRTL ? 'هيكل قاعدة البيانات' : 'Database Structure'}
              {getStatusIcon(progress.structure)}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'نسخ احتياطي للجداول وعدد السجلات'
                : 'Backup tables and row counts'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.structure === 'done' && structureResult && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'عدد الجداول:' : 'Tables:'}</span>
                  <span className="font-medium">{getTableCount()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'إجمالي السجلات:' : 'Total Rows:'}</span>
                  <span className="font-medium">{getTotalRowCount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'الدوال:' : 'Functions:'}</span>
                  <span className="font-medium">{getFunctionsCount()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'المشغلات:' : 'Triggers:'}</span>
                  <span className="font-medium">{getTriggersCount()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'السياسات:' : 'Policies:'}</span>
                  <span className="font-medium">{getPoliciesCount()}</span>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={handleBackupStructure}
                disabled={progress.structure === 'loading'}
                className="flex-1"
              >
                {progress.structure === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                {isRTL ? 'جلب الهيكل' : 'Fetch Structure'}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDownloadStructure}
                disabled={!structureResult}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Backup Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isRTL ? 'بيانات قاعدة البيانات' : 'Database Data'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'إنشاء نسخة احتياطية لجميع البيانات وحفظها في السحابة'
                : 'Create a backup of all data and save it to cloud storage'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCompressing && currentFetchingTable && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm font-medium">
                    {isRTL ? 'جاري المعالجة...' : 'Processing...'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? 'الجدول الحالي:' : 'Current table:'} {currentFetchingTable}
                </div>
                {totalChunksForCurrentTable > 1 && (
                  <div className="text-xs text-muted-foreground">
                    {isRTL ? 'الدفعة:' : 'Chunk:'} {currentChunk} / {totalChunksForCurrentTable}
                  </div>
                )}
              </div>
            )}
            
            <Button 
              onClick={handleDownloadData}
              disabled={isCompressing}
              className="w-full"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isRTL ? 'جاري الإنشاء...' : 'Creating...'}
                </>
              ) : (
                <>
                  <HardDrive className="h-4 w-4 mr-2" />
                  {isRTL ? 'إنشاء نسخة احتياطية جديدة' : 'Create New Backup'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Backup History */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {isRTL ? 'سجل النسخ الاحتياطية' : 'Backup History'}
            </CardTitle>
            <CardDescription>
              {isRTL ? 'النسخ الاحتياطية المحفوظة في السحابة' : 'Backups saved in cloud storage'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBackupHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : backupHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isRTL ? 'لا توجد نسخ احتياطية بعد' : 'No backups yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'اسم الملف' : 'File Name'}</TableHead>
                    <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                    <TableHead>{isRTL ? 'الحجم' : 'Size'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{isRTL ? 'تاريخ الإنشاء' : 'Created At'}</TableHead>
                    <TableHead className="text-center">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupHistory.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {backup.file_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {backup.backup_type === 'data' 
                            ? (isRTL ? 'بيانات' : 'Data')
                            : (isRTL ? 'هيكل' : 'Structure')
                          }
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFileSize(backup.file_size)}
                      </TableCell>
                      <TableCell>
                        {getBackupStatusBadge(backup.status)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(backup.created_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFromHistory(backup)}
                            disabled={backup.status !== 'completed' || downloadingId === backup.id}
                          >
                            {downloadingId === backup.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={deletingId === backup.id}
                              >
                                {deletingId === backup.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {isRTL ? 'حذف النسخة الاحتياطية؟' : 'Delete Backup?'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {isRTL 
                                    ? 'هذا الإجراء لا يمكن التراجع عنه. سيتم حذف النسخة الاحتياطية نهائياً.'
                                    : 'This action cannot be undone. The backup will be permanently deleted.'
                                  }
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {isRTL ? 'إلغاء' : 'Cancel'}
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteBackup(backup)}>
                                  {isRTL ? 'حذف' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Details */}
      {progress.structure === 'done' && structureResult?.tables && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{isRTL ? 'تفاصيل الجداول' : 'Table Details'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-start py-2 px-3">{isRTL ? 'اسم الجدول' : 'Table Name'}</th>
                    <th className="text-end py-2 px-3">{isRTL ? 'عدد السجلات' : 'Row Count'}</th>
                  </tr>
                </thead>
                <tbody>
                  {structureResult.tables
                    .sort((a: any, b: any) => (b.row_count || 0) - (a.row_count || 0))
                    .map((table: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 font-mono text-xs">{table.table_name}</td>
                      <td className="py-2 px-3 text-end">{(table.row_count || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{isRTL ? 'تعليمات الاستخدام' : 'Usage Instructions'}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className={`list-decimal list-inside space-y-2 text-muted-foreground`}>
            <li>
              {isRTL 
                ? 'انقر على "جلب الهيكل" لتحميل معلومات هيكل قاعدة البيانات'
                : 'Click "Fetch Structure" to load database structure information'
              }
            </li>
            <li>
              {isRTL 
                ? 'انقر على "جلب البيانات" لتحميل جميع بيانات الجداول'
                : 'Click "Fetch Data" to load all table data'
              }
            </li>
            <li>
              {isRTL 
                ? 'استخدم زر التحميل لحفظ ملفات SQL على جهازك'
                : 'Use the download button to save SQL files to your device'
              }
            </li>
            <li>
              {isRTL 
                ? 'ملف الهيكل يحتوي على: قائمة الجداول وعدد السجلات'
                : 'Structure file contains: table list and row counts'
              }
            </li>
            <li>
              {isRTL 
                ? 'ملف البيانات يحتوي على عبارات INSERT لجميع السجلات (يتم جلب الجداول الكبيرة على دفعات)'
                : 'Data file contains INSERT statements for all records (large tables are fetched in chunks)'
              }
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>

      {/* Backup Progress Dialog */}
      <BackupProgressDialog
        isOpen={showProgressDialog}
        onClose={() => setShowProgressDialog(false)}
        tables={tableProgressList}
        currentTable={currentFetchingTable}
        currentChunk={currentChunk}
        totalChunks={totalChunksForCurrentTable}
        totalRowsFetched={totalRowsFetched}
        totalRowsExpected={totalRowsExpected}
        isComplete={isBackupComplete}
        isRTL={isRTL}
      />
    </>
  );
};

export default SystemBackup;
