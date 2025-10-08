import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { useSearchParams } from "react-router-dom";

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  customer_phone: string;
  brand_name: string;
  product_name: string;
  total: string;
  profit: string;
  payment_method: string;
  payment_type: string;
  payment_brand: string;
  order_number: string;
  user_name: string;
  cost_price: string;
  unit_price: string;
  cost_sold: string;
  qty: string;
  coins_number: string;
}

const Transactions = () => {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);

  const parseNumber = (value?: string | null) => {
    if (value == null) return 0;
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (amount: number) => {
    if (!isFinite(amount)) amount = 0;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ر.س`;
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const fromDateParam = searchParams.get('from');
      const toDateParam = searchParams.get('to');

      let query = supabase
        .from('purpletransaction')
        .select('*')
        .order('created_at_date', { ascending: false });

      if (fromDateParam && toDateParam) {
        const fromDate = new Date(fromDateParam);
        const toDate = new Date(toDateParam);
        const startStr = format(startOfDay(fromDate), "yyyy-MM-dd'T'00:00:00");
        const endStr = format(endOfDay(toDate), "yyyy-MM-dd'T'23:59:59");
        query = query.gte('created_at_date', startStr).lte('created_at_date', endStr);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) {
        setTransactions(data);
        
        // Extract unique values for filters
        const uniqueBrands = [...new Set(data.map(t => t.brand_name).filter(Boolean))];
        const uniqueProducts = [...new Set(data.map(t => t.product_name).filter(Boolean))];
        const uniquePaymentMethods = [...new Set(data.map(t => t.payment_method).filter(Boolean))];
        const uniqueCustomers = [...new Set(data.map(t => t.customer_name).filter(Boolean))];
        
        setBrands(uniqueBrands as string[]);
        setProducts(uniqueProducts as string[]);
        setPaymentMethods(uniquePaymentMethods as string[]);
        setCustomers(uniqueCustomers as string[]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = searchTerm === "" || 
      transaction.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.order_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBrand = filterBrand === "all" || transaction.brand_name === filterBrand;
    const matchesProduct = filterProduct === "all" || transaction.product_name === filterProduct;
    const matchesPaymentMethod = filterPaymentMethod === "all" || transaction.payment_method === filterPaymentMethod;
    const matchesCustomer = filterCustomer === "all" || transaction.customer_name === filterCustomer;

    return matchesSearch && matchesBrand && matchesProduct && matchesPaymentMethod && matchesCustomer;
  });

  const exportToCSV = () => {
    const headers = [
      t("dashboard.date"),
      t("dashboard.customer"),
      t("transactions.customerPhone"),
      t("dashboard.brand"),
      t("dashboard.product"),
      t("transactions.orderNumber"),
      t("transactions.userName"),
      t("dashboard.amount"),
      t("dashboard.profit"),
      t("transactions.paymentMethod"),
      t("transactions.paymentType"),
      t("dashboard.paymentBrands"),
      t("transactions.qty"),
      t("transactions.costPrice"),
      t("transactions.unitPrice"),
      t("transactions.costSold"),
      t("transactions.coinsNumber")
    ];

    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => [
        t.created_at_date ? format(new Date(t.created_at_date), 'yyyy-MM-dd') : '',
        t.customer_name || '',
        t.customer_phone || '',
        t.brand_name || '',
        t.product_name || '',
        t.order_number || '',
        t.user_name || '',
        t.total || '',
        t.profit || '',
        t.payment_method || '',
        t.payment_type || '',
        t.payment_brand || '',
        t.qty || '',
        t.cost_price || '',
        t.unit_price || '',
        t.cost_sold || '',
        t.coins_number || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("transactions.title")}</h1>
        <p className="text-muted-foreground">
          {t("transactions.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("transactions.title")}</CardTitle>
            <Button variant="outline" className="gap-2" onClick={exportToCSV}>
              <Download className="h-4 w-4" />
              {t("transactions.export")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t("transactions.search")}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterBrand")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allBrands")}</SelectItem>
                {brands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allProducts")}</SelectItem>
                {products.map(product => (
                  <SelectItem key={product} value={product}>{product}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("transactions.paymentMethod")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'جميع طرق الدفع' : 'All Methods'}</SelectItem>
                {paymentMethods.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterCustomer")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allCustomers")}</SelectItem>
                {customers.map(customer => (
                  <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">
                {t("dashboard.loading")}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {t("dashboard.noData")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dashboard.date")}</TableHead>
                    <TableHead>{t("dashboard.customer")}</TableHead>
                    <TableHead>{t("transactions.customerPhone")}</TableHead>
                    <TableHead>{t("dashboard.brand")}</TableHead>
                    <TableHead>{t("dashboard.product")}</TableHead>
                    <TableHead>{t("transactions.orderNumber")}</TableHead>
                    <TableHead>{t("transactions.userName")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.amount")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.profit")}</TableHead>
                    <TableHead>{t("transactions.paymentMethod")}</TableHead>
                    <TableHead>{t("transactions.paymentType")}</TableHead>
                    <TableHead>{t("dashboard.paymentBrands")}</TableHead>
                    <TableHead className="text-right">{t("transactions.qty")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {transaction.created_at_date ? format(new Date(transaction.created_at_date), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>{transaction.customer_name || 'N/A'}</TableCell>
                      <TableCell>{transaction.customer_phone || 'N/A'}</TableCell>
                      <TableCell>{transaction.brand_name || 'N/A'}</TableCell>
                      <TableCell>{transaction.product_name || 'N/A'}</TableCell>
                      <TableCell>{transaction.order_number || 'N/A'}</TableCell>
                      <TableCell>{transaction.user_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(parseNumber(transaction.total))}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(parseNumber(transaction.profit))}</TableCell>
                      <TableCell>{transaction.payment_method || 'N/A'}</TableCell>
                      <TableCell>{transaction.payment_type || 'N/A'}</TableCell>
                      <TableCell>{transaction.payment_brand || 'N/A'}</TableCell>
                      <TableCell className="text-right">{transaction.qty || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.transactions")}</CardTitle>
            <CardTitle className="text-3xl">{filteredTransactions.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalSales")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(filteredTransactions.reduce((sum, t) => sum + parseNumber(t.total), 0))}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalProfit")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(filteredTransactions.reduce((sum, t) => sum + parseNumber(t.profit), 0))}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
