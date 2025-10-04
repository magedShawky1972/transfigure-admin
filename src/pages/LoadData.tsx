import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ExcelSheet {
  id: string;
  sheet_name: string;
  sheet_code: string;
  target_table: string;
}

const LoadData = () => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<ExcelSheet[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableSheets();
  }, []);

  const loadAvailableSheets = async () => {
    const { data, error } = await supabase
      .from("excel_sheets")
      .select("id, sheet_name, sheet_code, target_table")
      .eq("status", "active");

    if (error) {
      toast({
        title: "Error loading sheet types",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setAvailableSheets(data || []);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSheet) {
      toast({
        title: "No sheet type selected",
        description: "Please select which type of Excel sheet you're uploading",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Read the Excel file
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Call the edge function to process and insert data
      const { data: result, error } = await supabase.functions.invoke("load-excel-data", {
        body: {
          sheetId: selectedSheet,
          data: jsonData,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Loaded ${result.count} records successfully`,
      });

      setSelectedFile(null);
      setSelectedSheet("");
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Load Data From Excel</h1>
        <p className="text-muted-foreground">
          Upload daily sales data to the system
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Select an Excel file with your daily sales data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="sheet-type">Excel Sheet Type</Label>
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger id="sheet-type">
                <SelectValue placeholder="Select sheet type" />
              </SelectTrigger>
              <SelectContent>
                {availableSheets.map((sheet) => (
                  <SelectItem key={sheet.id} value={sheet.id}>
                    {sheet.sheet_name} ({sheet.sheet_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
            <div className="flex justify-center">
              <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            </div>
            <div>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls)</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
            </div>
            {selectedFile && (
              <p className="text-sm text-primary font-medium">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <Button 
            onClick={handleUpload}
            disabled={!selectedFile || !selectedSheet || isLoading}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isLoading ? "Processing..." : "Upload and Process"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoadData;
