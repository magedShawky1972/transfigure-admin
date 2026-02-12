import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { Database, FileText, Upload, Loader2, CheckCircle2, AlertCircle, FileArchive, Play, LogOut, XCircle, ExternalLink, Server, Copy, Download, ChevronDown, ChevronRight, Save, ArrowRightLeft, Users, HardDrive } from "lucide-react";
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

  // Load saved external DB connections from localStorage
  const getSavedConnections = (): { name: string; url: string; anonKey: string }[] => {
    try {
      const saved = localStorage.getItem('external_db_connections');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };

  const [savedConnections, setSavedConnections] = useState<{ name: string; url: string; anonKey: string }[]>(getSavedConnections);

  const handleSaveConnection = () => {
    if (!externalUrl || !externalAnonKey) {
      toast.error(isRTL ? 'يرجى إدخال URL و Anon Key أولاً' : 'Please enter URL and Anon Key first');
      return;
    }
    const name = savedConnectionName.trim() || new URL(externalUrl).hostname;
    const existing = savedConnections.filter(c => c.url !== externalUrl);
    const updated = [...existing, { name, url: externalUrl, anonKey: externalAnonKey }];
    localStorage.setItem('external_db_connections', JSON.stringify(updated));
    setSavedConnections(updated);
    setSavedConnectionName("");
    toast.success(isRTL ? 'تم حفظ الاتصال' : 'Connection saved');
  };

  const handleLoadConnection = (conn: { name: string; url: string; anonKey: string }) => {
    setExternalUrl(conn.url);
    setExternalAnonKey(conn.anonKey);
    setConnectionValid(null);
    toast.success(isRTL ? `تم تحميل: ${conn.name}` : `Loaded: ${conn.name}`);
  };

  const handleDeleteConnection = (url: string) => {
    const updated = savedConnections.filter(c => c.url !== url);
    localStorage.setItem('external_db_connections', JSON.stringify(updated));
    setSavedConnections(updated);
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

                // Execute on external DB
                const externalResult = await callExternalProxy('exec_sql', { sql: sqlResult.sql });
                if (!externalResult.success && externalResult.error) {
                  // Try individual inserts on batch failure
                  const statements = sqlResult.sql.split(';\n').filter((s: string) => s.trim());
                  for (const stmt of statements) {
                    try {
                      await callExternalProxy('exec_sql', { sql: stmt + ';' });
                      totalMigrated++;
                    } catch {
                      // Skip individual failures silently
                    }
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
              <Input
                id="external-anon-key"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={externalAnonKey}
                onChange={(e) => {
                  setExternalAnonKey(e.target.value);
                  setConnectionValid(null);
                }}
                type="password"
                dir="ltr"
              />
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
    </div>
  );
};

export default SystemRestore;
