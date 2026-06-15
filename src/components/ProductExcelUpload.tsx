import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductExcelUploadProps {
  onUploadComplete: () => void;
}

export const ProductExcelUpload = ({ onUploadComplete }: ProductExcelUploadProps) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    updated: number;
    notFound: number;
    errors: number;
  } | null>(null);
  const [updatedExcelData, setUpdatedExcelData] = useState<any[][] | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setOriginalFileName(e.target.files[0].name);
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
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setOriginalFileName(file.name);
      } else {
        toast({
          title: isAr ? "نوع ملف غير صالح" : "Invalid file type",
          description: isAr ? "يرجى رفع ملف Excel (.xlsx أو .xls)" : "Please upload an Excel file (.xlsx or .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const columnMapping: Record<string, string> = {
    'product name': 'product_name',
    'productname': 'product_name',
    'sku': 'sku',
    'product id': 'product_id',
    'productid': 'product_id',
    'product price': 'product_price',
    'productprice': 'product_price',
    'price': 'product_price',
    'product cost': 'product_cost',
    'productcost': 'product_cost',
    'cost': 'product_cost',
    'brand name': 'brand_name',
    'brandname': 'brand_name',
    'brand': 'brand_name',
    'description': 'description',
    'category': 'category',
    'stock quantity': 'stock_quantity',
    'stockquantity': 'stock_quantity',
    'stock': 'stock_quantity',
    'barcode': 'barcode',
    'supplier': 'supplier',
    'notes': 'notes',
    'status': 'status',
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: isAr ? "لم يتم اختيار ملف" : "No file selected",
        description: isAr ? "يرجى اختيار ملف Excel للرفع" : "Please select an Excel file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast({
          title: isAr ? "ملف غير صالح" : "Invalid file",
          description: isAr ? "يجب أن يحتوي ملف Excel على صف رؤوس وصف بيانات واحد على الأقل" : "Excel file must have at least a header row and one data row",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
      
      if (!headers[0] || !headers[0].includes('product') || !headers[0].includes('name')) {
        toast({
          title: isAr ? "تنسيق غير صالح" : "Invalid format",
          description: isAr ? "يجب أن يكون العمود الأول 'اسم المنتج'" : "First column must be 'Product Name'",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      let updated = 0;
      let notFound = 0;
      let errors = 0;

      const updatedData = [...jsonData];
      updatedData[0] = [...updatedData[0], isAr ? 'الحالة' : 'Status'];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const productName = row[0];
        
        if (!productName) {
          updatedData[i] = [...row, isAr ? 'تم التخطي (اسم فارغ)' : 'Skipped (empty name)'];
          continue;
        }

        const updateData: Record<string, any> = {};
        
        for (let j = 1; j < headers.length; j++) {
          const excelHeader = headers[j];
          const dbColumn = columnMapping[excelHeader];
          
          if (dbColumn && row[j] !== undefined && row[j] !== null && row[j] !== '') {
            updateData[dbColumn] = row[j];
          }
        }

        if (Object.keys(updateData).length === 0) {
          updatedData[i] = [...row, isAr ? 'تم التخطي (لا توجد بيانات)' : 'Skipped (no data)'];
          continue;
        }

        updateData.updated_at = new Date().toISOString();

        const { data: existingProduct, error: fetchError } = await supabase
          .from('products')
          .select('id')
          .ilike('product_name', productName)
          .single();

        if (fetchError || !existingProduct) {
          notFound++;
          updatedData[i] = [...row, isAr ? 'غير موجود' : 'Not Found'];
          continue;
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', existingProduct.id);

        if (updateError) {
          console.error('Update error:', updateError);
          errors++;
          updatedData[i] = [...row, isAr ? 'خطأ' : 'Error'];
        } else {
          updated++;
          updatedData[i] = [...row, isAr ? 'تم التحديث' : 'Updated'];
        }
      }

      setUpdatedExcelData(updatedData);
      setUploadSummary({ updated, notFound, errors });
      setShowSummaryDialog(true);
      setSelectedFile(null);
      
      toast({
        title: isAr ? "اكتمل الرفع" : "Upload complete",
        description: isAr ? `تم تحديث ${updated} منتج(ات)` : `Updated ${updated} product(s)`,
      });

      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: isAr ? "فشل الرفع" : "Upload failed",
        description: error instanceof Error ? error.message : (isAr ? "حدث خطأ أثناء الرفع" : "An error occurred during upload"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadUpdatedExcel = () => {
    if (!updatedExcelData) return;

    const worksheet = XLSX.utils.aoa_to_sheet(updatedExcelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    
    const fileName = originalFileName.replace(/\.(xlsx|xls)$/i, '_with_status.xlsx');
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <>
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <div className="text-sm text-muted-foreground mb-2">
            {isAr ? "اسحب وأفلت ملف Excel هنا، أو انقر للتصفح" : "Drag & drop your Excel file here, or click to browse"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button 
            variant="outline" 
            type="button" 
            className="mt-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isAr ? "اختيار ملف" : "Select File"}
          </Button>
          {selectedFile && (
            <div className="mt-4 text-sm">
              {isAr ? "المختار:" : "Selected:"} <span className="font-medium">{selectedFile.name}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">{isAr ? "التعليمات:" : "Instructions:"}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>{isAr ? 'يجب أن يكون العمود الأول "اسم المنتج" (معيار المطابقة)' : 'First column must be "Product Name" (matching criteria)'}</li>
            <li>{isAr ? "ستحدث الأعمدة التالية حقول المنتج المقابلة" : "Subsequent columns will update corresponding product fields"}</li>
            <li>{isAr ? "الأعمدة المدعومة: SKU، معرف المنتج، السعر، التكلفة، اسم الماركة، الوصف، الفئة، المخزون، الباركود، المورد، الملاحظات، الحالة" : "Supported columns: SKU, Product ID, Price, Cost, Brand Name, Description, Category, Stock, Barcode, Supplier, Notes, Status"}</li>
          </ul>
        </div>

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isLoading}
          className="w-full"
        >
          {isLoading ? (isAr ? "جاري الرفع..." : "Uploading...") : (isAr ? "رفع وتحديث المنتجات" : "Upload and Update Products")}
        </Button>
      </div>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isAr ? "ملخص الرفع" : "Upload Summary"}</DialogTitle>
            <DialogDescription>
              {isAr ? "نتائج عملية تحديث المنتج" : "Results of the product update operation"}
            </DialogDescription>
          </DialogHeader>
          {uploadSummary && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>{isAr ? "المنتجات المحدثة:" : "Products Updated:"}</span>
                  <span className="font-bold text-green-600">{uploadSummary.updated}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "المنتجات غير موجودة:" : "Products Not Found:"}</span>
                  <span className="font-bold text-yellow-600">{uploadSummary.notFound}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "الأخطاء:" : "Errors:"}</span>
                  <span className="font-bold text-red-600">{uploadSummary.errors}</span>
                </div>
              </div>
              {updatedExcelData && (
                <Button onClick={downloadUpdatedExcel} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  {isAr ? "تنزيل Excel مع الحالة" : "Download Excel with Status"}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
