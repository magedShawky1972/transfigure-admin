import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { Database, FileText, Upload, Loader2, CheckCircle2, AlertCircle, FileArchive, Play, LogOut, XCircle, ExternalLink, Server, Copy, Download, ChevronDown, ChevronRight, Save, ArrowRightLeft, Users, HardDrive, RefreshCw, Clock, GitBranch, Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

interface StructureRestoreItem {
  name: string;
  type: 'table' | 'function' | 'trigger' | 'index' | 'policy' | 'type' | 'sequence' | 'alter' | 'permission' | 'foreignkey' | 'other';
  status: 'pending' | 'executing' | 'done' | 'error' | 'skipped';
  errorMessage?: string;
  existsInTarget?: boolean;
}

// Define restore step categories in order
type RestoreStepKey = 'types' | 'tables' | 'foreignkeys' | 'indexes' | 'functions' | 'triggers' | 'policies';

interface RestoreStep {
  key: RestoreStepKey;
  label: string;
  labelAr: string;
  enabled: boolean;
  types: StructureRestoreItem['type'][];
  status: 'pending' | 'executing' | 'done' | 'error' | 'skipped';
  items: StructureRestoreItem[];
  completedCount: number;
  errorCount: number;
}

interface ConflictingObject {
  name: string;
  type: string;
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
  
  // Structure restore progress state
  const [showStructureProgressDialog, setShowStructureProgressDialog] = useState(false);
  const [structureRestoreList, setStructureRestoreList] = useState<StructureRestoreItem[]>([]);
  const [currentStructureItem, setCurrentStructureItem] = useState<string | null>(null);
  const [isStructureRestoreComplete, setIsStructureRestoreComplete] = useState(false);
  
  // Step-by-step restore state
  const [restoreSteps, setRestoreSteps] = useState<RestoreStep[]>([
    { key: 'types', label: 'User-Defined Types', labelAr: 'الأنواع المخصصة', enabled: true, types: ['type'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
    { key: 'tables', label: 'Tables', labelAr: 'الجداول', enabled: true, types: ['table'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
    { key: 'foreignkeys', label: 'Foreign Keys', labelAr: 'المفاتيح الأجنبية', enabled: true, types: ['foreignkey', 'alter'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
    { key: 'indexes', label: 'Indexes', labelAr: 'الفهارس', enabled: true, types: ['index'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
    { key: 'functions', label: 'Functions', labelAr: 'الدوال', enabled: true, types: ['function'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
    { key: 'triggers', label: 'Triggers', labelAr: 'المشغلات', enabled: true, types: ['trigger'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
    { key: 'policies', label: 'RLS Policies', labelAr: 'سياسات RLS', enabled: true, types: ['policy', 'permission'], status: 'pending', items: [], completedCount: 0, errorCount: 0 },
  ]);
  const [currentStepKey, setCurrentStepKey] = useState<RestoreStepKey | null>(null);
  const [parsedStatements, setParsedStatements] = useState<{name: string, type: string, sql: string}[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<RestoreStepKey>>(new Set());
  
  // Conflict confirmation state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictingObjects, setConflictingObjects] = useState<ConflictingObject[]>([]);
  const [pendingStructureStatements, setPendingStructureStatements] = useState<{name: string, type: string, sql: string}[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  
  // External Supabase state
  const [useExternalSupabase, setUseExternalSupabase] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalAnonKey, setExternalAnonKey] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionValid, setConnectionValid] = useState<boolean | null>(null);
  const [externalTables, setExternalTables] = useState<{name: string, rowCount: number}[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [savedConnectionName, setSavedConnectionName] = useState("");
  const [showAnonKey, setShowAnonKey] = useState(false);

  // Load saved external DB connections from database
  const [savedConnections, setSavedConnections] = useState<{ id?: string; name: string; url: string; anonKey: string }[]>([]);

  const loadSavedConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('external_db_connections')
      .select('id, name, url, anon_key')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setSavedConnections(data.map(c => ({ id: c.id, name: c.name, url: c.url, anonKey: c.anon_key })));
    }
  };

  useEffect(() => {
    loadSavedConnections();
  }, []);

  const handleSaveConnection = async () => {
    if (!externalUrl || !externalAnonKey) {
      toast.error(isRTL ? 'يرجى إدخال URL و Anon Key أولاً' : 'Please enter URL and Anon Key first');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
      return;
    }
    const name = savedConnectionName.trim() || new URL(externalUrl).hostname;
    const { error } = await supabase
      .from('external_db_connections')
      .upsert({
        user_id: user.id,
        name,
        url: externalUrl,
        anon_key: externalAnonKey,
      }, { onConflict: 'user_id,url' });
    if (error) {
      toast.error(isRTL ? 'فشل حفظ الاتصال' : 'Failed to save connection');
      return;
    }
    await loadSavedConnections();
    setSavedConnectionName("");
    toast.success(isRTL ? 'تم حفظ الاتصال' : 'Connection saved');
  };

  const handleLoadConnection = (conn: { name: string; url: string; anonKey: string }) => {
    setExternalUrl(conn.url);
    setExternalAnonKey(conn.anonKey);
    setConnectionValid(null);
    toast.success(isRTL ? `تم تحميل: ${conn.name}` : `Loaded: ${conn.name}`);
  };

  const handleDeleteConnection = async (url: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('external_db_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('url', url);
    await loadSavedConnections();
    toast.success(isRTL ? 'تم حذف الاتصال' : 'Connection deleted');
  };
  
  // Manual SQL generation state
  const [showManualSqlDialog, setShowManualSqlDialog] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');
  const [generatingSql, setGeneratingSql] = useState(false);
  
  // Migration state
  interface MigrationTableItem {
    name: string;
    rowCount: number;
    status: 'pending' | 'migrating' | 'done' | 'error';
    migratedRows: number;
    errorMessage?: string;
  }
  
  const [showMigrateSection, setShowMigrateSection] = useState(false);
  const [migrateDataEnabled, setMigrateDataEnabled] = useState(true);
  const [migrateUsersEnabled, setMigrateUsersEnabled] = useState(true);
  const [migrateStorageEnabled, setMigrateStorageEnabled] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationTables, setMigrationTables] = useState<MigrationTableItem[]>([]);
  const [migrationUsersStatus, setMigrationUsersStatus] = useState<'idle' | 'migrating' | 'done' | 'error'>('idle');
  const [migrationUsersCount, setMigrationUsersCount] = useState(0);
  const [migrationStorageStatus, setMigrationStorageStatus] = useState<'idle' | 'migrating' | 'done' | 'error'>('idle');
  const [migrationStorageBuckets, setMigrationStorageBuckets] = useState<string[]>([]);
  const [migrationStorageFileCount, setMigrationStorageFileCount] = useState(0);
  const [showMigrationProgressDialog, setShowMigrationProgressDialog] = useState(false);
  const [migrationErrors, setMigrationErrors] = useState<string[]>([]);
  const [isMigrationComplete, setIsMigrationComplete] = useState(false);
  const [migrationCurrentStep, setMigrationCurrentStep] = useState<string>('');
  // Table selection state
  const [availableTables, setAvailableTables] = useState<{name: string, rowCount: number, selected: boolean}[]>([]);
  const [loadingAvailableTables, setLoadingAvailableTables] = useState(false);
  const [tablesLoaded, setTablesLoaded] = useState(false);
  
  // Migration tracking state
  const [migrationLog, setMigrationLog] = useState<{
    id?: string;
    connection_url: string;
    connection_name?: string;
    last_migration_file?: string;
    last_migration_run_at?: string;
    last_data_sync_at?: string;
    migration_files_applied: string[];
  } | null>(null);
  const [localMigrations, setLocalMigrations] = useState<{ version: string; name: string }[]>([]);
  const [pendingMigrations, setPendingMigrations] = useState<{ version: string; name: string }[]>([]);
  const [loadingMigrationState, setLoadingMigrationState] = useState(false);
  const [runningMigrationSync, setRunningMigrationSync] = useState(false);
  const [migrationSyncProgress, setMigrationSyncProgress] = useState<{ current: number; total: number; currentFile: string }>({ current: 0, total: 0, currentFile: '' });
  const [showMigrationSyncDialog, setShowMigrationSyncDialog] = useState(false);
  const [migrationSyncErrors, setMigrationSyncErrors] = useState<string[]>([]);
  const [matchingCurrentSituation, setMatchingCurrentSituation] = useState(false);
  const [showComparisonDialog, setShowComparisonDialog] = useState(false);
  const [applyingMissingObjects, setApplyingMissingObjects] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<{
    localTables: string[];
    externalTables: string[];
    missingTables: string[];
    localFunctions: string[];
    externalFunctions: string[];
    missingFunctions: string[];
    localTriggers: string[];
    externalTriggers: string[];
    missingTriggers: string[];
    localViews: string[];
    externalViews: string[];
    missingViews: string[];
    localTypes: { name: string; type: string; values?: string[]; base?: string }[];
    externalTypes: string[];
    missingTypes: { name: string; type: string; values?: string[]; base?: string }[];
    matchedMigrations: string[];
    unmatchedMigrations: string[];
  } | null>(null);

  const structureInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  
  // Call external Supabase via proxy edge function
  const callExternalProxy = async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke('external-supabase-proxy', {
      body: {
        action,
        externalUrl,
        externalAnonKey,
        ...params
      }
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  };

  // Fetch all rows from RPCs that can exceed PostgREST default page size (1000 rows)
  const fetchAllRpcRows = async (rpcName: string, args: Record<string, any> = {}, pageSize = 1000) => {
    const allRows: any[] = [];
    let from = 0;

    while (true) {
      let query: any = supabase.rpc(rpcName as any, args as any);
      if (typeof query.range === 'function') {
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      allRows.push(...rows);

      if (rows.length < pageSize) break;
      from += pageSize;

      // safety guard against infinite loops on unexpected API behavior
      if (from > 200000) break;
    }

    return allRows;
  };
  
  // Load migration tracking state for current connection
  const loadMigrationTrackingState = async (url: string) => {
    setLoadingMigrationState(true);
    try {
      // Load log from DB
      const { data: logData } = await supabase
        .from('external_migration_log')
        .select('*')
        .eq('connection_url', url)
        .maybeSingle();
      
      if (logData) {
        setMigrationLog({
          ...logData,
          migration_files_applied: Array.isArray(logData.migration_files_applied) 
            ? logData.migration_files_applied as string[]
            : []
        });
      } else {
        setMigrationLog(null);
      }
      
      // Load local migrations list
      const { data: migResult, error: migErr } = await supabase.functions.invoke('migrate-to-external', {
        body: { action: 'list_local_migrations' }
      });
      
      if (!migErr && migResult?.success) {
        const migrations = migResult.migrations || [];
        setLocalMigrations(migrations);
        
        // Calculate pending
        const appliedFiles = logData?.migration_files_applied;
        const appliedArray: string[] = Array.isArray(appliedFiles) ? (appliedFiles as any[]).map(String) : [];
        const appliedSet = new Set(appliedArray);
        const pending = migrations.filter((m: any) => !appliedSet.has(m.version));
        setPendingMigrations(pending);
      }
    } catch (err) {
      console.error('Error loading migration state:', err);
    } finally {
      setLoadingMigrationState(false);
    }
  };

  // Run missing migration files on external DB
  const runMissingMigrations = async (): Promise<boolean> => {
    // Use comparison results if available, otherwise fall back to pendingMigrations
    const migrationsToRun = comparisonResults?.unmatchedMigrations?.length 
      ? localMigrations.filter(m => comparisonResults.unmatchedMigrations.includes(m.version))
      : pendingMigrations;
    
    if (migrationsToRun.length === 0) return true;
    
    setRunningMigrationSync(true);
    setShowMigrationSyncDialog(true);
    setMigrationSyncErrors([]);
    const errors: string[] = [];
    const appliedVersions: string[] = [...(migrationLog?.migration_files_applied || [])];
    
    setMigrationSyncProgress({ current: 0, total: migrationsToRun.length, currentFile: '' });
    
    for (let i = 0; i < migrationsToRun.length; i++) {
      const mig = migrationsToRun[i];
      setMigrationSyncProgress({ current: i + 1, total: migrationsToRun.length, currentFile: mig.version });
      
      try {
        // Get migration content from local DB
        const { data: contentResult, error: contentErr } = await supabase.functions.invoke('migrate-to-external', {
          body: { action: 'get_migration_content', tableName: mig.version }
        });
        
        if (contentErr || !contentResult?.success) {
          errors.push(`${mig.version}: Failed to get content`);
          continue;
        }
        
        const statements = contentResult.statements;
        if (!statements || statements === '') {
          // Migration has no stored statements, skip
          appliedVersions.push(mig.version);
          continue;
        }
        
        // Execute on external DB
        const result = await callExternalProxy('exec_sql', { sql: statements });
        if (!result.success && result.error) {
          errors.push(`${mig.version}: ${result.error}`);
        } else {
          appliedVersions.push(mig.version);
        }
      } catch (err: any) {
        errors.push(`${mig.version}: ${err.message}`);
      }
      
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Notify PostgREST to reload schema cache after DDL changes
    try {
      await callExternalProxy('exec_sql', { sql: `NOTIFY pgrst, 'reload schema'` });
    } catch {
      // Non-critical
    }
    
    // Update tracking log
    await saveMigrationLog(appliedVersions);
    setMigrationSyncErrors(errors);
    setRunningMigrationSync(false);
    
    return errors.length === 0;
  };

  // Save migration log to DB
  const saveMigrationLog = async (appliedVersions: string[]) => {
    const lastVersion = appliedVersions.length > 0 ? appliedVersions[appliedVersions.length - 1] : null;
    
    const logData = {
      connection_url: externalUrl,
      connection_name: savedConnections.find(c => c.url === externalUrl)?.name || new URL(externalUrl).hostname,
      last_migration_file: lastVersion,
      last_migration_run_at: new Date().toISOString(),
      migration_files_applied: appliedVersions,
    };
    
    if (migrationLog?.id) {
      await supabase
        .from('external_migration_log')
        .update(logData)
        .eq('id', migrationLog.id);
    } else {
      await supabase
        .from('external_migration_log')
        .upsert(logData, { onConflict: 'connection_url' });
    }
    
    // Refresh state
    await loadMigrationTrackingState(externalUrl);
  };

  // Generate SQL script for preview
  const generateMissingObjectsScript = async () => {
    if (!comparisonResults) return;
    setGeneratingScript(true);
    const lines: string[] = ['-- Script to apply missing objects to external database\n'];

    try {
      // Types
      if (comparisonResults.missingTypes?.length) {
        lines.push('-- ======= MISSING TYPES =======');
        for (const typeInfo of comparisonResults.missingTypes) {
          if (typeInfo.type === 'enum' && typeInfo.values) {
            const vals = typeInfo.values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
            lines.push(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeInfo.name}') THEN CREATE TYPE public."${typeInfo.name}" AS ENUM (${vals}); END IF; END $$;\n`);
          } else if (typeInfo.type === 'domain' && typeInfo.base) {
            lines.push(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeInfo.name}') THEN CREATE DOMAIN public."${typeInfo.name}" AS ${typeInfo.base}; END IF; END $$;\n`);
          }
        }
      }

      // Tables
      if (comparisonResults.missingTables.length) {
        lines.push('\n-- ======= MISSING TABLES =======');
        const [cols, pks] = await Promise.all([
          fetchAllRpcRows('get_table_columns_info'),
          fetchAllRpcRows('get_primary_keys_info'),
        ]);
        for (const tableName of comparisonResults.missingTables) {
          const tableCols = (cols || []).filter((c: any) => c.table_name === tableName);
          if (tableCols.length === 0) { lines.push(`-- Table ${tableName}: No column info found`); continue; }
          const colDefs = tableCols.map((c: any) => {
            let def = `"${c.column_name}" ${mapColumnToSqlType(c)}`;
            if (c.column_default) def += ` DEFAULT ${c.column_default}`;
            if (c.is_nullable === 'NO') def += ' NOT NULL';
            return def;
          }).join(',\n  ');
          const tablePks = (pks || []).filter((p: any) => p.table_name === tableName).map((p: any) => `"${p.column_name}"`);
          const pkClause = tablePks.length > 0 ? `,\n  PRIMARY KEY (${tablePks.join(', ')})` : '';
          lines.push(`CREATE TABLE IF NOT EXISTS public."${tableName}" (\n  ${colDefs}${pkClause}\n);\nALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY;\n`);
        }
      }

      // Functions
      if (comparisonResults.missingFunctions.length) {
        lines.push('\n-- ======= MISSING FUNCTIONS =======');
        const funcs = await fetchAllRpcRows('get_db_functions_info');
        for (const funcName of comparisonResults.missingFunctions) {
          const funcDef = (funcs || []).find((f: any) => f.function_name === funcName);
          if (funcDef?.function_definition) {
            lines.push(funcDef.function_definition + ';\n');
          } else {
            lines.push(`-- Function ${funcName}: No definition found`);
          }
        }
      }

      // Triggers
      if (comparisonResults.missingTriggers.length) {
        lines.push('\n-- ======= MISSING TRIGGERS =======');
        const triggers = await fetchAllRpcRows('get_triggers_info');
        for (const triggerStr of comparisonResults.missingTriggers) {
          const [trigName, , tableName] = triggerStr.split(' ');
          const trigDef = (triggers || []).find((t: any) => t.trigger_name === trigName && t.event_object_table === tableName);
          if (trigDef) {
            lines.push(`CREATE OR REPLACE TRIGGER "${trigDef.trigger_name}" ${trigDef.action_timing} ${trigDef.event_manipulation} ON public."${trigDef.event_object_table}" FOR EACH ROW ${trigDef.action_statement};\n`);
          } else {
            lines.push(`-- Trigger ${triggerStr}: No definition found`);
          }
        }
      }

      // Foreign keys
      if (comparisonResults.missingTables.length) {
        const fks = await fetchAllRpcRows('get_foreign_keys_info');
        const relevantFks = (fks || []).filter((fk: any) => comparisonResults.missingTables.includes(fk.table_name));
        if (relevantFks.length) {
          lines.push('\n-- ======= FOREIGN KEYS =======');
          for (const fk of relevantFks) {
            lines.push(`DO $$ BEGIN ALTER TABLE public."${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES public."${fk.foreign_table_name}"("${fk.foreign_column_name}"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`);
          }
        }
      }

      lines.push("\nNOTIFY pgrst, 'reload schema';");
      setGeneratedScript(lines.join('\n'));
      setShowScriptDialog(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGeneratingScript(false);
    }
  };

  // Helper: map column info to SQL type
  const mapColumnToSqlType = (c: any): string => {
    if (c.udt_name === 'uuid') return 'UUID';
    if (c.udt_name === 'text') return 'TEXT';
    if (c.udt_name === 'bool') return 'BOOLEAN';
    if (c.udt_name === 'int4') return 'INTEGER';
    if (c.udt_name === 'int8') return 'BIGINT';
    if (c.udt_name === 'float8') return 'DOUBLE PRECISION';
    if (c.udt_name === 'float4') return 'REAL';
    if (c.udt_name === 'numeric') return 'NUMERIC';
    if (c.udt_name === 'timestamptz') return 'TIMESTAMP WITH TIME ZONE';
    if (c.udt_name === 'timestamp') return 'TIMESTAMP WITHOUT TIME ZONE';
    if (c.udt_name === 'date') return 'DATE';
    if (c.udt_name === 'time') return 'TIME';
    if (c.udt_name === 'timetz') return 'TIME WITH TIME ZONE';
    if (c.udt_name === 'jsonb') return 'JSONB';
    if (c.udt_name === 'json') return 'JSON';
    if (c.udt_name === 'bytea') return 'BYTEA';
    if (c.udt_name === 'inet') return 'INET';
    if (c.udt_name === 'cidr') return 'CIDR';
    if (c.udt_name === 'macaddr') return 'MACADDR';
    if (c.udt_name === 'interval') return 'INTERVAL';
    if (c.udt_name === '_text') return 'TEXT[]';
    if (c.udt_name === '_int4') return 'INTEGER[]';
    if (c.udt_name === '_int8') return 'BIGINT[]';
    if (c.udt_name === '_uuid') return 'UUID[]';
    if (c.udt_name === '_float8') return 'DOUBLE PRECISION[]';
    if (c.udt_name === '_bool') return 'BOOLEAN[]';
    if (c.udt_name === '_numeric') return 'NUMERIC[]';
    if (c.udt_name === '_jsonb') return 'JSONB[]';
    if (c.udt_name === 'varchar') return c.character_maximum_length ? `VARCHAR(${c.character_maximum_length})` : 'VARCHAR';
    if (c.data_type === 'USER-DEFINED') return `public."${c.udt_name}"`;
    if (c.data_type === 'ARRAY') return `${c.udt_name.replace(/^_/, '')}[]`;
    return c.data_type.toUpperCase();
  };

  // Helper: attempt to auto-fix SQL based on error message
  const autoFixSql = (sql: string, error: string): string | null => {
    const errLower = error.toLowerCase();

    // Fix: type does not exist - try creating it inline or removing the cast
    const typeNotExist = errLower.match(/type ["']?([^"'\s]+)["']? does not exist/);
    if (typeNotExist) {
      const missingType = typeNotExist[1];
      // Replace the custom type with TEXT as a safe fallback
      const fixed = sql.replace(new RegExp(`public\\."${missingType}"`, 'g'), 'TEXT')
                       .replace(new RegExp(`"${missingType}"`, 'g'), 'TEXT')
                       .replace(new RegExp(`::${missingType}`, 'g'), '::TEXT');
      return fixed;
    }

    // Fix: column default references missing type cast
    const castNotExist = errLower.match(/cannot cast.*to\s+(\w+)/);
    if (castNotExist) {
      // Remove the problematic default
      return sql.replace(/DEFAULT\s+[^,\n]+::[^,\n]+/g, '');
    }

    // Fix: relation already exists
    if (errLower.includes('already exists')) {
      return null; // Skip, it's already there
    }

    // Fix: syntax error near a keyword - try quoting the word
    const syntaxNear = errLower.match(/syntax error at or near "(\w+)"/);
    if (syntaxNear) {
      const keyword = syntaxNear[1];
      // If the keyword is a SQL reserved word used as type, it's likely USER-DEFINED not mapped
      const fixed = sql.replace(new RegExp(`\\b${keyword}-DEFINED\\b`, 'gi'), 'TEXT');
      if (fixed !== sql) return fixed;
    }

    // Fix: function/trigger references missing function
    const funcNotExist = errLower.match(/function\s+([^\s(]+)\s*\(/);
    if (funcNotExist && errLower.includes('does not exist')) {
      return null; // Can't fix missing dependency, will retry after functions are created
    }

    return null;
  };

  // Apply missing objects directly to external DB with auto-fix retry
  const applyMissingObjects = async () => {
    if (!comparisonResults) return;
    setApplyingMissingObjects(true);
    setShowComparisonDialog(false);
    setShowMigrationSyncDialog(true);
    setMigrationSyncErrors([]);
    
    interface FailedItem { category: string; name: string; sql: string; error: string; }
    const errors: string[] = [];
    const failedItems: FailedItem[] = [];
    
    const totalSteps = (comparisonResults.missingTypes?.length || 0) + comparisonResults.missingTables.length + comparisonResults.missingFunctions.length + comparisonResults.missingTriggers.length;
    let currentStep = 0;
    
    setMigrationSyncProgress({ current: 0, total: totalSteps, currentFile: '' });

    // Helper to execute SQL with error capture and real-time display
    const execWithCapture = async (category: string, name: string, sql: string): Promise<boolean> => {
      try {
        const result = await callExternalProxy('exec_sql', { sql });
        // Check for proxy-level error
        if (result && !result.success && result.error) {
          const errMsg = `❌ ${category} ${name}: ${result.error}`;
          failedItems.push({ category, name, sql, error: result.error });
          errors.push(errMsg);
          setMigrationSyncErrors([...errors]);
          return false;
        }
        // Check for SQL-level error embedded in data (exec_sql returns json with error field)
        if (result && result.data && typeof result.data === 'object' && result.data.error) {
          const sqlErr = result.data.detail ? `${result.data.error} (${result.data.detail})` : result.data.error;
          const errMsg = `❌ ${category} ${name}: ${sqlErr}`;
          failedItems.push({ category, name, sql, error: sqlErr });
          errors.push(errMsg);
          setMigrationSyncErrors([...errors]);
          return false;
        }
        return true;
      } catch (err: any) {
        const errMsg = `❌ ${category} ${name}: ${err.message}`;
        failedItems.push({ category, name, sql, error: err.message });
        errors.push(errMsg);
        setMigrationSyncErrors([...errors]);
        return false;
      }
    };

    // Fetch all metadata upfront to avoid repeated calls
    const [allCols, allPks, allFuncs, allTriggers, allFks] = await Promise.all([
      fetchAllRpcRows('get_table_columns_info'),
      fetchAllRpcRows('get_primary_keys_info'),
      fetchAllRpcRows('get_db_functions_info'),
      fetchAllRpcRows('get_triggers_info'),
      fetchAllRpcRows('get_foreign_keys_info'),
    ]);

    const buildCreateTypeSql = (typeInfo: any): string => {
      if (typeInfo?.type === 'enum' && typeInfo.values) {
        const vals = typeInfo.values.map((v: string) => `'${v.replace(/'/g, "''")}'`).join(', ');
        return `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeInfo.name}') THEN CREATE TYPE public."${typeInfo.name}" AS ENUM (${vals}); END IF; END $$;`;
      }
      if (typeInfo?.type === 'domain' && typeInfo.base) {
        return `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeInfo.name}') THEN CREATE DOMAIN public."${typeInfo.name}" AS ${typeInfo.base}; END IF; END $$;`;
      }
      return '';
    };

    const buildCreateTableSql = (tableName: string): string | null => {
      const tableCols = allCols.filter((c: any) => c.table_name === tableName);
      if (tableCols.length === 0) return null;

      const colDefs = tableCols.map((c: any) => {
        let def = `"${c.column_name}" ${mapColumnToSqlType(c)}`;
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        return def;
      }).join(',\n  ');

      const tablePks = allPks.filter((p: any) => p.table_name === tableName).map((p: any) => `"${p.column_name}"`);
      const pkClause = tablePks.length > 0 ? `,\n  PRIMARY KEY (${tablePks.join(', ')})` : '';

      return `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n  ${colDefs}${pkClause}\n)`;
    };

    // 0. Create missing types
    if (comparisonResults.missingTypes && comparisonResults.missingTypes.length > 0) {
      for (const typeInfo of comparisonResults.missingTypes) {
        currentStep++;
        setMigrationSyncProgress({ current: currentStep, total: totalSteps, currentFile: `Type: ${typeInfo.name}` });
        const createSql = buildCreateTypeSql(typeInfo);
        if (createSql) await execWithCapture('Type', typeInfo.name, createSql);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    // 1. Create missing tables (pre-create sequences referenced in column defaults)
    const ensureSequencesForTable = async (tableName: string) => {
      const tableCols = allCols.filter((c: any) => c.table_name === tableName);
      const seqRegex = /nextval\('([^']+)'::regclass\)/gi;
      for (const col of tableCols) {
        if (col.column_default) {
          let m: RegExpExecArray | null;
          seqRegex.lastIndex = 0;
          while ((m = seqRegex.exec(col.column_default)) !== null) {
            const seqName = m[1].replace(/^public\./, '');
            console.log(`Pre-creating sequence: ${seqName}`);
            await callExternalProxy('exec_sql', { sql: `CREATE SEQUENCE IF NOT EXISTS public."${seqName}"` }).catch(() => {});
          }
        }
      }
    };

    for (const tableName of comparisonResults.missingTables) {
      currentStep++;
      setMigrationSyncProgress({ current: currentStep, total: totalSteps, currentFile: `Table: ${tableName}` });
      const createSql = buildCreateTableSql(tableName);
      if (!createSql) {
        errors.push(`Table ${tableName}: No column info found locally`);
        continue;
      }
      await ensureSequencesForTable(tableName);
      await execWithCapture('Table', tableName, createSql);
      await callExternalProxy('exec_sql', { sql: `ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY` }).catch(() => {});
      await new Promise(r => setTimeout(r, 50));
    }

    // 2. Create missing functions (dependency-aware ordering)
    const functionPriority = ['has_role', 'is_admin', 'update_updated_at_column'];
    const sortedMissingFunctions = [...comparisonResults.missingFunctions].sort((a, b) => {
      const ai = functionPriority.indexOf(a);
      const bi = functionPriority.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    for (const funcName of sortedMissingFunctions) {
      currentStep++;
      setMigrationSyncProgress({ current: currentStep, total: totalSteps, currentFile: `Function: ${funcName}` });

      const funcDef = allFuncs.find((f: any) => f.function_name === funcName);
      if (!funcDef?.function_definition) {
        errors.push(`Function ${funcName}: No definition found locally`);
        continue;
      }
      await execWithCapture('Function', funcName, funcDef.function_definition);
      await new Promise(r => setTimeout(r, 50));
    }

    // 3. Create missing triggers
    for (const triggerStr of comparisonResults.missingTriggers) {
      currentStep++;
      setMigrationSyncProgress({ current: currentStep, total: totalSteps, currentFile: `Trigger: ${triggerStr}` });
      
      const [trigName, , tableName] = triggerStr.split(' ');
      const trigDef = allTriggers.find((t: any) => t.trigger_name === trigName && t.event_object_table === tableName);
      
      if (!trigDef) {
        errors.push(`Trigger ${triggerStr}: No definition found locally`);
        continue;
      }
      const createTriggerSql = `DO $$ BEGIN CREATE TRIGGER "${trigDef.trigger_name}" ${trigDef.action_timing} ${trigDef.event_manipulation} ON public."${trigDef.event_object_table}" FOR EACH ROW ${trigDef.action_statement}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
      await execWithCapture('Trigger', triggerStr, createTriggerSql);
      await new Promise(r => setTimeout(r, 50));
    }

    // === MULTI-PASS AUTO-FIX RETRY PHASE ===
    // Retry failed items up to 3 passes to resolve dependency chains
    // (e.g. pass 1 creates tables, pass 2 creates functions that need those tables, 
    //  pass 3 creates functions that need those functions)
    const MAX_RETRY_PASSES = 3;
    
    // Sort failed items by dependency order: Types → Tables → Functions → Triggers
    const categoryOrder: Record<string, number> = { 'Type': 0, 'Table': 1, 'Function': 2, 'Trigger': 3 };
    const functionPriorityMap = new Map<string, number>([
      ['has_role', 0],
      ['is_admin', 1],
      ['update_updated_at_column', 2],
    ]);
    const sortRetryItems = (items: FailedItem[]) =>
      [...items].sort((a, b) => {
        const catDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
        if (catDiff !== 0) return catDiff;
        if (a.category === 'Function' && b.category === 'Function') {
          const ap = functionPriorityMap.get(a.name) ?? 999;
          const bp = functionPriorityMap.get(b.name) ?? 999;
          if (ap !== bp) return ap - bp;
        }
        return a.name.localeCompare(b.name);
      });

    let retryItems = sortRetryItems(failedItems);
    failedItems.length = 0;

    for (let pass = 1; pass <= MAX_RETRY_PASSES && retryItems.length > 0; pass++) {
      // Clear errors from previous pass - only keep final pass errors
      errors.splice(0, errors.length);
      setMigrationSyncErrors([]);

      const stillFailing: FailedItem[] = [];

      setMigrationSyncProgress({ current: 0, total: retryItems.length, currentFile: `Retry pass ${pass}/${MAX_RETRY_PASSES}...` });

      for (let i = 0; i < retryItems.length; i++) {
        const item = retryItems[i];
        setMigrationSyncProgress({ current: i + 1, total: retryItems.length, currentFile: `Pass ${pass}: ${item.category} ${item.name}` });

        // Try to auto-create missing dependencies (types/tables/functions) before retrying
        const relationMissing = item.error.match(/relation\s+"?public\.([a-zA-Z0-9_]+)"?\s+does not exist/i);
        if (relationMissing) {
          const depTable = relationMissing[1];

          // Ensure user-defined types used by this table exist first
          const depTableCols = allCols.filter((c: any) => c.table_name === depTable);
          const depUdtNames = [...new Set(depTableCols.filter((c: any) => c.data_type === 'USER-DEFINED').map((c: any) => c.udt_name))];
          for (const udtName of depUdtNames) {
            const typeInfo = comparisonResults.localTypes?.find((t: any) => t.name === udtName);
            const depTypeSql = buildCreateTypeSql(typeInfo);
            if (depTypeSql) {
              try { await callExternalProxy('exec_sql', { sql: depTypeSql }); } catch {}
            }
          }

          const depTableSql = buildCreateTableSql(depTable);
          if (depTableSql) {
            try {
              await ensureSequencesForTable(depTable);
              await callExternalProxy('exec_sql', { sql: depTableSql });
              await callExternalProxy('exec_sql', { sql: `ALTER TABLE public."${depTable}" ENABLE ROW LEVEL SECURITY` });
            } catch {}
          }
        }

        const typeMissing = item.error.match(/type\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
        if (typeMissing) {
          const depType = typeMissing[1];
          const typeInfo = comparisonResults.localTypes?.find((t: any) => t.name === depType);
          const depTypeSql = buildCreateTypeSql(typeInfo);
          if (depTypeSql) {
            try { await callExternalProxy('exec_sql', { sql: depTypeSql }); } catch {}
          }
        }

        const functionMissing = item.error.match(/function\s+public\.([a-zA-Z0-9_]+)\s*\(/i);
        if (functionMissing) {
          const depFunc = functionMissing[1];
          const depFuncDef = allFuncs.find((f: any) => f.function_name === depFunc)?.function_definition;
          if (depFuncDef) {
            try { await callExternalProxy('exec_sql', { sql: depFuncDef }); } catch {}
          }
        }

        // Try auto-fix based on error
        const fixedSql = autoFixSql(item.sql, item.error);
        const sqlToTry = fixedSql || item.sql;

        try {
          const result = await callExternalProxy('exec_sql', { sql: sqlToTry });
          const hasProxyError = result && !result.success && result.error;
          const hasSqlError = result && result.data && typeof result.data === 'object' && result.data.error;
          if (hasProxyError || hasSqlError) {
            const errorDetail = hasProxyError ? result.error : (result.data.detail ? `${result.data.error} (${result.data.detail})` : result.data.error);
            stillFailing.push({ category: item.category, name: item.name, sql: item.sql, error: errorDetail });
          }
        } catch (err: any) {
          stillFailing.push({ category: item.category, name: item.name, sql: item.sql, error: err.message });
        }
        await new Promise(r => setTimeout(r, 50));
      }

      // If nothing was resolved this pass, stop retrying
      if (stillFailing.length === retryItems.length && pass > 1) {
        retryItems = stillFailing;
        break;
      }

      // Re-sort remaining items by dependency order for next pass
      retryItems = sortRetryItems(stillFailing);
    }
    
    // Add final remaining errors to display
    for (const item of retryItems) {
      const errMsg = `❌ ${item.category} ${item.name}:\nError: ${item.error}\nSQL: ${item.sql.substring(0, 800)}${item.sql.length > 800 ? '...' : ''}`;
      errors.push(errMsg);
    }
    if (errors.length > 0) {
      setMigrationSyncErrors([...errors]);
    }

    // 4. Add foreign keys for missing tables
    setMigrationSyncProgress({ current: totalSteps, total: totalSteps, currentFile: 'Foreign keys...' });
    const relevantFks = allFks.filter((fk: any) => comparisonResults.missingTables.includes(fk.table_name));
    for (const fk of relevantFks) {
      const fkSql = `DO $$ BEGIN ALTER TABLE public."${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES public."${fk.foreign_table_name}"("${fk.foreign_column_name}"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
      await callExternalProxy('exec_sql', { sql: fkSql }).catch(() => {});
    }

    // 5. Reload PostgREST schema cache
    try {
      await callExternalProxy('exec_sql', { sql: `NOTIFY pgrst, 'reload schema'` });
    } catch {}

    setMigrationSyncErrors(errors);
    setApplyingMissingObjects(false);
    
    if (errors.length === 0) {
      toast.success(isRTL ? 'تم تطبيق جميع الكائنات المفقودة بنجاح' : 'All missing objects applied successfully');
    } else {
      toast.warning(isRTL ? `تم التطبيق مع ${errors.length} أخطاء` : `Applied with ${errors.length} errors`);
    }

    // Only auto-close and re-run if no errors; otherwise keep dialog open so user can see failed SQL
    if (errors.length === 0) {
      setShowMigrationSyncDialog(false);
      setTimeout(() => {
        handleMatchCurrentSituation();
      }, 500);
    }
  };

  // Match current situation - compare local vs external DB objects
  const handleMatchCurrentSituation = async () => {
    setMatchingCurrentSituation(true);
    try {
      // Query LOCAL tables, functions, triggers, types using paged RPC readers
      const [localColsData, localFunctionsData, localTriggersData, localTypesData] = await Promise.all([
        fetchAllRpcRows('get_table_columns_info'),
        fetchAllRpcRows('get_db_functions_info'),
        fetchAllRpcRows('get_triggers_info'),
        fetchAllRpcRows('get_user_defined_types_info'),
      ]);

      const localTables = [...new Set(localColsData.map((r: any) => r.table_name))].sort() as string[];
      const localFunctions = [...new Set(localFunctionsData.map((r: any) => r.function_name))].sort() as string[];
      const localTriggers = [...new Set(localTriggersData.map((r: any) => `${r.trigger_name} ON ${r.event_object_table}`))].sort() as string[];
      const localTypes = localTypesData
        .filter((t: any) => t.type_type === 'enum' || t.type_type === 'domain')
        .map((t: any) => ({ name: t.type_name, type: t.type_type, values: t.enum_values, base: t.base_type }));
      const localViews: string[] = [];

      // Query EXTERNAL tables, functions, triggers, views, types
      const [extTablesRes, extFunctionsRes, extTriggersRes, extViewsRes, extTypesRes] = await Promise.all([
        callExternalProxy('exec_sql', { sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name` }),
        callExternalProxy('exec_sql', { sql: `SELECT proname AS function_name FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.prokind = 'f' ORDER BY proname` }),
        callExternalProxy('exec_sql', { sql: `SELECT DISTINCT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY trigger_name` }),
        callExternalProxy('exec_sql', { sql: `SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name` }),
        callExternalProxy('exec_sql', { sql: `SELECT typname AS type_name FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd') ORDER BY typname` }),
      ]);

      const externalTables = (extTablesRes.success && Array.isArray(extTablesRes.data)) ? extTablesRes.data.map((r: any) => r.table_name) : [];
      const externalFunctions = (extFunctionsRes.success && Array.isArray(extFunctionsRes.data)) ? [...new Set(extFunctionsRes.data.map((r: any) => r.function_name))] as string[] : [];
      const externalTriggers = (extTriggersRes.success && Array.isArray(extTriggersRes.data)) ? extTriggersRes.data.map((r: any) => `${r.trigger_name} ON ${r.event_object_table}`) : [];
      const externalViews = (extViewsRes.success && Array.isArray(extViewsRes.data)) ? extViewsRes.data.map((r: any) => r.table_name) : [];
      const externalTypes = (extTypesRes.success && Array.isArray(extTypesRes.data)) ? extTypesRes.data.map((r: any) => r.type_name) : [];

      const extTablesSet = new Set(externalTables);
      const extFunctionsSet = new Set(externalFunctions);
      const extTriggersSet = new Set(externalTriggers);
      const extViewsSet = new Set(externalViews);
      const extTypesSet = new Set(externalTypes);

      const missingTablesBase = localTables.filter((t: string) => !extTablesSet.has(t));
      const missingFunctions = localFunctions.filter((f: string) => !extFunctionsSet.has(f));
      const missingTriggers = localTriggers.filter((t: string) => !extTriggersSet.has(t));
      const missingViews = localViews.filter((v: string) => !extViewsSet.has(v));
      const missingTypes = localTypes.filter((t: any) => !extTypesSet.has(t.name));

      // Infer table dependencies from missing functions/triggers so critical tables (e.g. user_roles)
      // are visible in "Missing Tables" even when only discovered through function/trigger failures.
      const localFunctionDefMap = new Map<string, string>(
        localFunctionsData.map((r: any) => [r.function_name, r.function_definition || ''])
      );
      const inferredDependencyTables = new Set<string>();

      for (const fnName of missingFunctions) {
        const fnDef = localFunctionDefMap.get(fnName);
        if (!fnDef || typeof fnDef !== 'string') continue;

        const tableRefRegex = /(?:from|join|update|into|delete\s+from|table)\s+public\."?([a-zA-Z0-9_]+)"?/gi;
        let match: RegExpExecArray | null;
        while ((match = tableRefRegex.exec(fnDef)) !== null) {
          inferredDependencyTables.add(match[1]);
        }
      }

      for (const triggerLabel of missingTriggers) {
        const [, triggerTable] = triggerLabel.split(' ON ');
        if (triggerTable) inferredDependencyTables.add(triggerTable);
      }

      // Avoid misclassifying function names as table names.
      for (const fnName of localFunctions) {
        inferredDependencyTables.delete(fnName);
      }

      const inferredMissingTables = Array.from(inferredDependencyTables).filter((t) => !extTablesSet.has(t));
      const missingTables = [...new Set([...missingTablesBase, ...inferredMissingTables])].sort();

      const hasMissing = missingTables.length > 0 || missingFunctions.length > 0 || missingTriggers.length > 0 || missingViews.length > 0 || missingTypes.length > 0;

      const matchedMigrations = localMigrations.map(m => m.version);
      const unmatchedMigrations: string[] = [];

      setComparisonResults({
        localTables, externalTables, missingTables,
        localFunctions, externalFunctions, missingFunctions,
        localTriggers, externalTriggers, missingTriggers,
        localViews, externalViews, missingViews,
        localTypes, externalTypes, missingTypes,
        matchedMigrations, unmatchedMigrations,
      });

      await saveMigrationLog(matchedMigrations);
      setShowComparisonDialog(true);

      if (hasMissing) {
        toast.warning(isRTL
          ? `تم العثور على ${missingTypes.length} أنواع و ${missingTables.length} جداول و ${missingFunctions.length} دوال و ${missingTriggers.length} مشغلات مفقودة`
          : `Found ${missingTypes.length} types, ${missingTables.length} tables, ${missingFunctions.length} functions, ${missingTriggers.length} triggers missing`);
      } else {
        toast.success(isRTL ? 'جميع الكائنات متطابقة' : 'All objects match between local and external DB');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMatchingCurrentSituation(false);
    }
  };

  // Auto-load migration tracking state when connection changes
  useEffect(() => {
    if (useExternalSupabase && externalUrl && connectionValid === true) {
      loadMigrationTrackingState(externalUrl);
    }
  }, [useExternalSupabase, externalUrl, connectionValid]);

  // Fetch tables from external Supabase
  const fetchExternalTables = async (url: string, anonKey: string) => {
    setLoadingTables(true);
    setTablesError(null);
    setExternalTables([]);
    
    try {
      const result = await supabase.functions.invoke('external-supabase-proxy', {
        body: {
          action: 'fetch_tables',
          externalUrl: url,
          externalAnonKey: anonKey
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      const data = result.data;
      
      if (!data.success) {
        if (data.code === 'INVALID_SUPABASE_URL' || data.error?.toLowerCase?.().includes('<!doctype html')) {
          setTablesError(isRTL ? 'رابط Supabase غير صحيح. استخدم رابط الـ API مثل https://<project-ref>.supabase.co' : 'Invalid SUPABASE_URL. Use the API URL like https://<project-ref>.supabase.co');
          setConnectionValid(false);
        } else if (data.error?.includes('exec_sql') || data.error?.includes('function') || data.code === 'PGRST202') {
          setTablesError(isRTL ? 'دالة exec_sql غير موجودة في المشروع الخارجي' : 'exec_sql function not found in external project');
          setConnectionValid(false);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } else {
        const tables = data.tables || [];
        setExternalTables(tables.map((t: any) => ({ name: t.name, rowCount: t.row_count || 0 })));
        setConnectionValid(true);
        
        if (tables.length === 0) {
          setTablesError(isRTL ? 'لم يتم العثور على جداول في المشروع الخارجي' : 'No tables found in external project');
        }
      }
    } catch (error: any) {
      console.error('Error fetching tables:', error);
      setTablesError(error.message);
      setConnectionValid(false);
    } finally {
      setLoadingTables(false);
    }
  };
  
  // Auto-fetch tables when URL and Anon Key are both provided
  useEffect(() => {
    if (useExternalSupabase && externalUrl && externalAnonKey) {
      // Debounce the fetch
      const timer = setTimeout(() => {
        fetchExternalTables(externalUrl, externalAnonKey);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setExternalTables([]);
      setTablesError(null);
      setConnectionValid(null);
    }
  }, [useExternalSupabase, externalUrl, externalAnonKey]);
  
  // Test external connection
  const testExternalConnection = async () => {
    if (!externalUrl || !externalAnonKey) {
      toast.error(isRTL ? 'يرجى إدخال URL و Anon Key' : 'Please enter URL and Anon Key');
      return;
    }
    
    setTestingConnection(true);
    setConnectionValid(null);
    
    try {
      const result = await supabase.functions.invoke('external-supabase-proxy', {
        body: {
          action: 'test_connection',
          externalUrl,
          externalAnonKey
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      const data = result.data;
      
      if (!data.success) {
        if (data.code === 'INVALID_SUPABASE_URL' || data.error?.toLowerCase?.().includes('<!doctype html')) {
          setConnectionValid(false);
          toast.error(
            isRTL
              ? 'رابط Supabase غير صحيح. استخدم رابط الـ API مثل https://<project-ref>.supabase.co'
              : 'Invalid SUPABASE_URL. Use the API URL like https://<project-ref>.supabase.co'
          );
        } else if (data.error?.includes('exec_sql') || data.error?.includes('function') || data.code === 'PGRST202') {
          toast.warning(isRTL ? 'الاتصال ناجح لكن دالة exec_sql غير موجودة' : 'Connection successful but exec_sql function not found');
          setConnectionValid(false);
        } else {
          throw new Error(data.error || 'Connection failed');
        }
      } else {
        setConnectionValid(true);
        toast.success(isRTL ? 'تم الاتصال بنجاح' : 'Connection successful');
        // Refresh tables
        fetchExternalTables(externalUrl, externalAnonKey);
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setConnectionValid(false);
      toast.error(isRTL ? 'فشل الاتصال: ' + error.message : 'Connection failed: ' + error.message);
    } finally {
      setTestingConnection(false);
    }
  };
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

  // Parse structure SQL to extract individual objects
  const parseStructureStatements = (sql: string): {name: string, type: string, sql: string}[] => {
    const statements: {name: string, type: string, sql: string}[] = [];
    
    // Split SQL by semicolons but handle function bodies properly
    const rawStatements = sql.split(/;(?=\s*(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE|SET|DO|--|$))/gi);
    
    for (const rawStmt of rawStatements) {
      const stmt = rawStmt.trim();
      if (!stmt || stmt.startsWith('--')) continue;
      
      // Detect statement type and extract name
      let name = 'Unknown';
      let type: string = 'other';
      
      // CREATE TABLE - improved regex to handle various formats including quoted names and schemas
      const tableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:public|"public")\.)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
      if (tableMatch) {
        name = tableMatch[1] || tableMatch[2] || tableMatch[3];
        type = 'table';
      }
      
      // CREATE OR REPLACE FUNCTION - only if not already matched
      if (type === 'other') {
        const funcMatch = stmt.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:(?:public|"public")\.)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (funcMatch) {
          name = funcMatch[1] || funcMatch[2] || funcMatch[3];
          type = 'function';
        }
      }
      
      // CREATE TRIGGER - only if not already matched
      if (type === 'other') {
        const triggerMatch = stmt.match(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (triggerMatch) {
          name = triggerMatch[1] || triggerMatch[2] || triggerMatch[3];
          type = 'trigger';
        }
      }
      
      // CREATE INDEX - only if not already matched
      if (type === 'other') {
        const indexMatch = stmt.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (indexMatch) {
          name = indexMatch[1] || indexMatch[2] || indexMatch[3];
          type = 'index';
        }
      }
      
      // CREATE POLICY - only if not already matched
      if (type === 'other') {
        const policyMatch = stmt.match(/CREATE\s+POLICY\s+(?:"([^"]+)"|'([^']+)'|([^\s"']+))/i);
        if (policyMatch) {
          name = policyMatch[1] || policyMatch[2] || policyMatch[3];
          type = 'policy';
        }
      }
      
      // CREATE TYPE - only if not already matched
      if (type === 'other') {
        const typeMatch = stmt.match(/CREATE\s+TYPE\s+(?:(?:public|"public")\.)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (typeMatch) {
          name = typeMatch[1] || typeMatch[2] || typeMatch[3];
          type = 'type';
        }
      }
      
      // CREATE SEQUENCE - only if not already matched
      if (type === 'other') {
        const seqMatch = stmt.match(/CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:public|"public")\.)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (seqMatch) {
          name = seqMatch[1] || seqMatch[2] || seqMatch[3];
          type = 'sequence';
        }
      }
      
      // ALTER TABLE - check for foreign key constraints first
      if (type === 'other') {
        const alterMatch = stmt.match(/ALTER\s+TABLE\s+(?:ONLY\s+)?(?:(?:public|"public")\.)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (alterMatch) {
          const tableName = alterMatch[1] || alterMatch[2] || alterMatch[3];
          // Check if this is a foreign key constraint
          if (stmt.match(/ADD\s+CONSTRAINT.*FOREIGN\s+KEY/i) || stmt.match(/REFERENCES\s+/i)) {
            const fkMatch = stmt.match(/CONSTRAINT\s+(?:"([^"]+)"|'([^']+)'|(\w+))/i);
            const fkName = fkMatch ? (fkMatch[1] || fkMatch[2] || fkMatch[3]) : `FK_${tableName}`;
            name = `FK: ${fkName}`;
            type = 'foreignkey';
          } else {
            name = `ALTER ${tableName}`;
            type = 'alter';
          }
        }
      }
      
      // GRANT/REVOKE statements
      if (type === 'other' && stmt.match(/^(GRANT|REVOKE)\s+/i)) {
        const grantMatch = stmt.match(/(?:GRANT|REVOKE).*?ON\s+(?:TABLE\s+)?(?:(?:public|"public")\.)?(?:"([^"]+)"|'([^']+)'|(\w+))/i);
        if (grantMatch) {
          const tableName = grantMatch[1] || grantMatch[2] || grantMatch[3];
          name = `Permission: ${tableName}`;
        } else {
          name = 'Permission';
        }
        type = 'permission';
      }
      
      statements.push({ name, type, sql: stmt });
    }
    
    return statements;
  };

  // Check for existing tables in target database
  const checkExistingObjects = async (statements: {name: string, type: string, sql: string}[]): Promise<ConflictingObject[]> => {
    const conflicts: ConflictingObject[] = [];
    const tableNames = statements.filter(s => s.type === 'table').map(s => s.name);
    
    if (tableNames.length === 0) return [];
    
    try {
      if (useExternalSupabase && externalUrl && externalAnonKey) {
        // Use external tables that were already fetched
        for (const tableName of tableNames) {
          if (externalTables.some(t => t.name.toLowerCase() === tableName.toLowerCase())) {
            conflicts.push({ name: tableName, type: 'table' });
          }
        }
      } else {
        // Check local database
        for (const tableName of tableNames) {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}')`
          });
          if (!error && data === true) {
            conflicts.push({ name: tableName, type: 'table' });
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing objects:', error);
    }
    
    return conflicts;
  };

  const handleRestoreStructure = async () => {
    if (!structureFile) {
      toast.error(isRTL ? 'يرجى اختيار ملف الهيكل أولاً' : 'Please select a structure file first');
      return;
    }
    
    setProgress(prev => ({ ...prev, structure: 'parsing' }));
    setRestoreErrors([]);
    setStructureRestoreList([]);
    setIsStructureRestoreComplete(false);
    
    try {
      const sql = await structureFile.text();
      
      // Parse SQL into individual statements with metadata
      const statements = parseStructureStatements(sql);
      
      if (statements.length === 0) {
        toast.error(isRTL ? 'لم يتم العثور على عبارات SQL' : 'No SQL statements found');
        setProgress(prev => ({ ...prev, structure: 'error' }));
        return;
      }
      
      // Store parsed statements for step-by-step execution
      setParsedStatements(statements);
      
      // Organize statements by step
      const updatedSteps = restoreSteps.map(step => {
        const stepItems = statements.filter(s => step.types.includes(s.type as any));
        return {
          ...step,
          items: stepItems.map(s => ({
            name: s.name,
            type: s.type as StructureRestoreItem['type'],
            status: 'pending' as const,
            existsInTarget: false
          })),
          status: 'pending' as const,
          completedCount: 0,
          errorCount: 0
        };
      });
      setRestoreSteps(updatedSteps);
      
      // Check for existing tables that would conflict
      const conflicts = await checkExistingObjects(statements);
      
      if (conflicts.length > 0) {
        // Show conflict dialog
        setConflictingObjects(conflicts);
        setPendingStructureStatements(statements);
        setShowConflictDialog(true);
        setProgress(prev => ({ ...prev, structure: 'idle' }));
        return;
      }
      
      // No conflicts, proceed with restore
      await executeStructureRestore(statements, false);
      
    } catch (error: any) {
      console.error('Error parsing structure file:', error);
      setProgress(prev => ({ ...prev, structure: 'error' }));
      toast.error(error.message || (isRTL ? 'فشل في قراءة ملف الهيكل' : 'Failed to read structure file'));
    }
  };

  const handleConfirmReplace = async () => {
    setShowConflictDialog(false);
    await executeStructureRestore(pendingStructureStatements, replaceExisting);
    setPendingStructureStatements([]);
    setConflictingObjects([]);
    setReplaceExisting(false);
  };

  const handleCancelReplace = () => {
    setShowConflictDialog(false);
    setPendingStructureStatements([]);
    setConflictingObjects([]);
    setReplaceExisting(false);
    setProgress(prev => ({ ...prev, structure: 'idle' }));
  };

  const toggleStepEnabled = (stepKey: RestoreStepKey) => {
    setRestoreSteps(prev => prev.map(step => 
      step.key === stepKey ? { ...step, enabled: !step.enabled } : step
    ));
  };

  const toggleStepExpanded = (stepKey: RestoreStepKey) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepKey)) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  };

  const executeStructureRestore = async (statements: {name: string, type: string, sql: string}[], dropExisting: boolean) => {
    setProgress(prev => ({ ...prev, structure: 'executing' }));
    setShowStructureProgressDialog(true);
    setIsStructureRestoreComplete(false);
    
    // Initialize progress list with all items
    const progressList: StructureRestoreItem[] = statements.map(s => ({
      name: s.name,
      type: s.type as StructureRestoreItem['type'],
      status: 'pending',
      existsInTarget: conflictingObjects.some(c => c.name.toLowerCase() === s.name.toLowerCase())
    }));
    
    setStructureRestoreList(progressList);
    
    // Yield to let UI render
    await new Promise(r => setTimeout(r, 50));
    
    const errors: string[] = [];
    let successCount = 0;
    let skippedCount = 0;
    
    // Define step order and their types
    const stepOrder: { key: RestoreStepKey; types: string[] }[] = [
      { key: 'types', types: ['type'] },
      { key: 'tables', types: ['table'] },
      { key: 'foreignkeys', types: ['foreignkey', 'alter'] },
      { key: 'indexes', types: ['index'] },
      { key: 'functions', types: ['function'] },
      { key: 'triggers', types: ['trigger'] },
      { key: 'policies', types: ['policy', 'permission'] },
    ];
    
    // Process each step in order
    for (const stepDef of stepOrder) {
      const step = restoreSteps.find(s => s.key === stepDef.key);
      if (!step || !step.enabled) {
        // Mark all items of this step as skipped
        const skipTypes = stepDef.types;
        setStructureRestoreList(prev => prev.map(item => 
          skipTypes.includes(item.type) ? { ...item, status: 'skipped' } : item
        ));
        setRestoreSteps(prev => prev.map(s => 
          s.key === stepDef.key ? { ...s, status: 'skipped' } : s
        ));
        skippedCount += statements.filter(s => skipTypes.includes(s.type)).length;
        continue;
      }
      
      // Set current step as executing
      setCurrentStepKey(stepDef.key);
      setRestoreSteps(prev => prev.map(s => 
        s.key === stepDef.key ? { ...s, status: 'executing' } : s
      ));
      
      // Get statements for this step
      const stepStatements = statements.filter(s => stepDef.types.includes(s.type));
      let stepCompleted = 0;
      let stepErrors = 0;
      
      for (const stmt of stepStatements) {
        const idx = statements.indexOf(stmt);
        const isConflicting = conflictingObjects.some(c => c.name.toLowerCase() === stmt.name.toLowerCase());
        
        setCurrentStructureItem(stmt.name);
        
        // Update status to executing
        setStructureRestoreList(prev => prev.map((t, i) => 
          i === idx ? { ...t, status: 'executing' } : t
        ));
        
        await new Promise(r => setTimeout(r, 10));
        
        try {
          // If table exists and user chose to replace, drop it first
          if (isConflicting && stmt.type === 'table') {
            if (dropExisting) {
              const dropSql = `DROP TABLE IF EXISTS public.${stmt.name} CASCADE`;
              if (useExternalSupabase && externalUrl && externalAnonKey) {
                await callExternalProxy('exec_sql', { sql: dropSql });
              } else {
                await supabase.rpc('exec_sql', { sql: dropSql });
              }
            } else {
              // Skip this table
              setStructureRestoreList(prev => prev.map((t, i) => 
                i === idx ? { ...t, status: 'skipped' } : t
              ));
              skippedCount++;
              continue;
            }
          }
          
          // Execute the statement
          if (useExternalSupabase && externalUrl && externalAnonKey) {
            const result = await callExternalProxy('exec_sql', { sql: stmt.sql + ';' });
            if (!result.success && result.error) {
              // Check if it's a "already exists" error and we can skip
              if (result.error.includes('already exists')) {
                setStructureRestoreList(prev => prev.map((t, i) => 
                  i === idx ? { ...t, status: 'skipped' } : t
                ));
                skippedCount++;
                continue;
              }
              throw new Error(result.error);
            }
          } else {
            const { error } = await supabase.rpc('exec_sql', { sql: stmt.sql + ';' });
            if (error) {
              if (error.message.includes('already exists')) {
                setStructureRestoreList(prev => prev.map((t, i) => 
                  i === idx ? { ...t, status: 'skipped' } : t
                ));
                skippedCount++;
                continue;
              }
              throw error;
            }
          }
          
          successCount++;
          stepCompleted++;
          setStructureRestoreList(prev => prev.map((t, i) => 
            i === idx ? { ...t, status: 'done' } : t
          ));
          
          // Update step progress
          setRestoreSteps(prev => prev.map(s => 
            s.key === stepDef.key ? { ...s, completedCount: stepCompleted } : s
          ));
          
        } catch (err: any) {
          errors.push(`${stmt.type} "${stmt.name}": ${err.message}`);
          stepErrors++;
          setStructureRestoreList(prev => prev.map((t, i) => 
            i === idx ? { ...t, status: 'error', errorMessage: err.message } : t
          ));
          setRestoreSteps(prev => prev.map(s => 
            s.key === stepDef.key ? { ...s, errorCount: stepErrors } : s
          ));
        }
        
        // Small delay for UI updates
        await new Promise(r => setTimeout(r, 5));
      }
      
      // Mark step as done or error
      setRestoreSteps(prev => prev.map(s => 
        s.key === stepDef.key ? { ...s, status: stepErrors > 0 ? 'error' : 'done' } : s
      ));
    }
    
    setCurrentStepKey(null);
    setCurrentStructureItem(null);
    setIsStructureRestoreComplete(true);
    
    if (errors.length > 0) {
      setRestoreErrors(errors);
      setProgress(prev => ({ ...prev, structure: 'error' }));
      toast.warning(
        isRTL 
          ? `تم تنفيذ ${successCount} عبارة، تخطي ${skippedCount}، ${errors.length} أخطاء` 
          : `Executed ${successCount} statements, skipped ${skippedCount}, ${errors.length} errors`
      );
    } else {
      setProgress(prev => ({ ...prev, structure: 'done' }));
      toast.success(
        isRTL 
          ? `تم استعادة الهيكل بنجاح (${successCount} عبارة${skippedCount > 0 ? `، تخطي ${skippedCount}` : ''})` 
          : `Structure restored successfully (${successCount} statements${skippedCount > 0 ? `, skipped ${skippedCount}` : ''})`
      );
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
            // Use proxy for external or direct for local
            if (useExternalSupabase && externalUrl && externalAnonKey) {
              const result = await callExternalProxy('exec_sql', { sql: batchSql });
              if (!result.success) {
                errors.push(`${item.tableName}: ${result.error}`);
              } else {
                tableInserted += batch.length;
                insertedTotal += batch.length;
              }
            } else {
              const { error } = await supabase.rpc('exec_sql', { sql: batchSql });
              if (error) {
                errors.push(`${item.tableName}: ${error.message}`);
              } else {
                tableInserted += batch.length;
                insertedTotal += batch.length;
              }
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

  // Generate SQL for manual execution (for self-hosted Supabase without API access)
  const handleGenerateSql = async (type: 'structure' | 'data') => {
    const file = type === 'structure' ? structureFile : dataFile;
    if (!file) {
      toast.error(isRTL ? 'يرجى اختيار الملف أولاً' : 'Please select a file first');
      return;
    }
    
    setGeneratingSql(true);
    
    try {
      let sql: string;
      
      if (file.name.endsWith('.gz')) {
        sql = await decompressGzip(file);
      } else {
        sql = await file.text();
      }
      
      setGeneratedSql(sql);
      setShowManualSqlDialog(true);
    } catch (error: any) {
      console.error('Error reading file:', error);
      toast.error(error.message || (isRTL ? 'فشل في قراءة الملف' : 'Failed to read file'));
    } finally {
      setGeneratingSql(false);
    }
  };
  
  const handleDownloadSql = () => {
    const blob = new Blob([generatedSql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'restore.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تحميل الملف' : 'File downloaded');
  };
  
  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(generatedSql);
      toast.success(isRTL ? 'تم نسخ SQL إلى الحافظة' : 'SQL copied to clipboard');
    } catch (error) {
      toast.error(isRTL ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  const loadAvailableTables = async () => {
    setLoadingAvailableTables(true);
    try {
      const { data: tablesResult, error: tablesErr } = await supabase.functions.invoke('migrate-to-external', {
        body: { action: 'list_tables' }
      });
      if (tablesErr || !tablesResult?.success) {
        toast.error(isRTL ? 'فشل في تحميل الجداول' : 'Failed to load tables');
        return;
      }
      const tables = (tablesResult.tables || []).map((t: any) => ({
        name: t.name,
        rowCount: t.row_count || 0,
        selected: true,
      }));
      setAvailableTables(tables);
      setTablesLoaded(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingAvailableTables(false);
    }
  };

  const toggleTableSelection = (tableName: string) => {
    setAvailableTables(prev => prev.map(t => t.name === tableName ? { ...t, selected: !t.selected } : t));
  };

  const selectAllTables = (selected: boolean) => {
    setAvailableTables(prev => prev.map(t => ({ ...t, selected })));
  };

  // === MIGRATION TO EXTERNAL DATABASE ===
  const handleStartMigration = async () => {
    if (!useExternalSupabase || !externalUrl || !externalAnonKey) {
      toast.error(isRTL ? 'يرجى تفعيل وإعداد الاتصال بقاعدة البيانات الخارجية أولاً' : 'Please enable and configure external database connection first');
      return;
    }
    if (connectionValid !== true) {
      toast.error(isRTL ? 'يرجى اختبار الاتصال أولاً' : 'Please test the connection first');
      return;
    }

    setIsMigrating(true);
    setShowMigrationProgressDialog(true);
    setIsMigrationComplete(false);
    setMigrationErrors([]);
    setMigrationTables([]);
    setMigrationUsersStatus('idle');
    setMigrationStorageStatus('idle');
    setMigrationUsersCount(0);
    setMigrationStorageFileCount(0);
    setMigrationStorageBuckets([]);

    const errors: string[] = [];

    try {
      // Step 0: Run pending migration files first
      if (pendingMigrations.length > 0) {
        setMigrationCurrentStep(isRTL ? 'تشغيل ملفات الترحيل المعلقة...' : 'Running pending migration files...');
        const migSuccess = await runMissingMigrations();
        if (!migSuccess) {
          toast.warning(isRTL ? 'بعض ملفات الترحيل فشلت، متابعة ترحيل البيانات...' : 'Some migration files failed, continuing with data migration...');
        }
      }
      
      // Step 1: Migrate Data
      if (migrateDataEnabled) {
        setMigrationCurrentStep(isRTL ? 'تحميل قائمة الجداول...' : 'Loading table list...');
        
        // Use pre-selected tables if available, otherwise load all
        let selectedTableNames: string[];
        if (tablesLoaded && availableTables.length > 0) {
          selectedTableNames = availableTables.filter(t => t.selected).map(t => t.name);
        } else {
          const { data: tablesResult, error: tablesErr } = await supabase.functions.invoke('migrate-to-external', {
            body: { action: 'list_tables' }
          });
          if (tablesErr || !tablesResult?.success) {
            errors.push(`Tables list: ${tablesErr?.message || tablesResult?.error || 'Failed'}`);
            selectedTableNames = [];
          } else {
            selectedTableNames = (tablesResult.tables || []).map((t: any) => t.name);
            // Store full table info for row counts
            if (!tablesLoaded) {
              setAvailableTables((tablesResult.tables || []).map((t: any) => ({ name: t.name, rowCount: t.row_count || 0, selected: true })));
            }
          }
        }
        
        if (selectedTableNames.length === 0 && errors.length === 0) {
          toast.info(isRTL ? 'لم يتم اختيار أي جداول' : 'No tables selected');
        } else {
          // Build migration table items from selected tables - use available tables data for row counts
          const tableSource = tablesLoaded 
            ? availableTables.filter(t => t.selected) 
            : selectedTableNames.map(n => {
                const found = availableTables.find(t => t.name === n);
                return { name: n, rowCount: found?.rowCount || 0 };
              });
          const tables: MigrationTableItem[] = tableSource.map((t: any) => ({
            name: t.name,
            rowCount: t.rowCount || 0,
            status: 'pending' as const,
            migratedRows: 0,
          }));
          setMigrationTables(tables);
          await new Promise(r => setTimeout(r, 50));

          // Migrate each table
          for (let i = 0; i < tables.length; i++) {
            const table = tables[i];

            setMigrationCurrentStep(isRTL ? `ترحيل جدول: ${table.name}` : `Migrating table: ${table.name}`);
            setMigrationTables(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'migrating' } : t));
            let offset = 0;
            const batchSize = 500;
            let totalMigrated = 0;

            try {
              while (true) {
                const { data: sqlResult, error: sqlErr } = await supabase.functions.invoke('migrate-to-external', {
                  body: { action: 'export_table_as_sql', tableName: table.name, offset, limit: batchSize }
                });

                if (sqlErr || !sqlResult?.success) {
                  throw new Error(sqlErr?.message || sqlResult?.error || 'Export failed');
                }

                if (!sqlResult.sql || sqlResult.rowCount === 0) break;

                // Execute on external DB - disable FK checks for the batch
                const sqlWithFkDisabled = `SET session_replication_role = 'replica'; ${sqlResult.sql} SET session_replication_role = 'origin';`;
                const externalResult = await callExternalProxy('exec_sql', { sql: sqlWithFkDisabled });
                // Check for errors - proxy may return success:true but data.error from exec_sql
                const hasProxyError = (!externalResult.success && externalResult.error) || 
                  (externalResult.data && externalResult.data.error);
                if (hasProxyError) {
                  const errMsg = externalResult.error || externalResult.data?.error || 'Unknown error';
                  console.warn(`Batch insert failed for ${table.name}: ${errMsg}, trying individual inserts...`);
                  // Try individual inserts on batch failure
                  const statements = sqlResult.sql.split(';\n').filter((s: string) => s.trim());
                  let batchErrors: string[] = [];
                  for (const stmt of statements) {
                    try {
                      const individualResult = await callExternalProxy('exec_sql', { sql: `SET session_replication_role = 'replica'; ${stmt}; SET session_replication_role = 'origin';` });
                      if (individualResult.data?.error) {
                        batchErrors.push(individualResult.data.error);
                      } else {
                        totalMigrated++;
                      }
                    } catch (e: any) {
                      batchErrors.push(e.message);
                    }
                  }
                  if (batchErrors.length > 0 && totalMigrated === 0) {
                    // All individual inserts also failed - report the first error
                    errors.push(`Table ${table.name}: ${batchErrors[0]}`);
                  }
                } else {
                  totalMigrated += sqlResult.rowCount;
                }

                setMigrationTables(prev => prev.map((t, idx) => idx === i ? { ...t, migratedRows: totalMigrated } : t));
                offset += batchSize;
                if (sqlResult.rowCount < batchSize) break;
                await new Promise(r => setTimeout(r, 10));
              }

              setMigrationTables(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'done', migratedRows: totalMigrated } : t));
            } catch (err: any) {
              errors.push(`Table ${table.name}: ${err.message}`);
              setMigrationTables(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'error', errorMessage: err.message, migratedRows: totalMigrated } : t));
            }
          }
        }
      }

      // Step 2: Migrate Users
      if (migrateUsersEnabled) {
        setMigrationCurrentStep(isRTL ? 'ترحيل المستخدمين...' : 'Migrating users...');
        setMigrationUsersStatus('migrating');
        
        try {
          let offset = 0;
          const batchSize = 100;
          let totalUsers = 0;

          while (true) {
            const { data: usersResult, error: usersErr } = await supabase.functions.invoke('migrate-to-external', {
              body: { action: 'export_users_as_sql', offset, limit: batchSize }
            });

            if (usersErr || !usersResult?.success) {
              throw new Error(usersErr?.message || usersResult?.error || 'Failed to export users');
            }

            if (!usersResult.sql || usersResult.rowCount === 0) break;

            // Execute on external DB
            const externalResult = await callExternalProxy('exec_sql', { sql: usersResult.sql });
            if (!externalResult.success && externalResult.error) {
              // Try individual inserts
              const statements = usersResult.sql.split(';\n').filter((s: string) => s.trim());
              for (const stmt of statements) {
                try {
                  await callExternalProxy('exec_sql', { sql: stmt + ';' });
                  totalUsers++;
                } catch { /* skip */ }
              }
            } else {
              totalUsers += usersResult.rowCount;
            }

            setMigrationUsersCount(totalUsers);
            offset += batchSize;
            if (usersResult.rowCount < batchSize) break;
          }

          setMigrationUsersStatus('done');
        } catch (err: any) {
          errors.push(`Users: ${err.message}`);
          setMigrationUsersStatus('error');
        }
      }

      // Step 3: Migrate Storage
      if (migrateStorageEnabled) {
        setMigrationCurrentStep(isRTL ? 'ترحيل التخزين...' : 'Migrating storage...');
        setMigrationStorageStatus('migrating');
        
        try {
          // List buckets
          const { data: bucketsResult, error: bucketsErr } = await supabase.functions.invoke('migrate-to-external', {
            body: { action: 'list_storage_buckets' }
          });

          if (bucketsErr || !bucketsResult?.success) {
            throw new Error(bucketsErr?.message || bucketsResult?.error || 'Failed to list buckets');
          }

          const buckets = bucketsResult.buckets || [];
          setMigrationStorageBuckets(buckets.map((b: any) => b.name));

          // Create buckets on external DB
          for (const bucket of buckets) {
            const createBucketSql = `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at) VALUES ('${bucket.id}', '${bucket.name}', ${bucket.public}, ${bucket.file_size_limit || 'NULL'}, ${bucket.allowed_mime_types ? `'${JSON.stringify(bucket.allowed_mime_types)}'::jsonb` : 'NULL'}, '${bucket.created_at}', '${bucket.updated_at}') ON CONFLICT (id) DO NOTHING;`;
            try {
              await callExternalProxy('exec_sql', { sql: createBucketSql });
            } catch { /* bucket may already exist */ }
          }

          // Migrate files for each bucket
          let totalFiles = 0;
          for (const bucket of buckets) {
            let offset = 0;
            const batchSize = 100;
            
            while (true) {
              const { data: filesResult, error: filesErr } = await supabase.functions.invoke('migrate-to-external', {
                body: { action: 'list_storage_files', bucketId: bucket.id, offset, limit: batchSize }
              });

              if (filesErr || !filesResult?.success) break;
              const files = filesResult.files || [];
              if (files.length === 0) break;

              for (const file of files) {
                try {
                  // Get signed URL from source
                  const { data: urlResult } = await supabase.functions.invoke('migrate-to-external', {
                    body: { action: 'get_storage_file_url', bucketId: bucket.id, filePath: file.name }
                  });

                  if (urlResult?.signedUrl) {
                    // Download and upload via SQL metadata insert (file content transfer needs service role on target)
                    // For now, insert the object metadata record
                    const metadataSql = `INSERT INTO storage.objects (id, bucket_id, name, created_at, updated_at, metadata) VALUES ('${file.id}', '${file.bucket_id}', '${file.name.replace(/'/g, "''")}', '${file.created_at}', '${file.updated_at}', ${file.metadata ? `'${JSON.stringify(file.metadata).replace(/'/g, "''")}'::jsonb` : 'NULL'}) ON CONFLICT (id) DO NOTHING;`;
                    await callExternalProxy('exec_sql', { sql: metadataSql });
                    totalFiles++;
                  }
                } catch { /* skip individual file errors */ }
              }

              setMigrationStorageFileCount(totalFiles);
              offset += batchSize;
              if (files.length < batchSize) break;
            }
          }

          setMigrationStorageStatus('done');
        } catch (err: any) {
          errors.push(`Storage: ${err.message}`);
          setMigrationStorageStatus('error');
        }
      }

    } catch (err: any) {
      errors.push(`Migration: ${err.message}`);
    }

    // Update data sync timestamp
    try {
      const logUpdate: any = {
        connection_url: externalUrl,
        connection_name: savedConnections.find(c => c.url === externalUrl)?.name || new URL(externalUrl).hostname,
        last_data_sync_at: new Date().toISOString(),
      };
      if (migrationLog?.id) {
        await supabase.from('external_migration_log').update(logUpdate).eq('id', migrationLog.id);
      } else {
        await supabase.from('external_migration_log').upsert(logUpdate, { onConflict: 'connection_url' });
      }
      await loadMigrationTrackingState(externalUrl);
    } catch { /* ignore */ }

    setIsMigrating(false);
    setIsMigrationComplete(true);
    setMigrationErrors(errors);
    setMigrationCurrentStep('');

    if (errors.length > 0) {
      toast.warning(isRTL ? 'اكتمل الترحيل مع بعض الأخطاء' : 'Migration completed with some errors');
    } else {
      toast.success(isRTL ? 'تم الترحيل بنجاح!' : 'Migration completed successfully!');
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
      
      {/* External Supabase Configuration Card */}
      <Card className={useExternalSupabase ? 'border-primary' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {isRTL ? 'استعادة إلى قاعدة بيانات خارجية' : 'Restore to External Database'}
            </CardTitle>
            <Switch
              checked={useExternalSupabase}
              onCheckedChange={(checked) => {
                setUseExternalSupabase(checked);
                setConnectionValid(null);
              }}
            />
          </div>
          <CardDescription>
            {isRTL 
              ? 'قم بتفعيل هذا الخيار للاستعادة إلى مشروع Supabase مختلف' 
              : 'Enable this option to restore to a different Supabase project'}
          </CardDescription>
        </CardHeader>
        
        {useExternalSupabase && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="external-url">
                {isRTL ? 'رابط Supabase URL' : 'Supabase URL'}
              </Label>
              <Input
                id="external-url"
                placeholder="https://your-project.supabase.co"
                value={externalUrl}
                onChange={(e) => {
                  setExternalUrl(e.target.value);
                  setConnectionValid(null);
                }}
                dir="ltr"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="external-anon-key">
                {isRTL ? 'مفتاح Anon Key' : 'Anon Key'}
              </Label>
              <div className="relative">
                <Input
                  id="external-anon-key"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={externalAnonKey}
                  onChange={(e) => {
                    setExternalAnonKey(e.target.value);
                    setConnectionValid(null);
                  }}
                  type={showAnonKey ? "text" : "password"}
                  dir="ltr"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowAnonKey(!showAnonKey)}
                >
                  {showAnonKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {/* Saved Connections */}
            {savedConnections.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {isRTL ? 'الاتصالات المحفوظة' : 'Saved Connections'}
                </Label>
                <div className="space-y-1">
                  {savedConnections.map((conn, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start font-mono text-xs"
                        onClick={() => handleLoadConnection(conn)}
                      >
                        <Server className="h-3 w-3 mr-2 shrink-0" />
                        {conn.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteConnection(conn.url)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={testExternalConnection}
                disabled={testingConnection || !externalUrl || !externalAnonKey}
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isRTL ? 'جاري الاختبار...' : 'Testing...'}
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {isRTL ? 'اختبار الاتصال' : 'Test Connection'}
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleSaveConnection}
                disabled={!externalUrl || !externalAnonKey}
              >
                <Save className="h-4 w-4 mr-2" />
                {isRTL ? 'حفظ الاتصال' : 'Save Connection'}
              </Button>
              
              {connectionValid === true && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {isRTL ? 'الاتصال ناجح' : 'Connection successful'}
                </div>
              )}
              
              {connectionValid === false && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {isRTL ? 'فشل الاتصال' : 'Connection failed'}
                </div>
              )}
            </div>
            
            {/* External Tables List */}
            {loadingTables && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isRTL ? 'جاري تحميل الجداول...' : 'Loading tables...'}
              </div>
            )}
            
            {tablesError && !loadingTables && (
              <div className="space-y-3">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {tablesError}
                  </div>
                </div>
                
                {tablesError.includes('exec_sql') && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {isRTL ? 'يجب إنشاء دالة exec_sql في المشروع الخارجي' : 'You need to create the exec_sql function in the external project'}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isRTL 
                        ? 'قم بتشغيل هذا الكود SQL في محرر SQL الخاص بـ Supabase الخارجي:' 
                        : 'Run this SQL in the external Supabase SQL Editor:'}
                    </p>
                    <div className="relative">
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-64" dir="ltr">
{`CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  is_select boolean;
BEGIN
  -- Check if it's a SELECT statement
  is_select := lower(trim(sql)) LIKE 'select%';
  
  IF is_select THEN
    -- For SELECT queries, wrap in json_agg to return array
    EXECUTE 'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (' || sql || ') t' INTO result;
  ELSE
    -- For DDL/DML statements, just execute and return success
    EXECUTE sql;
    result := json_build_object('success', true);
  END IF;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;`}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          navigator.clipboard.writeText(`CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  is_select boolean;
BEGIN
  -- Check if it's a SELECT statement
  is_select := lower(trim(sql)) LIKE 'select%';
  
  IF is_select THEN
    -- For SELECT queries, wrap in json_agg to return array
    EXECUTE 'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (' || sql || ') t' INTO result;
  ELSE
    -- For DDL/DML statements, just execute and return success
    EXECUTE sql;
    result := json_build_object('success', true);
  END IF;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;`);
                          toast.success(isRTL ? 'تم نسخ الكود' : 'SQL copied to clipboard');
                        }}
                      >
                        {isRTL ? 'نسخ' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {externalTables.length > 0 && !loadingTables && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {isRTL ? `الجداول الموجودة (${externalTables.length})` : `Existing Tables (${externalTables.length})`}
                </Label>
                <ScrollArea className="h-48 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {externalTables.map((table, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                      >
                        <span className="font-mono text-sm">{table.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {table.rowCount.toLocaleString()} {isRTL ? 'صف' : 'rows'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {isRTL ? (
                    <>
                      <p className="font-medium">ملاحظة هامة:</p>
                      <p>يجب أن يحتوي المشروع الخارجي على دالة exec_sql لتنفيذ الاستعادة.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Important Note:</p>
                      <p>The external project must have the exec_sql function to execute the restore.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Manual SQL Generation Option */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium">
                <Download className="h-4 w-4" />
                {isRTL ? 'بديل: توليد SQL للتشغيل اليدوي' : 'Alternative: Generate SQL for Manual Execution'}
              </div>
              <p className="text-sm text-muted-foreground">
                {isRTL 
                  ? 'إذا لم تتمكن من الوصول إلى API الخارجي، يمكنك تحميل ملفات SQL وتشغيلها يدوياً في محرر SQL الخاص بـ Supabase.' 
                  : 'If you cannot access the external API, you can upload SQL files and run them manually in Supabase SQL Editor.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isRTL 
                  ? 'اختر الملفات في الأسفل ثم اضغط على "توليد SQL" لتحميل أو نسخ الأوامر.' 
                  : 'Select files below and click "Generate SQL" to download or copy the commands.'}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Restore Target Indicator */}
      {useExternalSupabase && connectionValid && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <Server className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">
              {isRTL ? 'الاستعادة إلى:' : 'Restoring to:'}
            </p>
            <p className="text-sm text-muted-foreground font-mono">{externalUrl}</p>
          </div>
        </div>
      )}
      
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
              
              {/* Restore Steps Checkboxes */}
              {structureFile && (
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium mb-2">
                    {isRTL ? 'خطوات الاستعادة:' : 'Restore Steps:'}
                  </p>
                  {restoreSteps.map((step) => (
                    <div key={step.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`step-${step.key}`}
                        checked={step.enabled}
                        onCheckedChange={() => toggleStepEnabled(step.key)}
                      />
                      <label 
                        htmlFor={`step-${step.key}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {isRTL ? step.labelAr : step.label}
                      </label>
                    </div>
                  ))}
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
              
              {/* Generate SQL button for manual execution */}
              {useExternalSupabase && structureFile && (
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateSql('structure')}
                  disabled={generatingSql}
                  className="w-full"
                >
                  {generatingSql ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isRTL ? 'جاري التوليد...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {isRTL ? 'توليد SQL للتشغيل اليدوي' : 'Generate SQL for Manual Run'}
                    </>
                  )}
                </Button>
              )}
              
              {/* Generate SQL button for manual execution */}
              {useExternalSupabase && dataFile && (
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateSql('data')}
                  disabled={generatingSql}
                  className="w-full"
                >
                  {generatingSql ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isRTL ? 'جاري التوليد...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      {isRTL ? 'توليد SQL للتشغيل اليدوي' : 'Generate SQL for Manual Run'}
                    </>
                  )}
                </Button>
              )}
              
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

      {/* Migrate to External Database Card */}
      {useExternalSupabase && connectionValid === true && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {isRTL ? 'ترحيل البيانات إلى قاعدة بيانات خارجية' : 'Migrate to External Database'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'نقل البيانات والمستخدمين والتخزين من قاعدة البيانات الحالية إلى القاعدة الخارجية' 
                : 'Transfer data, users, and storage from current database to external database'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Migration Tracking Status */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  {isRTL ? 'حالة الترحيل' : 'Migration Status'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadMigrationTrackingState(externalUrl)}
                  disabled={loadingMigrationState}
                >
                  {loadingMigrationState ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
              
              {migrationLog ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'آخر ملف ترحيل:' : 'Last Migration File:'}</span>
                    <span className="font-mono text-xs">{migrationLog.last_migration_file || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'آخر تشغيل:' : 'Last Run:'}</span>
                    <span className="text-xs">
                      {migrationLog.last_migration_run_at 
                        ? new Date(migrationLog.last_migration_run_at).toLocaleString()
                        : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{isRTL ? 'الملفات المطبقة:' : 'Applied Files:'}</span>
                    <Badge variant="secondary">{migrationLog.migration_files_applied.length}/{localMigrations.length}</Badge>
                  </div>
                  {pendingMigrations.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-2 mt-2">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {isRTL 
                          ? `${pendingMigrations.length} ملف ترحيل معلق` 
                          : `${pendingMigrations.length} pending migration file(s)`}
                      </div>
                    </div>
                  )}
                  {pendingMigrations.length === 0 && localMigrations.length > 0 && (
                    <div className="flex items-center gap-2 text-green-600 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      {isRTL ? 'جميع الملفات مطبقة' : 'All migration files applied'}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {loadingMigrationState 
                    ? (isRTL ? 'جاري التحميل...' : 'Loading...')
                    : (isRTL ? 'لم يتم العثور على سجل ترحيل لهذا الاتصال' : 'No migration log found for this connection')}
                </p>
              )}
              
              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap pt-2">
                {pendingMigrations.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runMissingMigrations}
                    disabled={runningMigrationSync}
                  >
                    {runningMigrationSync ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3 mr-1" />
                    )}
                    {isRTL 
                      ? `تشغيل ${pendingMigrations.length} ملف معلق` 
                      : `Run ${pendingMigrations.length} Pending`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMatchCurrentSituation}
                  disabled={matchingCurrentSituation || localMigrations.length === 0}
                >
                  {matchingCurrentSituation ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  )}
                  {isRTL ? 'مطابقة الوضع الحالي' : 'Match Current Situation'}
                </Button>
              </div>
            </div>
            
            {/* Migration Options */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">{isRTL ? 'خيارات الترحيل:' : 'Migration Options:'}</p>
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id="migrate-data"
                  checked={migrateDataEnabled}
                  onCheckedChange={(checked) => {
                    setMigrateDataEnabled(!!checked);
                    if (!checked) setTablesLoaded(false);
                  }}
                />
                <label htmlFor="migrate-data" className="text-sm cursor-pointer flex items-center gap-2 flex-1">
                  <Database className="h-4 w-4" />
                  {isRTL ? 'ترحيل بيانات الجداول' : 'Migrate Table Data'}
                </label>
                {migrateDataEnabled && !tablesLoaded && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAvailableTables}
                    disabled={loadingAvailableTables}
                  >
                    {loadingAvailableTables ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      isRTL ? 'تحميل الجداول' : 'Load Tables'
                    )}
                  </Button>
                )}
              </div>
              
              {/* Table Selection List */}
              {migrateDataEnabled && tablesLoaded && availableTables.length > 0 && (
                <div className="ml-7 border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {availableTables.filter(t => t.selected).length}/{availableTables.length} {isRTL ? 'جدول محدد' : 'tables selected'}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => selectAllTables(true)}>
                        {isRTL ? 'تحديد الكل' : 'Select All'}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => selectAllTables(false)}>
                        {isRTL ? 'إلغاء الكل' : 'Deselect All'}
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="space-y-1 pr-2">
                      {availableTables.map((table) => (
                        <div key={table.name} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50">
                          <Checkbox
                            id={`table-${table.name}`}
                            checked={table.selected}
                            onCheckedChange={() => toggleTableSelection(table.name)}
                          />
                          <label htmlFor={`table-${table.name}`} className="text-xs font-mono cursor-pointer flex-1">
                            {table.name}
                          </label>
                          <Badge variant="outline" className="text-xs">
                            {table.rowCount.toLocaleString()} {isRTL ? 'صف' : 'rows'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id="migrate-users"
                  checked={migrateUsersEnabled}
                  onCheckedChange={(checked) => setMigrateUsersEnabled(!!checked)}
                />
                <label htmlFor="migrate-users" className="text-sm cursor-pointer flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {isRTL ? 'ترحيل المستخدمين (Auth Users)' : 'Migrate Users (Auth Users)'}
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <Checkbox
                  id="migrate-storage"
                  checked={migrateStorageEnabled}
                  onCheckedChange={(checked) => setMigrateStorageEnabled(!!checked)}
                />
                <label htmlFor="migrate-storage" className="text-sm cursor-pointer flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  {isRTL ? 'ترحيل التخزين (Storage Buckets)' : 'Migrate Storage (Storage Buckets)'}
                </label>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {isRTL ? (
                    <p>تأكد من أن قاعدة البيانات الخارجية تحتوي على نفس هيكل الجداول قبل ترحيل البيانات. يُنصح باستعادة الهيكل أولاً ثم الترحيل.</p>
                  ) : (
                    <p>Make sure the external database has the same table structure before migrating data. It's recommended to restore structure first, then migrate.</p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartMigration}
              disabled={isMigrating || (!migrateDataEnabled && !migrateUsersEnabled && !migrateStorageEnabled)}
              className="w-full"
              size="lg"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isRTL ? 'جاري الترحيل...' : 'Migrating...'}
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  {isRTL ? 'بدء الترحيل' : 'Start Migration'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Migration Progress Dialog */}
      <Dialog open={showMigrationProgressDialog} onOpenChange={(open) => { if (!isMigrating) setShowMigrationProgressDialog(open); }}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isMigrationComplete ? (
                migrationErrors.length > 0 ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              {isRTL ? 'تقدم الترحيل' : 'Migration Progress'}
            </DialogTitle>
            <DialogDescription>
              {isMigrationComplete
                ? (isRTL ? 'اكتملت عملية الترحيل' : 'Migration completed')
                : migrationCurrentStep || (isRTL ? 'جاري التحضير...' : 'Preparing...')}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Migration Summary when complete */}
              {isMigrationComplete && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">{isRTL ? 'ملخص الترحيل:' : 'Migration Summary:'}</p>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {migrateDataEnabled && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          <span>{isRTL ? 'الجداول' : 'Tables'}</span>
                        </div>
                        <span className="font-mono">
                          {migrationTables.filter(t => t.status === 'done').length}/{migrationTables.length} {isRTL ? 'جدول' : 'tables'} — {migrationTables.reduce((sum, t) => sum + t.migratedRows, 0).toLocaleString()} {isRTL ? 'صف' : 'rows'}
                        </span>
                      </div>
                    )}
                    {migrateUsersEnabled && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{isRTL ? 'المستخدمين' : 'Users'}</span>
                        </div>
                        <span className="font-mono">
                          {migrationUsersCount} {isRTL ? 'مستخدم' : 'users'} — {migrationUsersStatus === 'done' ? '✓' : migrationUsersStatus === 'error' ? '✗' : '—'}
                        </span>
                      </div>
                    )}
                    {migrateStorageEnabled && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4" />
                          <span>{isRTL ? 'التخزين' : 'Storage'}</span>
                        </div>
                        <span className="font-mono">
                          {migrationStorageBuckets.length} {isRTL ? 'حاوية' : 'buckets'}, {migrationStorageFileCount} {isRTL ? 'ملف' : 'files'} — {migrationStorageStatus === 'done' ? '✓' : migrationStorageStatus === 'error' ? '✗' : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Migration Progress */}
              {migrateDataEnabled && migrationTables.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Database className="h-4 w-4" />
                    {isRTL ? 'بيانات الجداول' : 'Table Data'}
                    <Badge variant="secondary">
                      {migrationTables.filter(t => t.status === 'done').length}/{migrationTables.length}
                    </Badge>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? 'الجدول' : 'Table'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'الصفوف' : 'Rows'}</TableHead>
                          <TableHead className="text-center">{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {migrationTables.map((item, idx) => (
                          <TableRow key={idx} className={item.status === 'migrating' ? 'bg-primary/5' : ''}>
                            <TableCell className="font-mono text-xs">{item.name}</TableCell>
                            <TableCell className="text-center text-xs">
                              {item.migratedRows}/{item.rowCount}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {getStatusIcon(item.status)}
                                <Badge variant={
                                  item.status === 'done' ? 'default' :
                                  item.status === 'error' ? 'destructive' :
                                  item.status === 'migrating' ? 'secondary' :
                                  'outline'
                                } className="text-xs">
                                  {item.status}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Users Migration Progress */}
              {migrateUsersEnabled && migrationUsersStatus !== 'idle' && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{isRTL ? 'المستخدمين' : 'Users'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{migrationUsersCount} {isRTL ? 'مستخدم' : 'users'}</Badge>
                    {getStatusIcon(migrationUsersStatus)}
                    <Badge variant={
                      migrationUsersStatus === 'done' ? 'default' :
                      migrationUsersStatus === 'error' ? 'destructive' : 'secondary'
                    }>
                      {migrationUsersStatus}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Storage Migration Progress */}
              {migrateStorageEnabled && migrationStorageStatus !== 'idle' && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span className="font-medium">{isRTL ? 'التخزين' : 'Storage'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {migrationStorageBuckets.length} {isRTL ? 'حاوية' : 'buckets'}, {migrationStorageFileCount} {isRTL ? 'ملف' : 'files'}
                    </Badge>
                    {getStatusIcon(migrationStorageStatus)}
                    <Badge variant={
                      migrationStorageStatus === 'done' ? 'default' :
                      migrationStorageStatus === 'error' ? 'destructive' : 'secondary'
                    }>
                      {migrationStorageStatus}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Errors */}
              {migrationErrors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">{isRTL ? 'الأخطاء:' : 'Errors:'}</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {migrationErrors.map((err, i) => (
                      <div key={i} className="text-xs text-destructive p-2 bg-destructive/10 rounded font-mono">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {isMigrationComplete && (
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setShowMigrationProgressDialog(false)}>
                {isRTL ? 'إغلاق' : 'Close'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

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

      {/* Structure Restore Progress Dialog */}
      <Dialog open={showStructureProgressDialog} onOpenChange={setShowStructureProgressDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isStructureRestoreComplete ? (
                progress.structure === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              {isRTL ? 'تقدم استعادة الهيكل' : 'Structure Restore Progress'}
            </DialogTitle>
            <DialogDescription>
              {isStructureRestoreComplete
                ? (isRTL ? 'اكتملت عملية استعادة الهيكل' : 'Structure restore completed')
                : currentStepKey 
                  ? (isRTL 
                      ? `جاري: ${restoreSteps.find(s => s.key === currentStepKey)?.labelAr || currentStepKey} - ${currentStructureItem || '...'}` 
                      : `Running: ${restoreSteps.find(s => s.key === currentStepKey)?.label || currentStepKey} - ${currentStructureItem || '...'}`)
                  : (isRTL ? 'جاري التحضير...' : 'Preparing...')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{isRTL ? 'التقدم الإجمالي' : 'Overall Progress'}</span>
                <span>
                  {structureRestoreList.filter(s => s.status === 'done' || s.status === 'skipped').length} / {structureRestoreList.length}
                </span>
              </div>
              <Progress 
                value={structureRestoreList.length > 0 
                  ? (structureRestoreList.filter(s => s.status === 'done' || s.status === 'skipped' || s.status === 'error').length / structureRestoreList.length) * 100 
                  : 0
                } 
                className="h-3" 
              />
            </div>
            
            {/* Step-by-Step Progress */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {restoreSteps.map((step) => {
                  const stepItems = structureRestoreList.filter(item => 
                    step.types.includes(item.type)
                  );
                  const completedItems = stepItems.filter(i => i.status === 'done').length;
                  const errorItems = stepItems.filter(i => i.status === 'error').length;
                  const skippedItems = stepItems.filter(i => i.status === 'skipped').length;
                  const isExpanded = expandedSteps.has(step.key);
                  const isCurrentStep = currentStepKey === step.key;
                  
                  return (
                    <div key={step.key} className={`border rounded-lg ${isCurrentStep ? 'border-primary bg-primary/5' : ''}`}>
                      <div 
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleStepExpanded(step.key)}
                      >
                        {/* Expand/Collapse Icon */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        {/* Step Status Icon */}
                        <div className="flex-shrink-0">
                          {step.status === 'done' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : step.status === 'error' ? (
                            <AlertCircle className="h-5 w-5 text-destructive" />
                          ) : step.status === 'executing' ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : step.status === 'skipped' ? (
                            <XCircle className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                        
                        {/* Step Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {isRTL ? step.labelAr : step.label}
                            </span>
                            {!step.enabled && (
                              <Badge variant="outline" className="text-xs">
                                {isRTL ? 'معطل' : 'Disabled'}
                              </Badge>
                            )}
                          </div>
                          {stepItems.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {completedItems}/{stepItems.length} {isRTL ? 'مكتمل' : 'completed'}
                              {errorItems > 0 && <span className="text-destructive"> • {errorItems} {isRTL ? 'أخطاء' : 'errors'}</span>}
                              {skippedItems > 0 && <span> • {skippedItems} {isRTL ? 'تخطي' : 'skipped'}</span>}
                            </div>
                          )}
                        </div>
                        
                        {/* Item Count Badge */}
                        <Badge variant="secondary" className="flex-shrink-0">
                          {stepItems.length}
                        </Badge>
                      </div>
                      
                      {/* Expanded Items List */}
                      {isExpanded && stepItems.length > 0 && (
                        <div className="border-t bg-muted/30">
                          <div className="max-h-48 overflow-auto">
                            <Table>
                              <TableBody>
                                {stepItems.map((item, idx) => (
                                  <TableRow key={idx} className={item.status === 'executing' ? 'bg-primary/10' : ''}>
                                    <TableCell className="font-mono text-sm py-2">
                                      <div className="flex items-center gap-2">
                                        {item.name}
                                        {item.existsInTarget && (
                                          <Badge variant="outline" className="text-xs">
                                            {isRTL ? 'موجود' : 'exists'}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center py-2 w-24">
                                      <div className="flex items-center justify-center gap-1">
                                        {getStatusIcon(item.status)}
                                        <span className="text-xs">
                                          {item.status === 'done' ? (isRTL ? 'تم' : 'done') :
                                           item.status === 'error' ? (isRTL ? 'خطأ' : 'error') :
                                           item.status === 'skipped' ? (isRTL ? 'تخطي' : 'skip') :
                                           item.status === 'executing' ? (isRTL ? 'جاري' : 'run') :
                                           (isRTL ? 'انتظار' : 'wait')}
                                        </span>
                                      </div>
                                      {item.errorMessage && (
                                        <p className="text-xs text-destructive mt-1 max-w-32 truncate" title={item.errorMessage}>
                                          {item.errorMessage}
                                        </p>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          
          {/* Close button after restore completes */}
          {isStructureRestoreComplete && (
            <DialogFooter className="pt-4 border-t">
              <Button 
                variant="outline"
                onClick={() => setShowStructureProgressDialog(false)}
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Conflict Confirmation Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {isRTL ? 'تم العثور على جداول موجودة' : 'Existing Tables Found'}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? 'الجداول التالية موجودة بالفعل في قاعدة البيانات المستهدفة:' 
                : 'The following tables already exist in the target database:'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <ScrollArea className="h-32 border rounded-lg p-2">
              <div className="space-y-1">
                {conflictingObjects.map((obj, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{obj.name}</span>
                    <Badge variant="outline" className="text-xs">{obj.type}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex items-center space-x-2 rtl:space-x-reverse p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Switch
                id="replace-existing"
                checked={replaceExisting}
                onCheckedChange={setReplaceExisting}
              />
              <Label htmlFor="replace-existing" className="text-sm cursor-pointer">
                {isRTL 
                  ? 'حذف الجداول الموجودة وإعادة إنشائها (سيتم فقدان البيانات!)' 
                  : 'Drop existing tables and recreate them (data will be lost!)'}
              </Label>
            </div>
            
            {replaceExisting && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    {isRTL 
                      ? 'تحذير: سيتم حذف الجداول الموجودة وجميع بياناتها قبل إعادة إنشائها. لا يمكن التراجع عن هذه العملية!' 
                      : 'Warning: Existing tables and all their data will be deleted before recreating. This action cannot be undone!'}
                  </div>
                </div>
              </div>
            )}
            
            {!replaceExisting && (
              <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                {isRTL 
                  ? 'سيتم تخطي الجداول الموجودة وإنشاء الجداول الجديدة فقط.' 
                  : 'Existing tables will be skipped and only new tables will be created.'}
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelReplace}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant={replaceExisting ? 'destructive' : 'default'}
              onClick={handleConfirmReplace}
            >
              {replaceExisting 
                ? (isRTL ? 'حذف وإعادة إنشاء' : 'Drop & Recreate')
                : (isRTL ? 'تخطي الموجود' : 'Skip Existing')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual SQL Dialog */}
      <Dialog open={showManualSqlDialog} onOpenChange={setShowManualSqlDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isRTL ? 'SQL للتشغيل اليدوي' : 'SQL for Manual Execution'}
            </DialogTitle>
            <DialogDescription>
              {isRTL 
                ? 'انسخ هذا الكود وقم بتشغيله في محرر SQL الخاص بـ Supabase الخارجي' 
                : 'Copy this SQL and run it in your external Supabase SQL Editor'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={handleCopySql} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                {isRTL ? 'نسخ الكل' : 'Copy All'}
              </Button>
              <Button onClick={handleDownloadSql} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                {isRTL ? 'تحميل كملف' : 'Download as File'}
              </Button>
              <Badge variant="secondary">
                {(generatedSql.length / 1024).toFixed(1)} KB
              </Badge>
            </div>
            
            <Textarea
              value={generatedSql}
              readOnly
              className="font-mono text-xs h-96"
              dir="ltr"
            />
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  {isRTL ? (
                    <p>قم بتشغيل هذا الكود في محرر SQL في لوحة تحكم Supabase الخارجي. قد تحتاج لتقسيمه إلى أجزاء إذا كان كبيراً جداً.</p>
                  ) : (
                    <p>Run this SQL in the SQL Editor in your external Supabase dashboard. You may need to split it into parts if it's too large.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualSqlDialog(false)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Migration Sync Progress Dialog */}
      <Dialog open={showMigrationSyncDialog} onOpenChange={(open) => { if (!runningMigrationSync && !applyingMissingObjects) setShowMigrationSyncDialog(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(runningMigrationSync || applyingMissingObjects) ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : migrationSyncErrors.length > 0 ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {isRTL ? 'تقدم ملفات الترحيل' : 'Migration Files Progress'}
            </DialogTitle>
            <DialogDescription>
              {(runningMigrationSync || applyingMissingObjects)
                ? `${migrationSyncProgress.current}/${migrationSyncProgress.total} - ${migrationSyncProgress.currentFile}`
                : (isRTL ? 'اكتمل تشغيل ملفات الترحيل' : 'Migration files execution completed')}
            </DialogDescription>
          </DialogHeader>
          
          {migrationSyncProgress.total > 0 && (
            <div className="space-y-2">
              <Progress value={(migrationSyncProgress.current / migrationSyncProgress.total) * 100} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                {migrationSyncProgress.current}/{migrationSyncProgress.total}
              </p>
            </div>
          )}
          
          {migrationSyncErrors.length > 0 && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2">
                {migrationSyncErrors.map((err, i) => (
                  <div key={i} className="text-xs text-destructive p-3 bg-destructive/10 rounded font-mono whitespace-pre-wrap break-all" dir="ltr">{err}</div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {!runningMigrationSync && !applyingMissingObjects && (
            <DialogFooter className="gap-2">
              {migrationSyncErrors.length > 0 && (
                <Button variant="secondary" onClick={() => {
                  const allErrors = migrationSyncErrors.join('\n\n');
                  navigator.clipboard.writeText(allErrors);
                  toast.success(isRTL ? 'تم نسخ الأخطاء' : 'Errors copied to clipboard');
                }}>
                  <Copy className="h-3 w-3 mr-1" />
                  {isRTL ? 'نسخ الأخطاء' : 'Copy Errors'}
                </Button>
              )}
              <Button variant="outline" onClick={() => {
                setShowMigrationSyncDialog(false);
                if (migrationSyncErrors.length > 0) {
                  setTimeout(() => handleMatchCurrentSituation(), 500);
                }
              }}>
                {isRTL ? 'إغلاق' : 'Close'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* DB Comparison Results Dialog */}
      <Dialog open={showComparisonDialog} onOpenChange={setShowComparisonDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {isRTL ? 'نتائج مقارنة قاعدة البيانات' : 'Database Comparison Results'}
            </DialogTitle>
            <DialogDescription>
              {isRTL ? 'مقارنة بين قاعدة البيانات المحلية والخارجية' : 'Comparison between local and external database objects'}
            </DialogDescription>
          </DialogHeader>
          
          {comparisonResults && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{comparisonResults.localTypes?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? 'أنواع محلية' : 'Local Types'}</div>
                    {(comparisonResults.missingTypes?.length || 0) > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">{comparisonResults.missingTypes.length} {isRTL ? 'مفقود' : 'missing'}</Badge>
                    )}
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{comparisonResults.localTables.length}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? 'جداول محلية' : 'Local Tables'}</div>
                    {comparisonResults.missingTables.length > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">{comparisonResults.missingTables.length} {isRTL ? 'مفقود' : 'missing'}</Badge>
                    )}
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{comparisonResults.localFunctions.length}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? 'دوال محلية' : 'Local Functions'}</div>
                    {comparisonResults.missingFunctions.length > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">{comparisonResults.missingFunctions.length} {isRTL ? 'مفقود' : 'missing'}</Badge>
                    )}
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{comparisonResults.localTriggers.length}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? 'مشغلات محلية' : 'Local Triggers'}</div>
                    {comparisonResults.missingTriggers.length > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">{comparisonResults.missingTriggers.length} {isRTL ? 'مفقود' : 'missing'}</Badge>
                    )}
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{comparisonResults.localViews.length}</div>
                    <div className="text-xs text-muted-foreground">{isRTL ? 'عروض محلية' : 'Local Views'}</div>
                    {comparisonResults.missingViews.length > 0 && (
                      <Badge variant="destructive" className="mt-1 text-xs">{comparisonResults.missingViews.length} {isRTL ? 'مفقود' : 'missing'}</Badge>
                    )}
                  </div>
                </div>

                {/* Migration Files Status */}
                <div className="border rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">{isRTL ? 'حالة ملفات الترحيل' : 'Migration Files Status'}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" /> {comparisonResults.matchedMigrations.length} {isRTL ? 'مطبق' : 'applied'}
                    </span>
                    {comparisonResults.unmatchedMigrations.length > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> {comparisonResults.unmatchedMigrations.length} {isRTL ? 'معلق' : 'pending'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Missing Types */}
                {(comparisonResults.missingTypes?.length || 0) > 0 && (
                  <div className="border border-destructive/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {isRTL ? 'أنواع مفقودة في قاعدة البيانات الخارجية' : 'Missing Types in External Database'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResults.missingTypes.map(t => (
                        <Badge key={t.name} variant="outline" className="text-xs font-mono border-destructive/50 text-destructive">{t.name} ({t.type})</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Tables */}
                {comparisonResults.missingTables.length > 0 && (
                  <div className="border border-destructive/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {isRTL ? 'جداول مفقودة في قاعدة البيانات الخارجية' : 'Missing Tables in External Database'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResults.missingTables.map(t => (
                        <Badge key={t} variant="outline" className="text-xs font-mono border-destructive/50 text-destructive">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Functions */}
                {comparisonResults.missingFunctions.length > 0 && (
                  <div className="border border-destructive/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {isRTL ? 'دوال مفقودة في قاعدة البيانات الخارجية' : 'Missing Functions in External Database'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResults.missingFunctions.map(f => (
                        <Badge key={f} variant="outline" className="text-xs font-mono border-destructive/50 text-destructive">{f}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Triggers */}
                {comparisonResults.missingTriggers.length > 0 && (
                  <div className="border border-destructive/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {isRTL ? 'مشغلات مفقودة في قاعدة البيانات الخارجية' : 'Missing Triggers in External Database'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResults.missingTriggers.map(t => (
                        <Badge key={t} variant="outline" className="text-xs font-mono border-destructive/50 text-destructive">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Views */}
                {comparisonResults.missingViews.length > 0 && (
                  <div className="border border-destructive/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {isRTL ? 'عروض مفقودة في قاعدة البيانات الخارجية' : 'Missing Views in External Database'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {comparisonResults.missingViews.map(v => (
                        <Badge key={v} variant="outline" className="text-xs font-mono border-destructive/50 text-destructive">{v}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Migration Files */}
                {comparisonResults.unmatchedMigrations.length > 0 && (
                  <div className="border border-amber-500/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {isRTL ? 'ملفات الترحيل المعلقة (تحتاج تشغيل)' : 'Pending Migration Files (need to run)'}
                    </p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {comparisonResults.unmatchedMigrations.map(v => {
                        const mig = localMigrations.find(m => m.version === v);
                        return (
                          <div key={v} className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3 text-amber-500" />
                            <span>{v}</span>
                            {mig?.name && mig.name !== v && <span className="text-muted-foreground/60">({mig.name})</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All matched */}
                {comparisonResults.missingTables.length === 0 && comparisonResults.missingFunctions.length === 0 && 
                 comparisonResults.missingTriggers.length === 0 && comparisonResults.missingViews.length === 0 && (comparisonResults.missingTypes?.length || 0) === 0 && (
                  <div className="border border-green-500/30 rounded-lg p-4 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-green-600">
                      {isRTL ? 'جميع الكائنات متطابقة بين قاعدة البيانات المحلية والخارجية' : 'All objects match between local and external database'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowComparisonDialog(false)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
            {comparisonResults && (comparisonResults.missingTables.length > 0 || comparisonResults.missingFunctions.length > 0 || comparisonResults.missingTriggers.length > 0 || comparisonResults.missingViews.length > 0 || (comparisonResults.missingTypes?.length || 0) > 0) && (
              <>
                <Button variant="secondary" onClick={generateMissingObjectsScript} disabled={generatingScript}>
                  <FileText className="h-3 w-3 mr-1" />
                  {generatingScript ? (isRTL ? 'جاري التوليد...' : 'Generating...') : (isRTL ? 'عرض السكريبت' : 'Show Script')}
                </Button>
                <Button onClick={applyMissingObjects} disabled={applyingMissingObjects}>
                  <Play className="h-3 w-3 mr-1" />
                  {isRTL 
                    ? `تطبيق ${(comparisonResults.missingTypes?.length || 0) + comparisonResults.missingTables.length + comparisonResults.missingFunctions.length + comparisonResults.missingTriggers.length} كائن مفقود` 
                    : `Apply ${(comparisonResults.missingTypes?.length || 0) + comparisonResults.missingTables.length + comparisonResults.missingFunctions.length + comparisonResults.missingTriggers.length} Missing Objects`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Script Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'سكريبت SQL المُولّد' : 'Generated SQL Script'}</DialogTitle>
            <DialogDescription>{isRTL ? 'السكريبت الذي سيتم تنفيذه لتطبيق الكائنات المفقودة' : 'The script that will be executed to apply missing objects'}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs p-4 bg-muted rounded-lg whitespace-pre-wrap font-mono leading-relaxed" dir="ltr">
              {generatedScript}
            </pre>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              navigator.clipboard.writeText(generatedScript);
              toast.success(isRTL ? 'تم نسخ السكريبت' : 'Script copied to clipboard');
            }}>
              <Copy className="h-3 w-3 mr-1" />
              {isRTL ? 'نسخ' : 'Copy'}
            </Button>
            <Button variant="outline" onClick={() => setShowScriptDialog(false)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemRestore;
