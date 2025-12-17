import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileUp, Download, Loader2, FileSpreadsheet, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const PdfToExcel = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
  };

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
      // Revoke previous URL if exists
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setSelectedFile(file);
      setFileName(file.name.replace('.pdf', ''));
      setExtractedData(null);
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
      // Revoke previous URL if exists
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setSelectedFile(file);
      setFileName(file.name.replace('.pdf', ''));
      setExtractedData(null);
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

  const handleConvert = async () => {
    if (!selectedFile) {
      toast({
        title: isArabic ? 'خطأ' : 'Error',
        description: translations.noFile,
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
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setSelectedFile(null);
    setExtractedData(null);
    setFileName('');
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
                disabled={!selectedFile || isProcessing}
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
            <CardTitle>{extractedData ? translations.preview : translations.pdfPreview}</CardTitle>
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
            ) : pdfUrl ? (
              <div className="border rounded-lg overflow-hidden">
                <object data={pdfUrl} type="application/pdf" className="w-full h-[500px]">
                  <embed src={pdfUrl} type="application/pdf" className="w-full h-[500px]" />
                </object>
                <div className="flex items-center justify-between gap-2 p-2 border-t bg-muted">
                  <span className="text-xs text-muted-foreground truncate">{selectedFile?.name}</span>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    {isArabic ? 'فتح في نافذة جديدة' : 'Open in new tab'}
                  </a>
                </div>
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
