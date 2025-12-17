import React, { useState, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Download, Loader2, FileSpreadsheet, Trash2, ChevronLeft, ChevronRight, Crop, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PdfToExcel = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Area selection state
  const [selectionArea, setSelectionArea] = useState<SelectionArea | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [applyToAllPages, setApplyToAllPages] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderPdf = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setTotalPages(pdf.numPages);
      
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) { // Render up to 10 pages
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context!,
          viewport: viewport,
        }).promise;
        
        pages.push(canvas.toDataURL('image/png'));
      }
      setPdfPages(pages);
      setCurrentPage(0);
      setSelectionArea(null);
    } catch (error) {
      console.error('Error rendering PDF:', error);
    }
  };

  const isArabic = language === 'ar';

  const translations = {
    title: isArabic ? 'تحويل PDF إلى Excel' : 'PDF to Excel Converter',
    subtitle: isArabic ? 'استخدم الذكاء الاصطناعي لتحويل ملفات PDF إلى جداول Excel' : 'Use AI to convert PDF files to Excel spreadsheets',
    selectFile: isArabic ? 'اختر ملف PDF' : 'Select PDF File',
    uploadFile: isArabic ? 'رفع الملف' : 'Upload File',
    processing: isArabic ? 'جاري المعالجة...' : 'Processing...',
    convert: isArabic ? 'تحويل إلى Excel' : 'Convert to Excel',
    download: isArabic ? 'تحميل Excel' : 'Download Excel',
    noFile: isArabic ? 'الرجاء اختيار ملف PDF' : 'Please select a PDF file',
    success: isArabic ? 'تم التحويل بنجاح' : 'Conversion successful',
    error: isArabic ? 'حدث خطأ أثناء التحويل' : 'Error during conversion',
    preview: isArabic ? 'معاينة البيانات' : 'Data Preview',
    clear: isArabic ? 'مسح' : 'Clear',
    dragDrop: isArabic ? 'اسحب وأفلت ملف PDF هنا أو انقر للاختيار' : 'Drag and drop PDF file here or click to select',
    selectedFile: isArabic ? 'الملف المختار' : 'Selected File',
    aiProcessing: isArabic ? 'الذكاء الاصطناعي يعالج الملف...' : 'AI is processing the file...',
    pdfPreview: isArabic ? 'معاينة الملف' : 'PDF Preview',
    uploadToPreview: isArabic ? 'قم برفع ملف PDF لعرض المعاينة' : 'Upload a PDF file to preview',
    selectArea: isArabic ? 'تحديد المنطقة' : 'Select Area',
    clearSelection: isArabic ? 'مسح التحديد' : 'Clear Selection',
    applyToAllPages: isArabic ? 'تطبيق على جميع الصفحات' : 'Apply to all pages',
    dragToSelect: isArabic ? 'اسحب لتحديد المنطقة المراد تحويلها' : 'Drag to select the area to convert',
    areaSelected: isArabic ? 'تم تحديد المنطقة' : 'Area selected',
    noSelection: isArabic ? 'الرجاء تحديد منطقة للتحويل' : 'Please select an area to convert',
  };

  const MAX_FILE_SIZE_MB = 2;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: isArabic ? 'خطأ' : 'Error',
          description: isArabic ? 'الرجاء اختيار ملف PDF فقط' : 'Please select a PDF file only',
          variant: 'destructive',
        });
        return;
      }
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        toast({
          title: isArabic ? 'خطأ' : 'Error',
          description: isArabic 
            ? `حجم الملف كبير جداً (${fileSizeMB.toFixed(1)} ميجابايت). الحد الأقصى هو ${MAX_FILE_SIZE_MB} ميجابايت.` 
            : `File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setFileName(file.name.replace('.pdf', ''));
      setExtractedData(null);
      setSelectionArea(null);
      setSelectionMode(false);
      renderPdf(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: isArabic ? 'خطأ' : 'Error',
          description: isArabic ? 'الرجاء اختيار ملف PDF فقط' : 'Please select a PDF file only',
          variant: 'destructive',
        });
        return;
      }
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        toast({
          title: isArabic ? 'خطأ' : 'Error',
          description: isArabic 
            ? `حجم الملف كبير جداً (${fileSizeMB.toFixed(1)} ميجابايت). الحد الأقصى هو ${MAX_FILE_SIZE_MB} ميجابايت.` 
            : `File is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      setFileName(file.name.replace('.pdf', ''));
      setExtractedData(null);
      setSelectionArea(null);
      setSelectionMode(false);
      renderPdf(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Area selection handlers
  const getRelativeCoordinates = useCallback((e: React.MouseEvent) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectionMode) return;
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    setSelectionStart(coords);
    setIsSelecting(true);
    setSelectionArea({ x: coords.x, y: coords.y, width: 0, height: 0 });
  }, [selectionMode, getRelativeCoordinates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionMode) return;
    e.preventDefault();
    const coords = getRelativeCoordinates(e);
    const x = Math.min(selectionStart.x, coords.x);
    const y = Math.min(selectionStart.y, coords.y);
    const width = Math.abs(coords.x - selectionStart.x);
    const height = Math.abs(coords.y - selectionStart.y);
    setSelectionArea({ x, y, width, height });
  }, [isSelecting, selectionMode, selectionStart, getRelativeCoordinates]);

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selectionArea && selectionArea.width > 2 && selectionArea.height > 2) {
      setSelectionMode(false);
      toast({
        title: translations.areaSelected,
        description: isArabic 
          ? `تم تحديد المنطقة. ${totalPages > 1 ? (applyToAllPages ? 'سيتم التطبيق على جميع الصفحات.' : 'سيتم التطبيق على الصفحة الحالية فقط.') : ''}`
          : `Area selected. ${totalPages > 1 ? (applyToAllPages ? 'Will apply to all pages.' : 'Will apply to current page only.') : ''}`,
      });
    }
    setIsSelecting(false);
  }, [isSelecting, selectionArea, applyToAllPages, totalPages, isArabic, translations.areaSelected, toast]);

  const clearSelection = () => {
    setSelectionArea(null);
    setSelectionMode(false);
  };

  const handleConvert = async () => {
    if (!selectedFile) {
      toast({
        title: isArabic ? 'خطأ' : 'Error',
        description: translations.noFile,
        variant: 'destructive',
      });
      return;
    }

    if (!selectionArea || selectionArea.width < 2 || selectionArea.height < 2) {
      toast({
        title: isArabic ? 'خطأ' : 'Error',
        description: translations.noSelection,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Convert file to base64
      const base64Data = await convertToBase64(selectedFile);

      // Call edge function using fetch with extended timeout
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-to-excel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: selectedFile.name,
            selectionArea: selectionArea,
            applyToAllPages: totalPages > 1 ? applyToAllPages : true,
            currentPage: currentPage + 1,
            totalPages: totalPages,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();

      if (data?.tableData && data.tableData.length > 0) {
        setExtractedData(data.tableData);
        toast({
          title: isArabic ? 'نجاح' : 'Success',
          description: translations.success,
        });
      } else {
        throw new Error(isArabic ? 'لم يتم العثور على بيانات في الملف' : 'No data found in the file');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        title: isArabic ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : translations.error,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!extractedData) return;

    const ws = XLSX.utils.aoa_to_sheet(extractedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${fileName || 'converted'}.xlsx`);

    toast({
      title: isArabic ? 'نجاح' : 'Success',
      description: isArabic ? 'تم تحميل الملف بنجاح' : 'File downloaded successfully',
    });
  };

  const handleClear = () => {
    setSelectedFile(null);
    setExtractedData(null);
    setFileName('');
    setPdfPages([]);
    setCurrentPage(0);
    setTotalPages(0);
    setSelectionArea(null);
    setSelectionMode(false);
  };

  return (
    <div className={`container mx-auto p-6 ${isArabic ? 'rtl' : 'ltr'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{translations.title}</h1>
        <p className="text-muted-foreground mt-1">{translations.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              {translations.uploadFile}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('pdf-input')?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{translations.dragDrop}</p>
              <Input
                id="pdf-input"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                <Button variant="ghost" size="icon" onClick={handleClear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleConvert}
                disabled={!selectedFile || isProcessing || !selectionArea}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {translations.aiProcessing}
                  </>
                ) : (
                  translations.convert
                )}
              </Button>

              {extractedData && (
                <Button onClick={handleDownload} variant="secondary">
                  <Download className="h-4 w-4 mr-2" />
                  {translations.download}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{extractedData ? translations.preview : translations.pdfPreview}</CardTitle>
              {pdfPages.length > 0 && !extractedData && (
                <div className="flex items-center gap-2">
                  {selectionArea && (
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      <X className="h-4 w-4 mr-1" />
                      {translations.clearSelection}
                    </Button>
                  )}
                  <Button 
                    variant={selectionMode ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setSelectionMode(!selectionMode)}
                  >
                    <Crop className="h-4 w-4 mr-1" />
                    {translations.selectArea}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {extractedData ? (
              <div className="overflow-auto max-h-[500px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {extractedData[0]?.map((header: string, index: number) => (
                        <th key={index} className="px-3 py-2 text-start font-medium border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.slice(1).map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-muted/50">
                        {row.map((cell: string, cellIndex: number) => (
                          <td key={cellIndex} className="px-3 py-2 border-b">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : pdfPages.length > 0 ? (
              <div className="space-y-3">
                {selectionMode && (
                  <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-sm text-center">
                    {translations.dragToSelect}
                  </div>
                )}
                
                <div className="border rounded-lg overflow-hidden">
                  <div 
                    ref={containerRef}
                    className={`relative bg-muted/30 ${selectionMode ? 'cursor-crosshair' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <img 
                      ref={imageRef}
                      src={pdfPages[currentPage]} 
                      alt={`Page ${currentPage + 1}`}
                      className="w-full h-auto max-h-[500px] object-contain mx-auto select-none"
                      draggable={false}
                    />
                    {/* Selection overlay */}
                    {selectionArea && (
                      <div
                        className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
                        style={{
                          left: `${selectionArea.x}%`,
                          top: `${selectionArea.y}%`,
                          width: `${selectionArea.width}%`,
                          height: `${selectionArea.height}%`,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 border-t bg-muted">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {currentPage + 1} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentPage(p => Math.min(pdfPages.length - 1, p + 1))}
                        disabled={currentPage >= pdfPages.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">{selectedFile?.name}</span>
                  </div>
                </div>

                {/* Apply to all pages option */}
                {totalPages > 1 && selectionArea && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Checkbox
                      id="applyToAll"
                      checked={applyToAllPages}
                      onCheckedChange={(checked) => setApplyToAllPages(checked === true)}
                    />
                    <Label htmlFor="applyToAll" className="text-sm cursor-pointer">
                      {translations.applyToAllPages} ({totalPages} {isArabic ? 'صفحات' : 'pages'})
                    </Label>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {translations.uploadToPreview}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PdfToExcel;
