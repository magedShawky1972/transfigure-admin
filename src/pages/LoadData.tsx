import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [showExtraColumnsDialog, setShowExtraColumnsDialog] = useState(false);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [pendingUploadData, setPendingUploadData] = useState<any>(null);

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
    setProgress(0);
    setUploadStatus("Reading Excel file...");

    try {
      // Read the Excel file
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: "Empty file",
          description: "The Excel file contains no data",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Get column mappings for the selected sheet
      const { data: mappings, error: mappingsError } = await supabase
        .from("excel_column_mappings")
        .select("excel_column")
        .eq("sheet_id", selectedSheet);

      if (mappingsError) {
        toast({
          title: "Error loading mappings",
          description: mappingsError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const mappedColumns = mappings?.map(m => m.excel_column.trim()) || [];
      const fileColumns = Object.keys(jsonData[0] as object).map(col => col.trim());

      // Check for missing columns (columns in mapping but not in file)
      const missingColumns = mappedColumns.filter(col => !fileColumns.includes(col));
      
      if (missingColumns.length > 0) {
        toast({
          title: "Missing Columns",
          description: `The following columns are missing in the Excel file: ${missingColumns.join(", ")}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check for extra columns (columns in file but not in mapping)
      const extraCols = fileColumns.filter(col => !mappedColumns.includes(col));
      
      if (extraCols.length > 0) {
        setExtraColumns(extraCols);
        setPendingUploadData(jsonData);
        setShowExtraColumnsDialog(true);
        setIsLoading(false);
        return;
      }

      // Proceed with upload
      await processUpload(jsonData);
    } catch (error: any) {
      toast({
        title: "Error reading file",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const processUpload = async (jsonData: any[]) => {
    setIsLoading(true);
    setProgress(0);
    setUploadStatus("Processing data...");

    let uploadLogId: string | null = null;
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user profile for user_name
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user?.id)
        .single();

      toast({
        title: "Upload started",
        description: "Processing your Excel file...",
      });

      // Extract distinct dates from the data
      const dateFields = ['created_at_date', 'date', 'transaction_date', 'order_date'];
      const distinctDates = new Set<string>();
      
      jsonData.forEach((row: any) => {
        dateFields.forEach(field => {
          if (row[field]) {
            const dateStr = new Date(row[field]).toISOString().split('T')[0];
            distinctDates.add(dateStr);
          }
        });
      });

      // Create upload log
      const { data: logData, error: logError } = await supabase
        .from("upload_logs")
        .insert({
          file_name: selectedFile?.name || "Unknown",
          user_id: user?.id,
          user_name: profile?.user_name || user?.email?.split('@')[0] || "Unknown",
          status: "processing",
          sheet_id: selectedSheet,
          excel_dates: Array.from(distinctDates).sort(),
          records_processed: 0,
        })
        .select()
        .single();

      if (logError) {
        console.error("Failed to create upload log:", logError);
      } else {
        uploadLogId = logData.id;
      }

      setUploadStatus(`Processing ${jsonData.length} rows...`);

      // Split data into chunks of 1000 rows to avoid timeout
      const BATCH_SIZE = 1000;
      const batches = [];
      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        batches.push(jsonData.slice(i, i + BATCH_SIZE));
      }

      let totalProcessed = 0;

      // Process each batch
      for (let i = 0; i < batches.length; i++) {
        setUploadStatus(`Uploading batch ${i + 1} of ${batches.length}...`);
        
        const { data: result, error } = await supabase.functions.invoke("load-excel-data", {
          body: {
            sheetId: selectedSheet,
            data: batches[i],
          },
        });

        if (error) throw error;

        totalProcessed += result.count;
        const progressPercent = ((i + 1) / batches.length) * 100;
        setProgress(progressPercent);
      }

      setProgress(100);
      setUploadStatus("");

      // Update upload log with success
      if (uploadLogId) {
        await supabase
          .from("upload_logs")
          .update({
            status: "completed",
            records_processed: totalProcessed,
          })
          .eq("id", uploadLogId);
      }

      toast({
        title: "Upload completed successfully! ✓",
        description: `Successfully loaded ${totalProcessed} records`,
      });

      setSelectedFile(null);
      setSelectedSheet("");
      setPendingUploadData(null);
    } catch (error: any) {
      // Update upload log with error
      if (uploadLogId) {
        await supabase
          .from("upload_logs")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("id", uploadLogId);
      }

      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadStatus("");
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setProgress(0);
      }, 2000);
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

          {isLoading && (
            <div className="space-y-3">
              <Progress value={progress} className="w-full" />
              {uploadStatus && (
                <p className="text-sm text-muted-foreground text-center">
                  {uploadStatus}
                </p>
              )}
            </div>
          )}

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

      <AlertDialog open={showExtraColumnsDialog} onOpenChange={setShowExtraColumnsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Extra Columns Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>The Excel file contains columns that are not in the mapping setup:</p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-mono text-sm font-semibold text-foreground">
                  {extraColumns.join(", ")}
                </p>
              </div>
              <p>These columns will be ignored during upload. Do you want to continue?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsLoading(false);
              setPendingUploadData(null);
            }}>
              Cancel Upload
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowExtraColumnsDialog(false);
              if (pendingUploadData) {
                processUpload(pendingUploadData);
              }
            }}>
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LoadData;
