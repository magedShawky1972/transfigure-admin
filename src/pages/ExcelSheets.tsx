import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Trash2, FileSpreadsheet, Edit, Braces, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Type for JSON column configuration
interface JsonColumnConfig {
  isJson: boolean;
  splitKeys: string[];
}

const ExcelSheets = () => {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<any[]>([]);
  const [sheetCode, setSheetCode] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [allExcelRows, setAllExcelRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedSheetForMapping, setSelectedSheetForMapping] = useState<any>(null);
  const [sheetExcelColumns, setSheetExcelColumns] = useState<string[]>([]);
  const [sheetMappings, setSheetMappings] = useState<Record<string, string>>({});
  const [sheetTargetTable, setSheetTargetTable] = useState<string>("");
  const [sheetTableColumns, setSheetTableColumns] = useState<string[]>([]);
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSheetForEdit, setSelectedSheetForEdit] = useState<any>(null);
  const [editSheetCode, setEditSheetCode] = useState("");
  const [editSheetName, setEditSheetName] = useState("");
  const [checkCustomer, setCheckCustomer] = useState(true);
  const [checkBrand, setCheckBrand] = useState(true);
  const [checkProduct, setCheckProduct] = useState(true);
  const [editCheckCustomer, setEditCheckCustomer] = useState(true);
  const [editCheckBrand, setEditCheckBrand] = useState(true);
  const [editCheckProduct, setEditCheckProduct] = useState(true);
  const [autoCreateTable, setAutoCreateTable] = useState(false);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [skipFirstRow, setSkipFirstRow] = useState(false);
  const [editSkipFirstRow, setEditSkipFirstRow] = useState(false);
  // JSON column configuration state
  const [jsonColumnConfigs, setJsonColumnConfigs] = useState<Record<string, JsonColumnConfig>>({});
  const [sheetJsonConfigs, setSheetJsonConfigs] = useState<Record<string, JsonColumnConfig>>({});
  const [detectedJsonKeys, setDetectedJsonKeys] = useState<Record<string, string[]>>({});
  // PK column configuration state
  const [pkColumns, setPkColumns] = useState<Record<string, boolean>>({});
  const [sheetPkColumns, setSheetPkColumns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSheets();
    loadAvailableTables();
  }, []);

  const loadSheets = async () => {
    const { data, error } = await supabase
      .from("excel_sheets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load sheets",
        variant: "destructive",
      });
      return;
    }

    setSheets(data || []);
  };

  const loadAvailableTables = async () => {
    const { data, error } = await supabase
      .from("generated_tables")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tables:", error);
      return;
    }

    setAvailableTables(data || []);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
      
      if (jsonData.length > 0) {
        setAllExcelRows(jsonData);
        // Use skipFirstRow to determine which row to use as headers
        const headerRowIndex = skipFirstRow && jsonData.length > 1 ? 1 : 0;
        const headers = jsonData[headerRowIndex] as string[];
        setExcelColumns(headers);
        
        // Detect JSON columns by analyzing first few data rows
        detectJsonColumns(headers, jsonData, headerRowIndex);
        
        toast({
          title: "File loaded",
          description: `Found ${headers.length} columns`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse Excel file",
        variant: "destructive",
      });
    }
  };

  // Detect JSON columns and extract available keys
  const detectJsonColumns = (headers: string[], jsonData: string[][], headerRowIndex: number) => {
    const dataStartIndex = headerRowIndex + 1;
    const sampleRows = jsonData.slice(dataStartIndex, dataStartIndex + 10); // Sample first 10 rows
    const detectedKeys: Record<string, string[]> = {};
    const newJsonConfigs: Record<string, JsonColumnConfig> = {};

    headers.forEach((header, colIndex) => {
      if (!header) return;
      const headerStr = String(header).trim();
      
      // Check sample values to see if they look like JSON
      const jsonKeys = new Set<string>();
      let looksLikeJson = false;

      for (const row of sampleRows) {
        const cellValue = row[colIndex];
        if (cellValue && typeof cellValue === 'string') {
          const trimmed = cellValue.trim();
          // Check if it starts with { or [ (JSON object or array)
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
              (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              const parsed = JSON.parse(trimmed);
              looksLikeJson = true;
              // Extract keys from JSON object
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                Object.keys(parsed).forEach(key => jsonKeys.add(key));
              }
            } catch {
              // Not valid JSON, skip
            }
          }
        }
      }

      if (looksLikeJson) {
        detectedKeys[headerStr] = Array.from(jsonKeys);
        newJsonConfigs[headerStr] = { isJson: true, splitKeys: Array.from(jsonKeys) };
      }
    });

    setDetectedJsonKeys(detectedKeys);
    setJsonColumnConfigs(newJsonConfigs);
  };

  // Update columns when skipFirstRow changes
  useEffect(() => {
    if (allExcelRows.length > 0) {
      const headerRowIndex = skipFirstRow && allExcelRows.length > 1 ? 1 : 0;
      const headers = allExcelRows[headerRowIndex] as string[];
      setExcelColumns(headers);
      
      // Re-detect JSON columns
      detectJsonColumns(headers, allExcelRows, headerRowIndex);
    }
  }, [skipFirstRow, allExcelRows]);

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    const table = availableTables.find(t => t.table_name === tableName);
    if (table) {
      const cols = table.columns.map((col: any) => String(col.name).trim());
      setTableColumns(cols);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!sheetCode || !sheetName || !file) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields and upload a file",
        variant: "destructive",
      });
      return;
    }

    if (!autoCreateTable && availableTables.length === 0) {
      toast({
        title: "No Tables Available",
        description: "Please create a database table first using the Table Generator or enable 'Auto Create Table'",
        variant: "destructive",
      });
      return;
    }

    if (!autoCreateTable && !selectedTable) {
      toast({
        title: "Validation Error",
        description: "Please select a target table for mapping or enable 'Auto Create Table'",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let targetTableName = selectedTable;
    const autoMappings: Record<string, string> = {};

    // If auto create table is enabled, create the table first
    if (autoCreateTable && excelColumns.length > 0) {
      setIsCreatingTable(true);
      try {
        // Prepare columns for table creation - convert Excel column names to valid DB column names
        const usedNames = new Map<string, number>();
        const allColumnPairs: { excelCol: string; name: string; type: string; nullable: boolean; isFromJson?: boolean; parentCol?: string }[] = [];
        
        excelColumns
          .map((colName) => String(colName ?? "").trim())
          .filter((colName) => colName.length > 0)
          .forEach((colName, index) => {
            const jsonConfig = jsonColumnConfigs[colName];
            
            // Check if this is a JSON column that should be split
            if (jsonConfig?.isJson && jsonConfig.splitKeys.length > 0) {
              // Create columns for each JSON key
              jsonConfig.splitKeys.forEach((jsonKey) => {
                let cleanName = jsonKey
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, "_")
                  .replace(/_+/g, "_")
                  .replace(/^_|_$/g, "");
                
                if (cleanName && /^[0-9]/.test(cleanName)) {
                  cleanName = "col_" + cleanName;
                }
                if (!cleanName) {
                  cleanName = `json_field_${index}`;
                }
                
                // Ensure uniqueness
                const count = (usedNames.get(cleanName) ?? 0) + 1;
                usedNames.set(cleanName, count);
                const uniqueName = count === 1 ? cleanName : `${cleanName}_${count}`;
                
                allColumnPairs.push({ 
                  excelCol: colName, 
                  name: uniqueName, 
                  type: "text", 
                  nullable: true,
                  isFromJson: true,
                  parentCol: colName
                });
              });
            } else {
              // Regular column
              let cleanName = colName
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_|_$/g, "");

              if (cleanName && /^[0-9]/.test(cleanName)) {
                cleanName = "col_" + cleanName;
              }
              if (!cleanName) {
                cleanName = `column_${index + 1}`;
              }

              const count = (usedNames.get(cleanName) ?? 0) + 1;
              usedNames.set(cleanName, count);
              const uniqueName = count === 1 ? cleanName : `${cleanName}_${count}`;

              allColumnPairs.push({ excelCol: colName, name: uniqueName, type: "text", nullable: true });
            }
          });

        const tableColumns = allColumnPairs.map(({ name, type, nullable }) => ({ name, type, nullable }));

        if (tableColumns.length === 0) {
          throw new Error("No valid columns found (check your header row / Skip First Row setting)");
        }

        // Use sheet_code as table name (cleaned)
        const tableName = sheetCode
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');

        // Call the create-table edge function
        const { data: createResult, error: createError } = await supabase.functions.invoke('create-table', {
          body: { tableName, columns: tableColumns }
        });

        if (createError) throw createError;
        if (createResult?.error) throw new Error(createResult.error);

        targetTableName = tableName;

        // Auto-map columns - Excel column to cleaned DB column
        allColumnPairs.forEach(({ excelCol, name }) => {
          // For non-JSON columns, create regular mapping
          if (!allColumnPairs.find(p => p.excelCol === excelCol && p.isFromJson)) {
            autoMappings[excelCol] = name;
          }
        });
        setColumnMappings(autoMappings);

        // Refresh available tables
        await loadAvailableTables();

        toast({
          title: "Table Created",
          description: `Table '${tableName}' created with ${tableColumns.length} columns`,
        });
      } catch (error: any) {
        toast({
          title: "Error Creating Table",
          description: error.message,
          variant: "destructive",
        });
        setIsCreatingTable(false);
        setIsUploading(false);
        return;
      }
      setIsCreatingTable(false);
    }

    // Build mappings to save - use autoMappings if auto-created, otherwise use state
    const mappingsToSave = autoCreateTable ? autoMappings : columnMappings;

    try {
      // Save sheet configuration
      const { data: sheetData, error: sheetError } = await supabase
        .from("excel_sheets")
        .insert({
          sheet_code: sheetCode,
          sheet_name: sheetName,
          file_name: file.name,
          target_table: targetTableName,
          check_customer: checkCustomer,
          check_brand: checkBrand,
          check_product: checkProduct,
          skip_first_row: skipFirstRow,
        })
        .select()
        .single();

      if (sheetError) throw sheetError;

      // Save column mappings (including JSON split config)
      if (targetTableName) {
        const mappings: any[] = [];

        // Regular column mappings
        Object.entries(mappingsToSave).forEach(([excelCol, tableCol]) => {
          const colName = String(excelCol).trim();
          const tableColTrim = String(tableCol ?? "").trim();
          if (!colName || !tableColTrim) return;

          const jsonConfig = jsonColumnConfigs[colName];

          // If it's a JSON column with split keys, store key->column mapping JSON
          if (jsonConfig?.isJson && jsonConfig.splitKeys.length > 0) {
            const keyToColumnMap: Record<string, string> = {};
            jsonConfig.splitKeys.forEach((key) => {
              const cleanName = key
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_|_$/g, "");
              keyToColumnMap[key] = cleanName;
            });

            mappings.push({
              sheet_id: sheetData.id,
              excel_column: colName,
              table_column: JSON.stringify(keyToColumnMap),
              data_type: "text",
              is_json_column: true,
              json_split_keys: jsonConfig.splitKeys,
              is_pk: pkColumns[colName] || false,
            });
            return;
          }

          // Regular mapping
          mappings.push({
            sheet_id: sheetData.id,
            excel_column: colName,
            table_column: tableColTrim,
            data_type: "text",
            is_json_column: false,
            json_split_keys: null,
            is_pk: pkColumns[colName] || false,
          });
        });

        // JSON columns may not be present in mappingsToSave (auto-create flow), so ensure they're saved
        Object.entries(jsonColumnConfigs).forEach(([excelCol, cfg]) => {
          const colName = String(excelCol).trim();
          if (!cfg?.isJson || cfg.splitKeys.length === 0) return;
          if (mappings.some((m) => m.excel_column === colName && m.is_json_column)) return;

          const keyToColumnMap: Record<string, string> = {};
          cfg.splitKeys.forEach((key) => {
            const cleanName = key
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, "_")
              .replace(/_+/g, "_")
              .replace(/^_|_$/g, "");
            keyToColumnMap[key] = cleanName;
          });

          mappings.push({
            sheet_id: sheetData.id,
            excel_column: colName,
            table_column: JSON.stringify(keyToColumnMap),
            data_type: "text",
            is_json_column: true,
            json_split_keys: cfg.splitKeys,
            is_pk: pkColumns[colName] || false,
          });
        });

        if (mappings.length > 0) {
          const { error: mappingError } = await supabase
            .from("excel_column_mappings")
            .insert(mappings);

          if (mappingError) throw mappingError;
        }
      }

      toast({
        title: "Success",
        description: "Sheet configuration saved successfully",
      });

      // Reset form
      setSheetCode("");
      setSheetName("");
      setFile(null);
      setExcelColumns([]);
      setAllExcelRows([]);
      setColumnMappings({});
      setSelectedTable("");
      setCheckCustomer(true);
      setCheckBrand(true);
      setCheckProduct(true);
      setAutoCreateTable(false);
      setSkipFirstRow(false);
      setJsonColumnConfigs({});
      setDetectedJsonKeys({});
      setPkColumns({});
      loadSheets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSheet = async (id: string) => {
    // First, delete related upload_logs records
    const { error: logsError } = await supabase
      .from("upload_logs")
      .delete()
      .eq("sheet_id", id);

    if (logsError) {
      console.error("Error deleting upload logs:", logsError);
      // Continue anyway, the main delete might still work
    }

    // Then, delete related column mappings
    const { error: mappingsError } = await supabase
      .from("excel_column_mappings")
      .delete()
      .eq("sheet_id", id);

    if (mappingsError) {
      console.error("Error deleting column mappings:", mappingsError);
      // Continue anyway
    }

    // Finally, delete the sheet itself
    const { error } = await supabase
      .from("excel_sheets")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete sheet: " + error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Sheet deleted successfully",
    });
    loadSheets();
  };

  const handleOpenMappingDialog = async (sheet: any) => {
    setSelectedSheetForMapping(sheet);
    
    // Reset state first
    setSheetMappings({});
    setSheetExcelColumns([]);
    setSheetTargetTable("");
    setSheetTableColumns([]);
    setSheetJsonConfigs({});
    setSheetPkColumns({});
    
    // Load the target table if it exists
    if (sheet.target_table) {
      setSheetTargetTable(sheet.target_table);
      const table = availableTables.find(t => t.table_name === sheet.target_table);
      if (table) {
        const cols = table.columns.map((col: any) => String(col.name).trim());
        setSheetTableColumns(cols);
      }
    }
    
    // Load existing mappings (including JSON config)
    const { data: mappings, error } = await supabase
      .from("excel_column_mappings")
      .select("*")
      .eq("sheet_id", sheet.id);

    if (error) {
      console.error("Error loading mappings:", error);
      setMappingDialogOpen(true);
      return;
    }

    // Load existing column mappings and JSON configs
    const mappingsMap: Record<string, string> = {};
    const jsonConfigsMap: Record<string, JsonColumnConfig> = {};
    const pkColumnsMap: Record<string, boolean> = {};
    
    if (mappings && mappings.length > 0) {
      mappings.forEach((m: any) => {
        // Track PK columns
        if (m.is_pk) {
          pkColumnsMap[m.excel_column] = true;
        }
        
        if (m.is_json_column && m.json_split_keys && m.json_split_keys.length > 0) {
          // JSON column with split keys
          jsonConfigsMap[m.excel_column] = {
            isJson: true,
            splitKeys: m.json_split_keys || []
          };
          // Parse the key mappings from table_column (stored as JSON)
          try {
            const keyMappings = JSON.parse(m.table_column);
            if (typeof keyMappings === 'object' && keyMappings !== null) {
              Object.entries(keyMappings).forEach(([key, tableCol]) => {
                mappingsMap[`${m.excel_column}.${key}`] = tableCol as string;
              });
            }
          } catch {
            // Not JSON, probably old format - treat as regular mapping
            mappingsMap[m.excel_column] = m.table_column;
          }
        } else {
          // Regular column
          mappingsMap[m.excel_column] = m.table_column;
          if (m.is_json_column) {
            jsonConfigsMap[m.excel_column] = {
              isJson: true,
              splitKeys: m.json_split_keys || []
            };
          }
        }
      });
      setSheetMappings(mappingsMap);
      setSheetJsonConfigs(jsonConfigsMap);
      setSheetPkColumns(pkColumnsMap);
      
      // Extract unique excel columns
      const excelCols = mappings.map((m: any) => m.excel_column);
      setSheetExcelColumns(excelCols);
    }
    
    setMappingDialogOpen(true);
  };

  const handleSheetTableSelect = (tableName: string) => {
    setSheetTargetTable(tableName);
    const table = availableTables.find(t => t.table_name === tableName);
    if (table) {
      const cols = table.columns.map((col: any) => String(col.name).trim());
      setSheetTableColumns(cols);
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedSheetForMapping || !sheetTargetTable) {
      toast({
        title: "Validation Error",
        description: "Please select a target table",
        variant: "destructive",
      });
      return;
    }

    setIsSavingMappings(true);

    try {
      // Delete existing mappings
      await supabase
        .from("excel_column_mappings")
        .delete()
        .eq("sheet_id", selectedSheetForMapping.id);

      // Update the target table in excel_sheets
      await supabase
        .from("excel_sheets")
        .update({ target_table: sheetTargetTable })
        .eq("id", selectedSheetForMapping.id);

      // Insert new mappings from the current rows, trim names and skip empties
      const mappings: any[] = [];
      
      sheetExcelColumns.forEach((excelCol) => {
        const colName = String(excelCol).trim();
        if (!colName) return;
        
        const jsonConfig = sheetJsonConfigs[colName];
        const isJsonWithSplit = jsonConfig?.isJson && jsonConfig.splitKeys.length > 0;
        
        if (isJsonWithSplit) {
          // For JSON columns with split keys, get the key mappings from sheetMappings
          const keyMappings: Record<string, string> = {};
          jsonConfig.splitKeys.forEach((key) => {
            const mappingKey = `${colName}.${key}`;
            const tableCol = sheetMappings[mappingKey];
            if (tableCol) {
              keyMappings[key] = String(tableCol).trim();
            }
          });
          
          mappings.push({
            sheet_id: selectedSheetForMapping.id,
            excel_column: colName,
            table_column: JSON.stringify(keyMappings), // Store key->column mappings as JSON
            data_type: "text",
            is_json_column: true,
            json_split_keys: jsonConfig.splitKeys,
            is_pk: sheetPkColumns[colName] || false,
          });
        } else {
          // Regular column mapping
          const tableCol = sheetMappings[excelCol] ?? sheetMappings[colName];
          const tableColTrim = tableCol ? String(tableCol).trim() : "";
          if (!tableColTrim) return;
          
          mappings.push({
            sheet_id: selectedSheetForMapping.id,
            excel_column: colName,
            table_column: tableColTrim,
            data_type: "text",
            is_json_column: false,
            json_split_keys: null,
            is_pk: sheetPkColumns[colName] || false,
          });
        }
      });

      if (mappings.length > 0) {
        const { error } = await supabase
          .from("excel_column_mappings")
          .insert(mappings);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Column mappings saved successfully",
      });

      setMappingDialogOpen(false);
      setSheetMappings({});
      setSheetExcelColumns([]);
      setSheetTargetTable("");
      loadSheets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingMappings(false);
    }
  };

  const addExcelColumn = () => {
    const newCol = `column_${sheetExcelColumns.length + 1}`;
    setSheetExcelColumns([...sheetExcelColumns, newCol]);
  };

  const handleOpenEditDialog = (sheet: any) => {
    setSelectedSheetForEdit(sheet);
    setEditSheetCode(sheet.sheet_code);
    setEditSheetName(sheet.sheet_name);
    setEditCheckCustomer(sheet.check_customer ?? true);
    setEditCheckBrand(sheet.check_brand ?? true);
    setEditCheckProduct(sheet.check_product ?? true);
    setEditSkipFirstRow(sheet.skip_first_row ?? false);
    setEditDialogOpen(true);
  };

  const handleSaveSheetEdit = async () => {
    if (!selectedSheetForEdit || !editSheetCode || !editSheetName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("excel_sheets")
        .update({
          sheet_code: editSheetCode,
          sheet_name: editSheetName,
          check_customer: editCheckCustomer,
          check_brand: editCheckBrand,
          check_product: editCheckProduct,
          skip_first_row: editSkipFirstRow,
        })
        .eq("id", selectedSheetForEdit.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sheet configuration updated successfully",
      });

      setEditDialogOpen(false);
      loadSheets();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Excel Sheet Management</h1>
          <p className="text-muted-foreground">
            Upload and configure Excel sheets with column mappings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel Sheet</CardTitle>
          <CardDescription>
            Upload an Excel file and map its columns to database tables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheet-code">Sheet Code</Label>
            <Input 
              id="sheet-code" 
              placeholder="e.g., TRANS_001" 
              className="max-w-md"
              value={sheetCode}
              onChange={(e) => setSheetCode(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sheet-name">Sheet Name</Label>
            <Input 
              id="sheet-name" 
              placeholder="e.g., Monthly Transactions" 
              className="max-w-md"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Excel File</Label>
            <Input 
              id="file-upload" 
              type="file" 
              accept=".xlsx,.xls"
              className="max-w-md"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="auto-create-table" 
                checked={autoCreateTable}
                onCheckedChange={(checked) => {
                  setAutoCreateTable(checked === true);
                  if (checked === true) {
                    setSelectedTable("");
                  }
                }}
              />
              <Label htmlFor="auto-create-table" className="text-sm font-medium cursor-pointer">
                Auto Create Table
              </Label>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              Automatically create a new database table using the sheet code as the table name and auto-map all Excel columns
            </p>
          </div>

          <div className="space-y-3">
            <Label>Validation Options</Label>
            <p className="text-sm text-muted-foreground">Select which validations to perform during data loading</p>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="check-customer" 
                  checked={checkCustomer}
                  onCheckedChange={(checked) => setCheckCustomer(checked === true)}
                />
                <Label htmlFor="check-customer" className="text-sm font-normal cursor-pointer">Check Customer</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="check-brand" 
                  checked={checkBrand}
                  onCheckedChange={(checked) => setCheckBrand(checked === true)}
                />
                <Label htmlFor="check-brand" className="text-sm font-normal cursor-pointer">Check Brand</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="check-product" 
                  checked={checkProduct}
                  onCheckedChange={(checked) => setCheckProduct(checked === true)}
                />
                <Label htmlFor="check-product" className="text-sm font-normal cursor-pointer">Check Product</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="skip-first-row" 
                  checked={skipFirstRow}
                  onCheckedChange={(checked) => setSkipFirstRow(checked === true)}
                />
                <Label htmlFor="skip-first-row" className="text-sm font-normal cursor-pointer">Skip First Row</Label>
              </div>
            </div>
          </div>

          {excelColumns.length > 0 && !autoCreateTable && (
            <>
              <div className="space-y-2">
                <Label>Select Target Table</Label>
                {availableTables.length === 0 ? (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      No database tables available. Please create a table first using the Table Generator page or enable 'Auto Create Table'.
                    </p>
                  </div>
                ) : (
                  <Select value={selectedTable} onValueChange={handleTableSelect}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Choose a table to map columns" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTables.map((table) => (
                        <SelectItem key={table.id} value={table.table_name}>
                          {table.table_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedTable && tableColumns.length > 0 && (
                <div className="space-y-2">
                  <Label>Column Mapping</Label>
                  <div className="border rounded-lg p-4 space-y-3">
                    {excelColumns.map((excelCol) => (
                      <div key={excelCol} className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{excelCol}</p>
                          <p className="text-xs text-muted-foreground">Excel Column</p>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex-1">
                          <Select
                            value={columnMappings[excelCol] || ""}
                            onValueChange={(value) =>
                              setColumnMappings({ ...columnMappings, [excelCol]: value.trim() })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Map to table column" />
                            </SelectTrigger>
                            <SelectContent>
                              {tableColumns.map((col) => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* PK Checkbox */}
                        <div className="flex items-center gap-1" title="Mark as Primary Key for upsert">
                          <Checkbox
                            id={`new-pk-${excelCol}`}
                            checked={pkColumns[excelCol] || false}
                            onCheckedChange={(checked) => {
                              setPkColumns(prev => ({
                                ...prev,
                                [excelCol]: checked === true
                              }));
                            }}
                          />
                          <Label htmlFor={`new-pk-${excelCol}`} className="text-xs cursor-pointer">
                            PK
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {excelColumns.length > 0 && autoCreateTable && (
            <div className="p-4 border rounded-lg bg-primary/5 border-primary/20 space-y-4">
              <p className="text-sm font-medium text-primary">Auto Create Table Preview</p>
              <p className="text-sm text-muted-foreground">
                Table name: <span className="font-mono font-medium">{sheetCode.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}</span>
              </p>
              
              {/* JSON Column Detection Notice */}
              {Object.keys(detectedJsonKeys).length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Braces className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      JSON Columns Detected
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    The following columns contain JSON data. You can split them into separate columns.
                  </p>
                  
                  <div className="space-y-3">
                    {Object.entries(detectedJsonKeys).map(([colName, keys]) => (
                      <Collapsible key={colName}>
                        <div className="flex items-center justify-between p-2 bg-background rounded border">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`json-${colName}`}
                              checked={jsonColumnConfigs[colName]?.isJson || false}
                              onCheckedChange={(checked) => {
                                setJsonColumnConfigs(prev => ({
                                  ...prev,
                                  [colName]: {
                                    isJson: checked === true,
                                    splitKeys: checked === true ? keys : []
                                  }
                                }));
                              }}
                            />
                            <Label htmlFor={`json-${colName}`} className="text-sm font-mono cursor-pointer">
                              {colName}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              ({keys.length} keys found)
                            </span>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="p-2 border-x border-b rounded-b">
                          <p className="text-xs text-muted-foreground mb-2">
                            Select which keys to split into columns:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {keys.map((key) => (
                              <div key={key} className="flex items-center gap-1">
                                <Checkbox
                                  id={`key-${colName}-${key}`}
                                  checked={jsonColumnConfigs[colName]?.splitKeys.includes(key) || false}
                                  disabled={!jsonColumnConfigs[colName]?.isJson}
                                  onCheckedChange={(checked) => {
                                    setJsonColumnConfigs(prev => {
                                      const current = prev[colName] || { isJson: true, splitKeys: [] };
                                      const newKeys = checked 
                                        ? [...current.splitKeys, key]
                                        : current.splitKeys.filter(k => k !== key);
                                      return {
                                        ...prev,
                                        [colName]: { ...current, splitKeys: newKeys }
                                      };
                                    });
                                  }}
                                />
                                <Label 
                                  htmlFor={`key-${colName}-${key}`} 
                                  className="text-xs font-mono cursor-pointer"
                                >
                                  {key}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Columns to create ({excelColumns.length + Object.values(jsonColumnConfigs).reduce((acc, cfg) => acc + (cfg.isJson ? cfg.splitKeys.length - 1 : 0), 0)}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {excelColumns.map((col) => {
                    const colStr = String(col).trim();
                    const jsonConfig = jsonColumnConfigs[colStr];
                    
                    // If this is a JSON column being split, show the split keys
                    if (jsonConfig?.isJson && jsonConfig.splitKeys.length > 0) {
                      return jsonConfig.splitKeys.map((key) => {
                        const cleanName = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                        return (
                          <span key={`${col}-${key}`} className="px-2 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded text-xs font-mono flex items-center gap-1">
                            <Braces className="h-3 w-3" />
                            {cleanName}
                          </span>
                        );
                      });
                    }
                    
                    // Regular column
                    const cleanName = colStr.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    return (
                      <span key={col} className="px-2 py-1 bg-muted rounded text-xs font-mono">
                        {cleanName}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="pt-4">
            <Button 
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={handleSaveConfiguration}
              disabled={isUploading || isCreatingTable}
            >
              {isCreatingTable ? "Creating Table..." : isUploading ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sheets</CardTitle>
          <CardDescription>
            Manage your uploaded Excel sheets and their mappings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sheets configured yet</p>
              <p className="text-sm">Upload your first Excel sheet to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sheet Code</TableHead>
                  <TableHead>Sheet Name</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((sheet) => (
                  <TableRow key={sheet.id}>
                    <TableCell className="font-mono">{sheet.sheet_code}</TableCell>
                    <TableCell>{sheet.sheet_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sheet.file_name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {sheet.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(sheet.updated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenEditDialog(sheet)}
                          title="Edit sheet details"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleOpenMappingDialog(sheet)}
                          title="Configure column mappings"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteSheet(sheet.id)}
                          title="Delete sheet"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Excel Mapping</DialogTitle>
            <DialogDescription>
              {selectedSheetForMapping?.sheet_name} - Define how Excel columns map to database table columns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Target Table</Label>
              <Select value={sheetTargetTable} onValueChange={handleSheetTableSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a table to map columns" />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.table_name}>
                      {table.table_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sheetTargetTable && sheetTableColumns.length > 0 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Column Mapping</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={addExcelColumn}
                    >
                      Add Excel Column
                    </Button>
                  </div>
                  <div className="border rounded-lg p-4 space-y-3">
                    {sheetExcelColumns.map((excelCol, index) => {
                      const jsonConfig = sheetJsonConfigs[excelCol];
                      const isJsonWithSplit = jsonConfig?.isJson && jsonConfig.splitKeys.length > 0;
                      
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={excelCol}
                                  onChange={(e) => {
                                    const newColName = e.target.value;
                                    const oldColName = sheetExcelColumns[index];
                                    
                                    const newCols = [...sheetExcelColumns];
                                    newCols[index] = newColName;
                                    setSheetExcelColumns(newCols);
                                    
                                    if (oldColName !== newColName && sheetMappings[oldColName]) {
                                      const newMappings = { ...sheetMappings };
                                      newMappings[newColName] = newMappings[oldColName];
                                      delete newMappings[oldColName];
                                      setSheetMappings(newMappings);
                                    }
                                  }}
                                  placeholder="Excel column name"
                                />
                                {/* JSON Column Toggle */}
                                <Button
                                  variant={jsonConfig?.isJson ? "default" : "outline"}
                                  size="sm"
                                  className="shrink-0"
                                  title={jsonConfig?.isJson ? "JSON Column - Click to disable" : "Mark as JSON Column"}
                                  onClick={() => {
                                    setSheetJsonConfigs(prev => {
                                      const current = prev[excelCol] || { isJson: false, splitKeys: [] };
                                      if (current.isJson) {
                                        // Disable JSON - remove config
                                        const newConfigs = { ...prev };
                                        delete newConfigs[excelCol];
                                        // Clear JSON key mappings
                                        setSheetMappings(prevMappings => {
                                          const newMappings = { ...prevMappings };
                                          Object.keys(newMappings).forEach(key => {
                                            if (key.startsWith(`${excelCol}.`)) {
                                              delete newMappings[key];
                                            }
                                          });
                                          return newMappings;
                                        });
                                        return newConfigs;
                                      } else {
                                        // Enable JSON
                                        return {
                                          ...prev,
                                          [excelCol]: { isJson: true, splitKeys: [] }
                                        };
                                      }
                                    });
                                  }}
                                >
                                  <Braces className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Excel Column {jsonConfig?.isJson && "(JSON Column)"}
                              </p>
                            </div>
                            <span className="text-muted-foreground">→</span>
                            <div className="flex-1">
                              {!isJsonWithSplit ? (
                                <Select
                                  value={sheetMappings[excelCol] || ""}
                                  onValueChange={(value) =>
                                    setSheetMappings({ ...sheetMappings, [excelCol]: value.trim() })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Map to table column" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {sheetTableColumns.map((col) => (
                                      <SelectItem key={col} value={col}>
                                        {col}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="text-sm text-muted-foreground italic">
                                  JSON keys mapped below
                                </div>
                              )}
                            </div>
                            {/* PK Checkbox */}
                            <div className="flex items-center gap-1" title="Mark as Primary Key for upsert">
                              <Checkbox
                                id={`pk-${excelCol}`}
                                checked={sheetPkColumns[excelCol] || false}
                                onCheckedChange={(checked) => {
                                  setSheetPkColumns(prev => ({
                                    ...prev,
                                    [excelCol]: checked === true
                                  }));
                                }}
                              />
                              <Label htmlFor={`pk-${excelCol}`} className="text-xs cursor-pointer">
                                PK
                              </Label>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const colToDelete = sheetExcelColumns[index];
                                setSheetExcelColumns(sheetExcelColumns.filter((_, i) => i !== index));
                                const newMappings = { ...sheetMappings };
                                delete newMappings[colToDelete];
                                // Also delete JSON key mappings
                                Object.keys(newMappings).forEach(key => {
                                  if (key.startsWith(`${colToDelete}.`)) {
                                    delete newMappings[key];
                                  }
                                });
                                setSheetMappings(newMappings);
                                // Remove JSON config
                                const newJsonConfigs = { ...sheetJsonConfigs };
                                delete newJsonConfigs[colToDelete];
                                setSheetJsonConfigs(newJsonConfigs);
                                // Remove PK config
                                const newPkColumns = { ...sheetPkColumns };
                                delete newPkColumns[colToDelete];
                                setSheetPkColumns(newPkColumns);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          
                          {/* JSON Keys Input when JSON is enabled but no keys yet */}
                          {jsonConfig?.isJson && !isJsonWithSplit && (
                            <div className="ml-6 pl-4 border-l-2 border-amber-500/30">
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Enter JSON keys (comma separated, e.g.: key1, key2, key3)"
                                  className="text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const input = e.currentTarget;
                                      const keys = input.value.split(',').map(k => k.trim()).filter(k => k.length > 0);
                                      if (keys.length > 0) {
                                        setSheetJsonConfigs(prev => ({
                                          ...prev,
                                          [excelCol]: { isJson: true, splitKeys: keys }
                                        }));
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                    const keys = input.value.split(',').map(k => k.trim()).filter(k => k.length > 0);
                                    if (keys.length > 0) {
                                      setSheetJsonConfigs(prev => ({
                                        ...prev,
                                        [excelCol]: { isJson: true, splitKeys: keys }
                                      }));
                                      input.value = '';
                                    }
                                  }}
                                >
                                  Add Keys
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Enter the JSON keys to extract and map to table columns
                              </p>
                            </div>
                          )}
                          
                          {/* JSON Split Keys Mapping */}
                          {isJsonWithSplit && (
                            <div className="ml-6 pl-4 border-l-2 border-amber-500/30 space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs text-muted-foreground">JSON Keys to extract:</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    setSheetJsonConfigs(prev => ({
                                      ...prev,
                                      [excelCol]: { isJson: true, splitKeys: [] }
                                    }));
                                    // Clear existing key mappings
                                    setSheetMappings(prevMappings => {
                                      const newMappings = { ...prevMappings };
                                      Object.keys(newMappings).forEach(key => {
                                        if (key.startsWith(`${excelCol}.`)) {
                                          delete newMappings[key];
                                        }
                                      });
                                      return newMappings;
                                    });
                                  }}
                                >
                                  Clear Keys
                                </Button>
                              </div>
                              {jsonConfig.splitKeys.map((key) => {
                                const mappingKey = `${excelCol}.${key}`;
                                return (
                                  <div key={key} className="flex items-center gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">↳</span>
                                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                          {key}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1 ml-5">JSON Key</p>
                                    </div>
                                    <span className="text-muted-foreground">→</span>
                                    <div className="flex-1">
                                      <Select
                                        value={sheetMappings[mappingKey] || ""}
                                        onValueChange={(value) =>
                                          setSheetMappings({ ...sheetMappings, [mappingKey]: value.trim() })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Map to table column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {sheetTableColumns.map((col) => (
                                            <SelectItem key={col} value={col}>
                                              {col}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        // Remove this specific key
                                        setSheetJsonConfigs(prev => ({
                                          ...prev,
                                          [excelCol]: {
                                            isJson: true,
                                            splitKeys: jsonConfig.splitKeys.filter(k => k !== key)
                                          }
                                        }));
                                        // Remove the mapping for this key
                                        setSheetMappings(prevMappings => {
                                          const newMappings = { ...prevMappings };
                                          delete newMappings[mappingKey];
                                          return newMappings;
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                );
                              })}
                              {/* Add more keys */}
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  placeholder="Add more keys (comma separated)"
                                  className="text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const input = e.currentTarget;
                                      const newKeys = input.value.split(',').map(k => k.trim()).filter(k => k.length > 0 && !jsonConfig.splitKeys.includes(k));
                                      if (newKeys.length > 0) {
                                        setSheetJsonConfigs(prev => ({
                                          ...prev,
                                          [excelCol]: { isJson: true, splitKeys: [...jsonConfig.splitKeys, ...newKeys] }
                                        }));
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                                    const newKeys = input.value.split(',').map(k => k.trim()).filter(k => k.length > 0 && !jsonConfig.splitKeys.includes(k));
                                    if (newKeys.length > 0) {
                                      setSheetJsonConfigs(prev => ({
                                        ...prev,
                                        [excelCol]: { isJson: true, splitKeys: [...jsonConfig.splitKeys, ...newKeys] }
                                      }));
                                      input.value = '';
                                    }
                                  }}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setMappingDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveMappings}
                    disabled={isSavingMappings}
                  >
                    {isSavingMappings ? "Saving..." : "Save Mappings"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sheet Configuration</DialogTitle>
            <DialogDescription>
              Update sheet code and name
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-sheet-code">Sheet Code</Label>
              <Input 
                id="edit-sheet-code" 
                placeholder="e.g., TRANS_001" 
                value={editSheetCode}
                onChange={(e) => setEditSheetCode(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-sheet-name">Sheet Name</Label>
              <Input 
                id="edit-sheet-name" 
                placeholder="e.g., Monthly Transactions" 
                value={editSheetName}
                onChange={(e) => setEditSheetName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Validation Options</Label>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="edit-check-customer" 
                    checked={editCheckCustomer}
                    onCheckedChange={(checked) => setEditCheckCustomer(checked === true)}
                  />
                  <Label htmlFor="edit-check-customer" className="text-sm font-normal cursor-pointer">Check Customer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="edit-check-brand" 
                    checked={editCheckBrand}
                    onCheckedChange={(checked) => setEditCheckBrand(checked === true)}
                  />
                  <Label htmlFor="edit-check-brand" className="text-sm font-normal cursor-pointer">Check Brand</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="edit-check-product" 
                    checked={editCheckProduct}
                    onCheckedChange={(checked) => setEditCheckProduct(checked === true)}
                  />
                  <Label htmlFor="edit-check-product" className="text-sm font-normal cursor-pointer">Check Product</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="edit-skip-first-row" 
                    checked={editSkipFirstRow}
                    onCheckedChange={(checked) => setEditSkipFirstRow(checked === true)}
                  />
                  <Label htmlFor="edit-skip-first-row" className="text-sm font-normal cursor-pointer">Skip First Row</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveSheetEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExcelSheets;
