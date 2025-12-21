import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Trash2, FileSpreadsheet, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const ExcelSheets = () => {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<any[]>([]);
  const [sheetCode, setSheetCode] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
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
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[];
        setExcelColumns(headers);
        
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

    // If auto create table is enabled, create the table first
    if (autoCreateTable && excelColumns.length > 0) {
      setIsCreatingTable(true);
      try {
        // Prepare columns for table creation - convert Excel column names to valid DB column names
        const tableColumns = excelColumns.map((colName) => {
          // Convert column name to snake_case and remove special characters
          const cleanName = String(colName)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
          
          return {
            name: cleanName || `column_${Math.random().toString(36).substr(2, 5)}`,
            type: 'text',
            nullable: true,
          };
        });

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
        const autoMappings: Record<string, string> = {};
        excelColumns.forEach((excelCol, index) => {
          autoMappings[excelCol] = tableColumns[index].name;
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
        })
        .select()
        .single();

      if (sheetError) throw sheetError;

      // Save column mappings if any exist
      if (Object.keys(columnMappings).length > 0 && targetTableName) {
        const mappings = Object.entries(columnMappings).map(([excelCol, tableCol]) => ({
          sheet_id: sheetData.id,
          excel_column: excelCol,
          table_column: tableCol,
          data_type: "text",
        }));

        const { error: mappingError } = await supabase
          .from("excel_column_mappings")
          .insert(mappings);

        if (mappingError) throw mappingError;
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
      setColumnMappings({});
      setSelectedTable("");
      setCheckCustomer(true);
      setCheckBrand(true);
      setCheckProduct(true);
      setAutoCreateTable(false);
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
    const { error } = await supabase
      .from("excel_sheets")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete sheet",
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
    
    // Load the target table if it exists
    if (sheet.target_table) {
      setSheetTargetTable(sheet.target_table);
      const table = availableTables.find(t => t.table_name === sheet.target_table);
      if (table) {
        const cols = table.columns.map((col: any) => String(col.name).trim());
        setSheetTableColumns(cols);
      }
    }
    
    // Load existing mappings
    const { data: mappings, error } = await supabase
      .from("excel_column_mappings")
      .select("*")
      .eq("sheet_id", sheet.id);

    if (error) {
      console.error("Error loading mappings:", error);
      setMappingDialogOpen(true);
      return;
    }

    // Load existing column mappings
    const mappingsMap: Record<string, string> = {};
    if (mappings && mappings.length > 0) {
      mappings.forEach((m) => {
        mappingsMap[m.excel_column] = m.table_column;
      });
      setSheetMappings(mappingsMap);
      
      // Extract unique excel columns
      const excelCols = mappings.map(m => m.excel_column);
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
      const mappings = sheetExcelColumns
        .map((excelCol) => {
          const colName = String(excelCol).trim();
          const tableCol = sheetMappings[excelCol] ?? sheetMappings[colName];
          const tableColTrim = tableCol ? String(tableCol).trim() : "";
          if (!colName || !tableColTrim) return null;
          return {
            sheet_id: selectedSheetForMapping.id,
            excel_column: colName,
            table_column: tableColTrim,
            data_type: "text",
          };
        })
        .filter(Boolean) as any[];

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
            </div>
          </div>

          {excelColumns.length > 0 && (
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
          )}

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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {excelColumns.length > 0 && autoCreateTable && (
            <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
              <p className="text-sm font-medium text-primary mb-2">Auto Create Table Preview</p>
              <p className="text-sm text-muted-foreground mb-2">
                Table name: <span className="font-mono font-medium">{sheetCode.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}</span>
              </p>
              <p className="text-sm text-muted-foreground mb-2">Columns to create ({excelColumns.length}):</p>
              <div className="flex flex-wrap gap-2">
                {excelColumns.map((col) => {
                  const cleanName = String(col).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                  return (
                    <span key={col} className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {cleanName}
                    </span>
                  );
                })}
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
                    {sheetExcelColumns.map((excelCol, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="flex-1">
                          <Input
                            value={excelCol}
                            onChange={(e) => {
                              const newColName = e.target.value;
                              const oldColName = sheetExcelColumns[index]; // Get the actual old value
                              
                              // Update the excel columns array
                              const newCols = [...sheetExcelColumns];
                              newCols[index] = newColName;
                              setSheetExcelColumns(newCols);
                              
                              // If there was a mapping for the old column name, transfer it to the new name
                              if (oldColName !== newColName && sheetMappings[oldColName]) {
                                const newMappings = { ...sheetMappings };
                                newMappings[newColName] = newMappings[oldColName];
                                delete newMappings[oldColName];
                                setSheetMappings(newMappings);
                              }
                            }}
                            placeholder="Excel column name"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Excel Column</p>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex-1">
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
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const colToDelete = sheetExcelColumns[index];
                            setSheetExcelColumns(sheetExcelColumns.filter((_, i) => i !== index));
                            const newMappings = { ...sheetMappings };
                            delete newMappings[colToDelete];
                            setSheetMappings(newMappings);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
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
