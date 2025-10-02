import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Settings, Trash2, FileSpreadsheet as FileSpreadsheetIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

const ExcelSheets = () => {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<any[]>([]);
  const [sheetCode, setSheetCode] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, { tableColumn: string; dataType: string }>>({});
  const [generatedTables, setGeneratedTables] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSheets();
    fetchGeneratedTables();
  }, []);

  const fetchSheets = async () => {
    const { data, error } = await supabase
      .from("excel_sheets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch sheets",
        variant: "destructive",
      });
      return;
    }

    setSheets(data || []);
  };

  const fetchGeneratedTables = async () => {
    const { data, error } = await supabase
      .from("generated_tables")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setGeneratedTables(data || []);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      
      if (jsonData.length > 0) {
        const columns = jsonData[0].filter(col => col).map(String);
        setExcelColumns(columns);
        
        toast({
          title: "File Loaded",
          description: `Found ${columns.length} columns in Excel file`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!sheetCode || !sheetName || !selectedFile) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and upload a file",
        variant: "destructive",
      });
      return;
    }

    if (excelColumns.length === 0) {
      toast({
        title: "Error",
        description: "No columns found in Excel file",
        variant: "destructive",
      });
      return;
    }

    const { data: sheetData, error: sheetError } = await supabase
      .from("excel_sheets")
      .insert({
        sheet_code: sheetCode,
        sheet_name: sheetName,
        file_name: selectedFile.name,
      })
      .select()
      .single();

    if (sheetError) {
      toast({
        title: "Error",
        description: "Failed to save sheet configuration",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Sheet configuration saved. Now map the columns to your table.",
    });

    fetchSheets();
    setSheetCode("");
    setSheetName("");
    setSelectedFile(null);
  };

  const handleSaveMappings = async (sheetId: string) => {
    const mappings = Object.entries(columnMappings)
      .filter(([_, value]) => value.tableColumn && value.dataType)
      .map(([excelCol, value]) => ({
        sheet_id: sheetId,
        excel_column: excelCol,
        table_column: value.tableColumn,
        data_type: value.dataType,
      }));

    if (mappings.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please map at least one column",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("excel_column_mappings")
      .insert(mappings);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save column mappings",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Mapped ${mappings.length} columns successfully`,
    });

    setExcelColumns([]);
    setColumnMappings({});
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
        <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Add New Sheet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel Sheet</CardTitle>
          <CardDescription>
            Upload an Excel file and define its structure
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
              disabled={isProcessing}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          {excelColumns.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <Label>Column Mappings</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Map Excel columns to table columns
                </p>
              </div>

              <div className="space-y-3">
                {excelColumns.map((col) => (
                  <div key={col} className="grid grid-cols-3 gap-4 items-center p-4 border rounded-lg">
                    <div>
                      <Label className="text-xs text-muted-foreground">Excel Column</Label>
                      <p className="font-medium">{col}</p>
                    </div>
                    <div>
                      <Label className="text-xs">Table Column</Label>
                      <Input
                        placeholder="column_name"
                        value={columnMappings[col]?.tableColumn || ""}
                        onChange={(e) => setColumnMappings({
                          ...columnMappings,
                          [col]: { ...columnMappings[col], tableColumn: e.target.value, dataType: columnMappings[col]?.dataType || "text" }
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data Type</Label>
                      <Select
                        value={columnMappings[col]?.dataType || "text"}
                        onValueChange={(value) => setColumnMappings({
                          ...columnMappings,
                          [col]: { ...columnMappings[col], dataType: value, tableColumn: columnMappings[col]?.tableColumn || "" }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="integer">Integer</SelectItem>
                          <SelectItem value="decimal">Decimal</SelectItem>
                          <SelectItem value="timestamp">Timestamp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <Button 
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              onClick={handleSaveConfiguration}
              disabled={isProcessing}
            >
              Save Configuration
            </Button>
            {excelColumns.length > 0 && sheets.length > 0 && (
              <Button 
                variant="outline"
                onClick={() => handleSaveMappings(sheets[0].id)}
              >
                Save Mappings
              </Button>
            )}
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
              <FileSpreadsheetIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sheets configured yet</p>
              <p className="text-sm">Upload your first Excel sheet to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sheet Code</TableHead>
                  <TableHead>Sheet Name</TableHead>
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
                    <TableCell>
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                        {sheet.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(sheet.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
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
