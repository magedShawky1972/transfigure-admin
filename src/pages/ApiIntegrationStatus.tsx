import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Database, TestTube, Factory, Loader2, Trash2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface ApiTable {
  name: string;
  displayName: string;
  displayNameAr: string;
  testTable: string;
  productionTable: string;
  endpoint: string;
}

interface TableCount {
  table: string;
  count: number;
}

const API_TABLES: ApiTable[] = [
  {
    name: "salesheader",
    displayName: "Sales Order Header",
    displayNameAr: "رأس أمر المبيعات",
    testTable: "testsalesheader",
    productionTable: "sales_order_header",
    endpoint: "/api-salesheader",
  },
  {
    name: "salesline",
    displayName: "Sales Order Line",
    displayNameAr: "سطر أمر المبيعات",
    testTable: "testsalesline",
    productionTable: "sales_order_line",
    endpoint: "/api-salesline",
  },
  {
    name: "payment",
    displayName: "Payment",
    displayNameAr: "المدفوعات",
    testTable: "testpayment",
    productionTable: "payment_transactions",
    endpoint: "/api-payment",
  },
  {
    name: "customer",
    displayName: "Customers",
    displayNameAr: "العملاء",
    testTable: "testcustomers",
    productionTable: "customers",
    endpoint: "/api-customer",
  },
  {
    name: "supplier",
    displayName: "Suppliers",
    displayNameAr: "الموردين",
    testTable: "testsuppliers",
    productionTable: "suppliers",
    endpoint: "/api-supplier",
  },
  {
    name: "supplierproduct",
    displayName: "Supplier Products",
    displayNameAr: "منتجات الموردين",
    testTable: "testsupplierproducts",
    productionTable: "supplier_products",
    endpoint: "/api-supplierproduct",
  },
  {
    name: "brand",
    displayName: "Brand (Product Category)",
    displayNameAr: "العلامة التجارية (فئة المنتج)",
    testTable: "testbrands",
    productionTable: "brands",
    endpoint: "/api-brand",
  },
  {
    name: "product",
    displayName: "Product",
    displayNameAr: "المنتج",
    testTable: "testproducts",
    productionTable: "products",
    endpoint: "/api-product",
  },
];

const ApiIntegrationStatus = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingTable, setViewingTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loadingTableData, setLoadingTableData] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearingTable, setClearingTable] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    fetchTableCounts();
  }, []);

  const fetchTableCounts = async () => {
    setRefreshing(true);
    try {
      const counts: Record<string, number> = {};
      
      for (const table of API_TABLES) {
        // Fetch test table count
        const { count: testCount } = await supabase
          .from(table.testTable as any)
          .select('*', { count: 'exact', head: true });
        counts[table.testTable] = testCount || 0;
      }
      
      setTableCounts(counts);
    } catch (error) {
      console.error('Error fetching table counts:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في جلب أعداد الجداول' : 'Failed to fetch table counts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleViewTable = async (tableName: string) => {
    setViewingTable(tableName);
    setViewDialogOpen(true);
    setLoadingTableData(true);
    
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setTableData(data || []);
    } catch (error) {
      console.error('Error fetching table data:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في جلب بيانات الجدول' : 'Failed to fetch table data',
        variant: 'destructive',
      });
    } finally {
      setLoadingTableData(false);
    }
  };

  const handleClearTable = async () => {
    if (!clearingTable) return;
    
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from(clearingTable as any)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      
      if (error) throw error;
      
      toast({
        title: language === 'ar' ? 'تم بنجاح' : 'Success',
        description: language === 'ar' ? 'تم مسح بيانات الجدول' : 'Table data cleared successfully',
      });
      
      fetchTableCounts();
    } catch (error) {
      console.error('Error clearing table:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في مسح بيانات الجدول' : 'Failed to clear table data',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
      setClearDialogOpen(false);
      setClearingTable(null);
    }
  };

  const getTableColumns = (data: any[]) => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'حالة تكامل API' : 'API Integration Status'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'مراقبة وإدارة جداول تكامل API'
              : 'Monitor and manage API integration tables'}
          </p>
        </div>
        <Button onClick={fetchTableCounts} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {language === 'ar' ? 'تحديث' : 'Refresh'}
        </Button>
      </div>

      {/* Mode Indicator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5 text-yellow-500" />
            {language === 'ar' ? 'الوضع الحالي: وضع الاختبار' : 'Current Mode: Test Mode'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'جميع واجهات API تقوم حالياً بحفظ البيانات في جداول الاختبار. يمكن التبديل إلى وضع الإنتاج لاحقاً.'
              : 'All APIs are currently saving data to test tables. You can switch to production mode later.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <TestTube className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="font-medium">
                {language === 'ar' ? 'وضع الاختبار نشط' : 'Test Mode Active'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' 
                  ? 'البيانات المستلمة من API تُحفظ في جداول الاختبار للمراجعة قبل الانتقال للإنتاج'
                  : 'Data received from APIs is saved to test tables for review before moving to production'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Tables Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {language === 'ar' ? 'حالة جداول API' : 'API Tables Status'}
          </CardTitle>
          <CardDescription>
            {language === 'ar' 
              ? 'عرض عدد السجلات في كل جدول اختبار'
              : 'View record count in each test table'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === 'ar' ? 'اسم API' : 'API Name'}</TableHead>
                <TableHead>{language === 'ar' ? 'نقطة النهاية' : 'Endpoint'}</TableHead>
                <TableHead>{language === 'ar' ? 'جدول الاختبار' : 'Test Table'}</TableHead>
                <TableHead>{language === 'ar' ? 'جدول الإنتاج' : 'Production Table'}</TableHead>
                <TableHead>{language === 'ar' ? 'عدد السجلات (اختبار)' : 'Records (Test)'}</TableHead>
                <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {API_TABLES.map((table) => (
                <TableRow key={table.name}>
                  <TableCell className="font-medium">
                    {language === 'ar' ? table.displayNameAr : table.displayName}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {table.endpoint}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                      {table.testTable}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                      {table.productionTable}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tableCounts[table.testTable] > 0 ? "default" : "secondary"}>
                      {tableCounts[table.testTable] || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                      <TestTube className="h-3 w-3 mr-1" />
                      {language === 'ar' ? 'اختبار' : 'Test'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewTable(table.testTable)}
                        disabled={tableCounts[table.testTable] === 0}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'عرض' : 'View'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setClearingTable(table.testTable);
                          setClearDialogOpen(true);
                        }}
                        disabled={tableCounts[table.testTable] === 0}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'مسح' : 'Clear'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Data Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? `بيانات جدول ${viewingTable}` : `Table Data: ${viewingTable}`}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? 'عرض أحدث 100 سجل من الجدول'
                : 'Showing latest 100 records from the table'}
            </DialogDescription>
          </DialogHeader>
          
          {loadingTableData ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tableData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {language === 'ar' ? 'لا توجد بيانات' : 'No data found'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {getTableColumns(tableData).map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row, idx) => (
                    <TableRow key={idx}>
                      {getTableColumns(tableData).map((col) => (
                        <TableCell key={col} className="whitespace-nowrap max-w-xs truncate">
                          {row[col]?.toString() || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد مسح البيانات' : 'Confirm Clear Data'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من مسح جميع البيانات من جدول ${clearingTable}؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to clear all data from ${clearingTable}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearTable}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {language === 'ar' ? 'مسح' : 'Clear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApiIntegrationStatus;
