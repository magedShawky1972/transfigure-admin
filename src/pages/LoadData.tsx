import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertCircle, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExcelSheet {
  id: string;
  sheet_name: string;
  sheet_code: string;
  target_table: string;
}

const LoadData = () => {
  const { t } = useLanguage();
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
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    totalRecords: number;
    totalValue: number;
    dateRange: { from: string; to: string };
    newCustomers: number;
    newProducts: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check if file is Excel format
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
      }
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

      // Extract unique customers from the data
      const uniqueCustomers = new Map();
      jsonData.forEach((row: any) => {
        if (row.customer_phone && row.customer_name) {
          if (!uniqueCustomers.has(row.customer_phone)) {
            uniqueCustomers.set(row.customer_phone, {
              phone: row.customer_phone,
              name: row.customer_name,
              creationDate: row.created_at_date || new Date()
            });
          }
        }
      });

      // Check which customers already exist
      const customerPhones = Array.from(uniqueCustomers.keys());
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("customer_phone")
        .in("customer_phone", customerPhones);

      const existingPhones = new Set(existingCustomers?.map(c => c.customer_phone) || []);
      
      // Create new customers
      const newCustomers = Array.from(uniqueCustomers.values())
        .filter(c => !existingPhones.has(c.phone))
        .map(c => ({
          customer_phone: c.phone,
          customer_name: c.name,
          creation_date: c.creationDate,
          status: 'active',
        }));

      let newCustomersCount = 0;
      if (newCustomers.length > 0) {
        const { error: customerError } = await supabase
          .from("customers")
          .insert(newCustomers);

        if (customerError) {
          console.error("Error creating customers:", customerError);
        } else {
          newCustomersCount = newCustomers.length;
        }
      }

      // After upload completes, sync ALL customers from purpletransaction table
      setUploadStatus("Syncing customers from transaction history...");
      
      // Get all unique customers from purpletransaction table
      const { data: allTransactions } = await supabase
        .from("purpletransaction")
        .select("customer_phone, customer_name, created_at_date")
        .not("customer_phone", "is", null)
        .not("customer_name", "is", null);

      if (allTransactions && allTransactions.length > 0) {
        // Group by phone to get earliest transaction date per customer
        const transactionCustomers = new Map();
        allTransactions.forEach((txn: any) => {
          if (!transactionCustomers.has(txn.customer_phone)) {
            transactionCustomers.set(txn.customer_phone, {
              phone: txn.customer_phone,
              name: txn.customer_name,
              creationDate: txn.created_at_date
            });
          } else {
            // Keep the earliest date
            const existing = transactionCustomers.get(txn.customer_phone);
            if (txn.created_at_date && (!existing.creationDate || new Date(txn.created_at_date) < new Date(existing.creationDate))) {
              existing.creationDate = txn.created_at_date;
            }
          }
        });

        // Get all existing customers
        const { data: allExistingCustomers } = await supabase
          .from("customers")
          .select("customer_phone");

        const allExistingPhones = new Set(allExistingCustomers?.map(c => c.customer_phone) || []);

        // Find customers that exist in transactions but not in customers table
        const missingCustomers = Array.from(transactionCustomers.values())
          .filter(c => !allExistingPhones.has(c.phone))
          .map(c => ({
            customer_phone: c.phone,
            customer_name: c.name,
            creation_date: c.creationDate || new Date(),
            status: 'active',
          }));

        if (missingCustomers.length > 0) {
          const { error: syncError } = await supabase
            .from("customers")
            .insert(missingCustomers);

          if (syncError) {
            console.error("Error syncing missing customers:", syncError);
          } else {
            console.log(`Synced ${missingCustomers.length} missing customers from transaction history (not counted in new customers for this upload)`);
          }
        }
      }

      // Split data into chunks of 1000 rows to avoid timeout
      const BATCH_SIZE = 1000;
      const batches = [];
      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        batches.push(jsonData.slice(i, i + BATCH_SIZE));
      }

      let totalProcessed = 0;
      let totalValue = 0;
      let totalProductsUpserted = 0;
      let allDates: string[] = [];

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
        totalValue += result.totalValue || 0;
        totalProductsUpserted += result.productsUpserted || 0;
        
        if (result.dateRange?.from) allDates.push(result.dateRange.from);
        if (result.dateRange?.to) allDates.push(result.dateRange.to);
        
        const progressPercent = ((i + 1) / batches.length) * 100;
        setProgress(progressPercent);
      }

      setProgress(100);
      setUploadStatus("");

      // Sort dates and get min/max
      const sortedDates = allDates.sort();
      const dateRange = {
        from: sortedDates[0] || '',
        to: sortedDates[sortedDates.length - 1] || ''
      };

      // Update upload log with success
      if (uploadLogId) {
        await supabase
          .from("upload_logs")
          .update({
            status: "completed",
            records_processed: totalProcessed,
            new_customers_count: newCustomersCount,
            new_products_count: totalProductsUpserted,
            total_value: totalValue,
            date_range_start: sortedDates[0] || null,
            date_range_end: sortedDates[sortedDates.length - 1] || null,
          })
          .eq("id", uploadLogId);
      }

      // Show summary dialog
      setUploadSummary({
        totalRecords: totalProcessed,
        totalValue,
        dateRange,
        newCustomers: newCustomersCount,
        newProducts: totalProductsUpserted
      });
      setShowSummaryDialog(true);

      setSelectedFile(null);
      setSelectedSheet("");
      setPendingUploadData(null);

      // Trigger a custom event to notify other components to refresh
      window.dispatchEvent(new CustomEvent('dataUploaded'));
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

          <div 
            className={`border-2 border-dashed rounded-lg p-12 text-center space-y-4 transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex justify-center">
              <FileSpreadsheet className={`h-16 w-16 transition-colors ${
                isDragging ? 'text-primary' : 'text-muted-foreground'
              }`} />
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

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("loadData.uploadSummary")}</DialogTitle>
            <DialogDescription>
              {t("loadData.successMessage")}
            </DialogDescription>
          </DialogHeader>
          
          {uploadSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("uploadLog.recordsProcessed")}</p>
                  <p className="text-2xl font-bold">{uploadSummary.totalRecords.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("loadData.totalValue")}</p>
                  <p className="text-2xl font-bold">{uploadSummary.totalValue.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("loadData.newCustomers")}</p>
                  <p className="text-2xl font-bold text-green-600">{uploadSummary.newCustomers}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("loadData.newProducts")}</p>
                  <p className="text-2xl font-bold text-blue-600">{uploadSummary.newProducts}</p>
                </div>
              </div>
              {uploadSummary.dateRange.from && uploadSummary.dateRange.to && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">{t("loadData.dateRange")}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-mono text-sm">
                        {format(new Date(uploadSummary.dateRange.from), "MMM dd, yyyy")}
                      </span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-mono text-sm">
                        {format(new Date(uploadSummary.dateRange.to), "MMM dd, yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button 
            onClick={() => setShowSummaryDialog(false)}
            className="w-full"
          >
            {t("loadData.close")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoadData;
