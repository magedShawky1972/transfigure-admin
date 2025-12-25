import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Database, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface BackupProgress {
  structure: 'idle' | 'loading' | 'done' | 'error';
  data: 'idle' | 'loading' | 'done' | 'error';
}

const SystemBackup = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [progress, setProgress] = useState<BackupProgress>({ structure: 'idle', data: 'idle' });
  const [structureResult, setStructureResult] = useState<any>(null);
  const [dataResult, setDataResult] = useState<any>(null);

  const generateStructureSQL = (data: any): string => {
    let sql = '-- Edara Database Structure Backup\n';
    sql += `-- Generated at: ${new Date().toISOString()}\n`;
    sql += '-- ================================================\n\n';

    // Tables from structure
    if (data.tables && Array.isArray(data.tables) && data.tables.length > 0) {
      sql += '-- ==================== TABLES ====================\n\n';
      sql += '-- Table List with Row Counts:\n';
      for (const table of data.tables) {
        sql += `-- ${table.table_name}: ${table.row_count} rows\n`;
      }
      sql += '\n';

      // Generate CREATE TABLE statements from generated_tables metadata
      if (data.generatedTables && Array.isArray(data.generatedTables)) {
        sql += '-- ==================== TABLE DEFINITIONS (from generated_tables) ====================\n\n';
        for (const gt of data.generatedTables) {
          if (gt.columns && Array.isArray(gt.columns)) {
            sql += `-- Table: ${gt.table_name}\n`;
            sql += `CREATE TABLE IF NOT EXISTS public.${gt.table_name.toLowerCase()} (\n`;
            sql += `  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,\n`;
            
            for (const col of gt.columns) {
              const colName = col.name?.toLowerCase().replace(/\s+/g, '_') || 'column';
              const colType = mapColumnType(col.type);
              const nullable = col.nullable !== false ? '' : ' NOT NULL';
              sql += `  ${colName} ${colType}${nullable},\n`;
            }
            
            sql += `  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),\n`;
            sql += `  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()\n`;
            sql += `);\n\n`;
            sql += `ALTER TABLE public.${gt.table_name.toLowerCase()} ENABLE ROW LEVEL SECURITY;\n\n`;
          }
        }
      }
    }

    sql += '-- ==================== NOTES ====================\n\n';
    sql += '-- This backup contains table structure based on available metadata.\n';
    sql += '-- For complete schema including functions, triggers, and RLS policies,\n';
    sql += '-- please export directly from the Supabase dashboard.\n';
    sql += '\n';

    return sql;
  };

  const mapColumnType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'text': 'TEXT',
      'integer': 'INTEGER',
      'number': 'NUMERIC',
      'boolean': 'BOOLEAN',
      'date': 'DATE',
      'timestamp': 'TIMESTAMP WITH TIME ZONE',
      'uuid': 'UUID',
      'json': 'JSONB',
    };
    return typeMap[type?.toLowerCase()] || 'TEXT';
  };

  const generateDataSQL = (tableData: Record<string, any[]>): string => {
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

      sql += `-- ==================== ${tableName.toUpperCase()} (${rows.length} rows) ====================\n\n`;
      
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

  const handleBackupData = async () => {
    setProgress(prev => ({ ...prev, data: 'loading' }));
    
    try {
      const { data, error } = await supabase.functions.invoke('database-backup', {
        body: { type: 'data' }
      });

      if (error) throw error;
      
      if (data.success) {
        setDataResult(data.data);
        setProgress(prev => ({ ...prev, data: 'done' }));
        toast.success(isRTL ? 'تم جلب بيانات قاعدة البيانات بنجاح' : 'Database data fetched successfully');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error backing up data:', error);
      setProgress(prev => ({ ...prev, data: 'error' }));
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

  const handleDownloadData = () => {
    if (!dataResult) return;
    const sql = generateDataSQL(dataResult);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadFile(sql, `edara_data_${timestamp}.sql`);
    toast.success(isRTL ? 'تم تحميل ملف البيانات' : 'Data file downloaded');
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
    // Support both response shapes (old UI expected `columns`, new uses `tables`)
    if (Array.isArray(structureResult?.tables)) return structureResult.tables.length;
    if (Array.isArray(structureResult?.columns)) {
      const tables = new Set(structureResult.columns.map((c: any) => c.table_name));
      return tables.size;
    }
    return 0;
  };

  const getTotalRowCount = () => {
    if (Array.isArray(structureResult?.tables)) {
      return structureResult.tables.reduce((sum: number, t: any) => sum + (t.row_count || 0), 0);
    }
    return 0;
  };

  const getDataRowCount = () => {
    if (!dataResult) return 0;
    return Object.values(dataResult).reduce((sum: number, rows: any) => sum + (rows?.length || 0), 0);
  };

  const getDataTableCount = () => {
    if (!dataResult) return 0;
    return Object.values(dataResult).filter((rows: any) => rows?.length > 0).length;
  };

  return (
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
                {Array.isArray(structureResult?.generatedTables) && (
                  <div className="flex justify-between text-sm">
                    <span>{isRTL ? 'الجداول المُنشأة:' : 'Generated Tables:'}</span>
                    <span className="font-medium">{structureResult.generatedTables.length}</span>
                  </div>
                )}
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
              {getStatusIcon(progress.data)}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'نسخ احتياطي لجميع البيانات في جميع الجداول'
                : 'Backup all data from all tables'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.data === 'done' && dataResult && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'إجمالي السجلات:' : 'Total Rows:'}</span>
                  <span className="font-medium">{getDataRowCount().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'جداول بها بيانات:' : 'Tables with data:'}</span>
                  <span className="font-medium">{getDataTableCount()}</span>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                onClick={handleBackupData}
                disabled={progress.data === 'loading'}
                className="flex-1"
              >
                {progress.data === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isRTL ? 'جلب البيانات' : 'Fetch Data'}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDownloadData}
                disabled={!dataResult}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

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
                ? 'ملف البيانات يحتوي على عبارات INSERT لجميع السجلات (حد أقصى 10,000 سجل لكل جدول)'
                : 'Data file contains INSERT statements for all records (max 10,000 rows per table)'
              }
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemBackup;
