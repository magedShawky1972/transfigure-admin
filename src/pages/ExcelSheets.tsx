import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Trash2, FileSpreadsheet } from "lucide-react";
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
      const cols = table.columns.map((col: any) => col.name);
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

    setIsUploading(true);

    try {
      // Save sheet configuration
      const { data: sheetData, error: sheetError } = await supabase
        .from("excel_sheets")
        .insert({
          sheet_code: sheetCode,
          sheet_name: sheetName,
          file_name: file.name,
        })
        .select()
        .single();

      if (sheetError) throw sheetError;

      // Save column mappings if any exist
      if (Object.keys(columnMappings).length > 0 && selectedTable) {
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

          {excelColumns.length > 0 && (
            <>
              <div className="space-y-2">
                <Label>Select Target Table</Label>
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
                              setColumnMappings({ ...columnMappings, [excelCol]: value })
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

          <div className="pt-4">
            <Button 
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={handleSaveConfiguration}
              disabled={isUploading}
            >
              {isUploading ? "Saving..." : "Save Configuration"}
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
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteSheet(sheet.id)}
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
    </div>
  );
};

export default ExcelSheets;
