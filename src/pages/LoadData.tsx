import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, AlertCircle, X, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { format } from "date-fns";
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
import { BrandTypeSelectionDialog } from "@/components/BrandTypeSelectionDialog";
import { Badge } from "@/components/ui/badge";

interface ExcelSheet {
  id: string;
  sheet_name: string;
  sheet_code: string;
  target_table: string;
  check_customer: boolean;
  check_brand: boolean;
  check_product: boolean;
  skip_first_row: boolean;
}

interface FileUploadItem {
  id: string;
  file: File;
  sheetId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  summary?: {
    totalRecords: number;
    totalValue: number;
    newCustomers: number;
    newProducts: number;
    newBrands: number;
  };
}

const LoadData = () => {
  const { toast } = useToast();
  const [fileItems, setFileItems] = useState<FileUploadItem[]>([]);
  const [availableSheets, setAvailableSheets] = useState<ExcelSheet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [uploadStatus, setUploadStatus] = useState("");
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [showExtraColumnsDialog, setShowExtraColumnsDialog] = useState(false);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [pendingUploadData, setPendingUploadData] = useState<any>(null);
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [allFilesSummary, setAllFilesSummary] = useState<{
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalRecords: number;
    totalValue: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showBrandTypeDialog, setShowBrandTypeDialog] = useState(false);
  const [newBrandsDetected, setNewBrandsDetected] = useState<{ brand_name: string }[]>([]);
  const [brandTypeSelections, setBrandTypeSelections] = useState<{ brand_name: string; brand_type_id: string }[]>([]);
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Keep session alive during long processing
  const startKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
    }
    keepAliveRef.current = setInterval(() => {
      document.dispatchEvent(new MouseEvent('mousemove'));
    }, 30000);
  };

  const stopKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  };

  useEffect(() => {
    if (!isLoading) {
      setElapsedMs(0);
      return;
    }

    const startedAt = Date.now();
    setElapsedMs(0);
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);

    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    loadAvailableSheets();
  }, []);

  const loadAvailableSheets = async () => {
    const { data, error } = await supabase
      .from("excel_sheets")
      .select("id, sheet_name, sheet_code, target_table, check_customer, check_brand, check_product, skip_first_row")
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
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: crypto.randomUUID(),
        file,
        sheetId: availableSheets.length > 0 ? availableSheets[0].id : "",
        status: 'pending' as const,
        progress: 0,
      }));
      setFileItems(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFileItems(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSheetChange = (fileId: string, sheetId: string) => {
    setFileItems(prev => prev.map(f => 
      f.id === fileId ? { ...f, sheetId } : f
    ));
  };

  const handleBrandTypeConfirm = (selections: { brand_name: string; brand_type_id: string }[]) => {
    setBrandTypeSelections(selections);
    setShowBrandTypeDialog(false);
    
    if (pendingUploadData && pendingFileId) {
      processFileUpload(pendingFileId, pendingUploadData, selections);
    }
  };

  const handleBrandTypeCancel = () => {
    setShowBrandTypeDialog(false);
    setBrandTypeSelections([]);
    setNewBrandsDetected([]);
    setPendingUploadData(null);
    
    if (pendingFileId) {
      setFileItems(prev => prev.map(f => 
        f.id === pendingFileId ? { ...f, status: 'error', error: 'Brand type selection cancelled' } : f
      ));
      setPendingFileId(null);
    }
    
    // Continue with remaining files
    continueProcessingFiles();
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
      const validFiles = Array.from(files).filter(file => 
        file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
      );
      
      if (validFiles.length === 0) {
        toast({
          title: "Invalid file type",
          description: "Please upload Excel files (.xlsx or .xls)",
          variant: "destructive",
        });
        return;
      }
      
      const newFiles = validFiles.map(file => ({
        id: crypto.randomUUID(),
        file,
        sheetId: availableSheets.length > 0 ? availableSheets[0].id : "",
        status: 'pending' as const,
        progress: 0,
      }));
      setFileItems(prev => [...prev, ...newFiles]);
    }
  };

  const handleUploadAll = async () => {
    const pendingFiles = fileItems.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      toast({
        title: "No files to upload",
        description: "Please add Excel files to upload",
        variant: "destructive",
      });
      return;
    }

    const filesWithoutSheet = pendingFiles.filter(f => !f.sheetId);
    if (filesWithoutSheet.length > 0) {
      toast({
        title: "Missing sheet type",
        description: "Please select a sheet type for all files",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    startKeepAlive();
    setCurrentFileIndex(0);

    // Process files one by one
    await processNextFile(0);
  };

  const processNextFile = async (index: number) => {
    const pendingFiles = fileItems.filter(f => f.status === 'pending');
    
    if (index >= pendingFiles.length) {
      finishAllUploads();
      return;
    }

    const fileItem = pendingFiles[index];
    setCurrentFileIndex(index);
    
    await processFileValidation(fileItem);
  };

  const continueProcessingFiles = async () => {
    const pendingFiles = fileItems.filter(f => f.status === 'pending');
    const currentPendingIndex = pendingFiles.findIndex(f => f.status === 'pending');
    
    if (currentPendingIndex >= 0) {
      await processNextFile(0);
    } else {
      finishAllUploads();
    }
  };

  const processFileValidation = async (fileItem: FileUploadItem) => {
    const sheetConfig = availableSheets.find(s => s.id === fileItem.sheetId);
    const shouldSkipFirstRow = sheetConfig?.skip_first_row ?? false;

    setFileItems(prev => prev.map(f => 
      f.id === fileItem.id ? { ...f, status: 'processing', progress: 5 } : f
    ));
    setUploadStatus(`Reading ${fileItem.file.name}...`);

    try {
      const data = await fileItem.file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, shouldSkipFirstRow ? { range: 1 } : {});

      setFileItems(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, progress: 15 } : f
      ));

      if (jsonData.length === 0) {
        setFileItems(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'error', error: 'Empty file' } : f
        ));
        await processNextFile(currentFileIndex + 1);
        return;
      }

      // Validate columns
      const { data: mappings } = await supabase
        .from("excel_column_mappings")
        .select("excel_column")
        .eq("sheet_id", fileItem.sheetId);

      const normalizeCol = (col: string) => col.trim().replace(/\s+/g, ' ').toLowerCase();
      const mappedColumns = mappings?.map(m => m.excel_column.trim()) || [];
      const fileColumns = Object.keys(jsonData[0] as object).map(col => col.trim());
      const normalizedFileColumns = fileColumns.map(normalizeCol);

      const missingColumns = mappedColumns.filter(col => 
        !normalizedFileColumns.includes(normalizeCol(col))
      );
      
      if (missingColumns.length > 0) {
        console.log(`${fileItem.file.name}: Missing columns (will be set to NULL):`, missingColumns);
      }

      const normalizedMappedColumns = mappedColumns.map(normalizeCol);
      const extraCols = fileColumns.filter(col => !normalizedMappedColumns.includes(normalizeCol(col)));
      
      if (extraCols.length > 0) {
        setExtraColumns(extraCols);
        setPendingUploadData(jsonData);
        setPendingFileId(fileItem.id);
        setShowExtraColumnsDialog(true);
        return;
      }

      await processFileUpload(fileItem.id, jsonData);
    } catch (error: any) {
      setFileItems(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'error', error: error.message } : f
      ));
      await processNextFile(currentFileIndex + 1);
    }
  };

  const processFileUpload = async (
    fileId: string, 
    jsonData: any[], 
    brandSelections?: { brand_name: string; brand_type_id: string }[]
  ) => {
    const fileItem = fileItems.find(f => f.id === fileId);
    if (!fileItem) return;

    const sheetConfig = availableSheets.find(s => s.id === fileItem.sheetId);
    const shouldCheckCustomer = sheetConfig?.check_customer ?? true;
    const shouldCheckBrand = sheetConfig?.check_brand ?? true;
    const shouldCheckProduct = sheetConfig?.check_product ?? true;

    let uploadLogId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user?.id)
        .single();

      setUploadStatus(`Processing ${fileItem.file.name}...`);

      // Extract dates
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

      const now = new Date();
      const { data: logData } = await supabase
        .from("upload_logs")
        .insert({
          file_name: fileItem.file.name,
          user_id: user?.id,
          user_name: profile?.user_name || user?.email?.split('@')[0] || "Unknown",
          status: "processing",
          sheet_id: fileItem.sheetId,
          excel_dates: Array.from(distinctDates).sort(),
          records_processed: 0,
          upload_date: now.toISOString(),
        })
        .select()
        .single();

      if (logData) {
        uploadLogId = logData.id;
      }

      setFileItems(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 25 } : f
      ));

      // Check customers if needed
      let newCustomersCount = 0;
      if (shouldCheckCustomer) {
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

        const customerPhones = Array.from(uniqueCustomers.keys());
        if (customerPhones.length > 0) {
          const { data: existingCustomers } = await supabase
            .from("customers")
            .select("customer_phone")
            .in("customer_phone", customerPhones);

          const existingPhones = new Set(existingCustomers?.map(c => c.customer_phone) || []);
          const newCustomers = Array.from(uniqueCustomers.values())
            .filter(c => !existingPhones.has(c.phone))
            .map(c => ({
              customer_phone: c.phone,
              customer_name: c.name,
              creation_date: c.creationDate,
              status: 'active',
            }));

          if (newCustomers.length > 0) {
            await supabase.from("customers").insert(newCustomers);
            newCustomersCount = newCustomers.length;
          }
        }
      }

      setFileItems(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 40 } : f
      ));

      // Batch upload
      const BATCH_SIZE = 1000;
      const batches = [];
      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        batches.push(jsonData.slice(i, i + BATCH_SIZE));
      }

      setTotalBatches(batches.length);
      let totalProcessed = 0;
      let totalValue = 0;
      let totalProductsUpserted = 0;
      let totalBrandsUpserted = 0;
      let allDates: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        setCurrentBatch(i + 1);
        setUploadStatus(`${fileItem.file.name}: Batch ${i + 1}/${batches.length}`);

        const { data: result, error } = await supabase.functions.invoke("load-excel-data", {
          body: {
            sheetId: fileItem.sheetId,
            data: batches[i],
            brandTypeSelections: brandSelections || brandTypeSelections.length > 0 ? (brandSelections || brandTypeSelections) : undefined,
            checkBrand: shouldCheckBrand,
            checkProduct: shouldCheckProduct,
          },
        });

        if (error) throw error;

        if (result.requiresBrandTypeSelection && result.newBrands) {
          setNewBrandsDetected(result.newBrands);
          setPendingUploadData(jsonData);
          setPendingFileId(fileId);
          setShowBrandTypeDialog(true);
          return;
        }

        totalProcessed += result.count;
        setProcessedRows(totalProcessed);
        totalValue += result.totalValue || 0;
        totalProductsUpserted += result.productsUpserted || 0;
        totalBrandsUpserted += result.brandsUpserted || 0;
        
        if (result.dateRange?.from) allDates.push(result.dateRange.from);
        if (result.dateRange?.to) allDates.push(result.dateRange.to);

        const progressPercent = 40 + ((i + 1) / batches.length) * 55;
        setFileItems(prev => prev.map(f => 
          f.id === fileId ? { ...f, progress: progressPercent } : f
        ));
      }

      // Update log
      const sortedDates = allDates.sort();
      if (uploadLogId) {
        await supabase
          .from("upload_logs")
          .update({
            status: "completed",
            records_processed: totalProcessed,
            new_customers_count: newCustomersCount,
            new_products_count: totalProductsUpserted,
            new_brands_count: totalBrandsUpserted,
            total_value: totalValue,
            date_range_start: sortedDates[0] || null,
            date_range_end: sortedDates[sortedDates.length - 1] || null,
          })
          .eq("id", uploadLogId);
      }

      setFileItems(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'completed', 
          progress: 100,
          summary: {
            totalRecords: totalProcessed,
            totalValue,
            newCustomers: newCustomersCount,
            newProducts: totalProductsUpserted,
            newBrands: totalBrandsUpserted,
          }
        } : f
      ));

      // Update bank fees
      try {
        await supabase.functions.invoke('update-bank-fees');
      } catch (e) {
        console.error("Error updating bank fees:", e);
      }

      window.dispatchEvent(new CustomEvent('dataUploaded'));

      // Process next file
      const pendingFiles = fileItems.filter(f => f.status === 'pending');
      const nextIndex = pendingFiles.findIndex(f => f.id !== fileId);
      if (nextIndex >= 0) {
        await processNextFile(0);
      } else {
        finishAllUploads();
      }

    } catch (error: any) {
      if (uploadLogId) {
        await supabase
          .from("upload_logs")
          .update({ status: "failed", error_message: error.message })
          .eq("id", uploadLogId);
      }

      setFileItems(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'error', error: error.message } : f
      ));

      await processNextFile(currentFileIndex + 1);
    }
  };

  const finishAllUploads = () => {
    stopKeepAlive();
    setIsLoading(false);
    setUploadStatus("");
    setCurrentBatch(0);
    setTotalBatches(0);
    setProcessedRows(0);
    setTotalRows(0);
    setCurrentFileIndex(-1);

    const completed = fileItems.filter(f => f.status === 'completed');
    const failed = fileItems.filter(f => f.status === 'error');

    const totalRecords = completed.reduce((sum, f) => sum + (f.summary?.totalRecords || 0), 0);
    const totalValue = completed.reduce((sum, f) => sum + (f.summary?.totalValue || 0), 0);

    setAllFilesSummary({
      totalFiles: completed.length + failed.length,
      successfulFiles: completed.length,
      failedFiles: failed.length,
      totalRecords,
      totalValue,
    });
    setShowSummaryDialog(true);
  };

  const handleClearCompleted = () => {
    setFileItems(prev => prev.filter(f => f.status !== 'completed' && f.status !== 'error'));
  };

  const getSheetName = (sheetId: string) => {
    const sheet = availableSheets.find(s => s.id === sheetId);
    return sheet ? `${sheet.sheet_name} (${sheet.sheet_code})` : '';
  };

  const pendingCount = fileItems.filter(f => f.status === 'pending').length;
  const processingFile = fileItems.find(f => f.status === 'processing');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Load Data From Excel</h1>
        <p className="text-muted-foreground">
          Upload multiple Excel files - each file will be processed separately
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel Files</CardTitle>
          <CardDescription>
            Select multiple Excel files and assign sheet types to each
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center space-y-4 transition-colors ${
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
              <FileSpreadsheet className={`h-12 w-12 transition-colors ${
                isDragging ? 'text-primary' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls) - Multiple files allowed</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
            </div>
          </div>

          {fileItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Files to Upload ({fileItems.length})</Label>
                {fileItems.some(f => f.status === 'completed' || f.status === 'error') && (
                  <Button variant="ghost" size="sm" onClick={handleClearCompleted}>
                    Clear Completed
                  </Button>
                )}
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {fileItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      item.status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                      item.status === 'error' ? 'bg-destructive/10 border-destructive/30' :
                      item.status === 'processing' ? 'bg-primary/10 border-primary/30' :
                      'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {item.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : item.status === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : item.status === 'processing' ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.file.name}</p>
                      {item.status === 'error' && item.error && (
                        <p className="text-xs text-destructive truncate">{item.error}</p>
                      )}
                      {item.status === 'completed' && item.summary && (
                        <p className="text-xs text-green-600">
                          {item.summary.totalRecords.toLocaleString()} records • {item.summary.totalValue.toLocaleString()} value
                        </p>
                      )}
                      {item.status === 'processing' && (
                        <Progress value={item.progress} className="h-1 mt-1" />
                      )}
                    </div>

                    <div className="flex-shrink-0 w-48">
                      <Select 
                        value={item.sheetId} 
                        onValueChange={(v) => handleSheetChange(item.id, v)}
                        disabled={item.status !== 'pending'}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSheets.map((sheet) => (
                            <SelectItem key={sheet.id} value={sheet.id}>
                              {sheet.sheet_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {item.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => handleRemoveFile(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              {uploadStatus && (
                <p className="text-sm text-center">{uploadStatus}</p>
              )}
              {elapsedMs > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Elapsed: {Math.floor(elapsedMs / 60000).toString().padStart(2, '0')}:{Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0')}
                </p>
              )}
              {totalBatches > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Batch {currentBatch} of {totalBatches}
                </p>
              )}
            </div>
          )}

          <Button 
            onClick={handleUploadAll}
            disabled={pendingCount === 0 || isLoading}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isLoading ? "Processing..." : `Upload ${pendingCount} File${pendingCount !== 1 ? 's' : ''}`}
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
              if (pendingFileId) {
                setFileItems(prev => prev.map(f => 
                  f.id === pendingFileId ? { ...f, status: 'error', error: 'Upload cancelled' } : f
                ));
              }
              setPendingUploadData(null);
              setPendingFileId(null);
              continueProcessingFiles();
            }}>
              Skip File
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowExtraColumnsDialog(false);
              if (pendingUploadData && pendingFileId) {
                processFileUpload(pendingFileId, pendingUploadData);
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
            <DialogTitle className="text-2xl font-bold text-center">Upload Complete</DialogTitle>
            <DialogDescription className="text-center">
              All files have been processed
            </DialogDescription>
          </DialogHeader>
          
          {allFilesSummary && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Successful</p>
                  <p className="text-xl font-semibold text-green-600">{allFilesSummary.successfulFiles}</p>
                </div>
                <div className="bg-destructive/10 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Failed</p>
                  <p className="text-xl font-semibold text-destructive">{allFilesSummary.failedFiles}</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Records</p>
                <p className="text-3xl font-bold text-primary">{allFilesSummary.totalRecords.toLocaleString()}</p>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Value</p>
                <p className="text-2xl font-bold text-primary">
                  {allFilesSummary.totalValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
            </div>
          )}

          <Button 
            onClick={() => setShowSummaryDialog(false)}
            className="w-full bg-gradient-to-r from-primary to-accent"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      <BrandTypeSelectionDialog
        open={showBrandTypeDialog}
        newBrands={newBrandsDetected}
        onConfirm={handleBrandTypeConfirm}
        onCancel={handleBrandTypeCancel}
      />
    </div>
  );
};

export default LoadData;
