import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Filter, X, Printer, FileSpreadsheet, ChevronDown, ChevronRight, CreditCard } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdvancedOrderPaymentFilter, FilterCondition } from "@/components/AdvancedOrderPaymentFilter";

interface OrderGridItem {
  order_number: string;
  created_at_date: string | null;
  total: number | null;
  payment_method: string | null;
  payment_type: string | null;
  order_status: string | null;
  is_deleted: boolean;
  payment_reference: string | null;
  card_number: string | null;
  transaction_receipt: string | null;
}

interface OrderDetail {
  order_number: string;
  user_name: string | null;
  trans_type: string | null;
  order_status: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  created_at_date: string | null;
  payment_method: string | null;
  payment_brand: string | null;
}

interface OrderLine {
  brand_code: string | null;
  brand_name: string | null;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  vendor_name: string | null;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  coins_number: number | null;
  cost_price: number | null;
  cost_sold: number | null;
}

interface HyberpayInfo {
  requesttimestamp: string | null;
  accountnumberlast4: string | null;
  returncode: string | null;
  credit: string | null;
  currency: string | null;
  result: string | null;
  statuscode: string | null;
  reasoncode: string | null;
  ip: string | null;
  email: string | null;
  connectorid: string | null;
  response_acquirermessage: string | null;
  riskfraudstatuscode: string | null;
  transaction_receipt: string | null;
  clearinginstitutename: string | null;
  transaction_acquirer_settlementdate: string | null;
  acquirerresponse: string | null;
  riskfrauddescription: string | null;
}

interface RiyadBankInfo {
  txn_date: string | null;
  payment_date: string | null;
  posting_date: string | null;
  card_number: string | null;
  txn_amount: string | null;
  fee: string | null;
  vat: string | null;
  net_amount: string | null;
  auth_code: string | null;
  card_type: string | null;
  txn_number: string | null;
  payment_number: string | null;
  acquirer_private_data: string | null;
  payment_reference: string | null;
}

const OrderPaymentReport = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderGridItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [hyberpayInfo, setHyberpayInfo] = useState<HyberpayInfo | null>(null);
  const [hyberpayExpanded, setHyberpayExpanded] = useState(true);
  const [riyadBankInfo, setRiyadBankInfo] = useState<RiyadBankInfo | null>(null);
  const [riyadBankExpanded, setRiyadBankExpanded] = useState(true);
  const [paymentRefrence, setPaymentRefrence] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [isDeletedFilter, setIsDeletedFilter] = useState("all");
  const [paymentReferenceFilter, setPaymentReferenceFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterCondition[]>([]);
  
  // Unique values for filters
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<string[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<string[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchFilterOptions();
  }, [startDate, endDate]);

  const fetchFilterOptions = async () => {
    try {
      const { data: methods } = await supabase
        .from('purpletransaction')
        .select('payment_method')
        .not('payment_method', 'is', null);
      
      const { data: types } = await supabase
        .from('purpletransaction')
        .select('payment_type')
        .not('payment_type', 'is', null);
      
      const { data: statuses } = await supabase
        .from('purpletransaction')
        .select('order_status')
        .not('order_status', 'is', null);

      if (methods) {
        const uniqueMethods = [...new Set(methods.map(m => m.payment_method).filter(Boolean))].filter(m => m !== 'point');
        setPaymentMethods(uniqueMethods as string[]);
      }
      if (types) {
        const uniqueTypes = [...new Set(types.map(t => t.payment_type).filter(Boolean))];
        setPaymentTypes(uniqueTypes as string[]);
      }
      if (statuses) {
        const uniqueStatuses = [...new Set(statuses.map(s => s.order_status).filter(Boolean))];
        setOrderStatuses(uniqueStatuses as string[]);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Check if we have advanced filters for other tables
      const riyadFilters = advancedFilters.filter(f => f.table === "riyadbankstatement");
      const hyberpayFilters = advancedFilters.filter(f => f.table === "hyberpaystatement");
      const purpleFilters = advancedFilters.filter(f => f.table === "purpletransaction");

      let matchingOrderNumbers: Set<string> | null = null;

      // If we have hyberpay filters, get matching transaction IDs first
      if (hyberpayFilters.length > 0) {
        let hyberpayQuery = supabase.from('hyberpaystatement').select('transactionid');
        
        hyberpayFilters.forEach(filter => {
          hyberpayQuery = applyFilterToQuery(hyberpayQuery, filter);
        });

        const { data: hyberpayData } = await hyberpayQuery;
        const hyberpayTransactionIds = new Set(hyberpayData?.map(h => h.transactionid).filter(Boolean) || []);

        // Get order numbers from order_payment that match these transaction IDs
        if (hyberpayTransactionIds.size > 0) {
          const { data: paymentData } = await supabase
            .from('order_payment')
            .select('ordernumber, paymentrefrence')
            .in('paymentrefrence', Array.from(hyberpayTransactionIds));

          matchingOrderNumbers = new Set(paymentData?.map(p => p.ordernumber) || []);
        } else {
          matchingOrderNumbers = new Set();
        }
      }

      // If we have riyad bank filters, get matching order numbers
      if (riyadFilters.length > 0) {
        let riyadQuery = supabase.from('riyadbankstatement').select('txn_number');
        
        riyadFilters.forEach(filter => {
          riyadQuery = applyFilterToQuery(riyadQuery, filter);
        });

        const { data: riyadData } = await riyadQuery;
        const riyadTxnNumbers = new Set(riyadData?.map(r => r.txn_number).filter(Boolean) || []);

        // Get transaction receipts from hyberpay that match these txn numbers
        if (riyadTxnNumbers.size > 0) {
          const { data: hyberpayReceipts } = await supabase
            .from('hyberpaystatement')
            .select('transactionid, transaction_receipt')
            .in('transaction_receipt', Array.from(riyadTxnNumbers));

          const transactionIds = new Set(hyberpayReceipts?.map(h => h.transactionid).filter(Boolean) || []);

          // Get order numbers from order_payment
          if (transactionIds.size > 0) {
            const { data: paymentData } = await supabase
              .from('order_payment')
              .select('ordernumber')
              .in('paymentrefrence', Array.from(transactionIds));

            const riyadOrderNumbers = new Set(paymentData?.map(p => p.ordernumber) || []);
            
            if (matchingOrderNumbers) {
              // Intersection with existing matches
              matchingOrderNumbers = new Set([...matchingOrderNumbers].filter(x => riyadOrderNumbers.has(x)));
            } else {
              matchingOrderNumbers = riyadOrderNumbers;
            }
          } else {
            matchingOrderNumbers = new Set();
          }
        } else {
          matchingOrderNumbers = new Set();
        }
      }

      // If we have filters and no matching orders, return empty
      if (matchingOrderNumbers !== null && matchingOrderNumbers.size === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch from purpletransaction
      let query = supabase
        .from('purpletransaction')
        .select('order_number, created_at_date, total, payment_method, payment_type, order_status, is_deleted')
        .gte('created_at_date', startDate)
        .lte('created_at_date', endDate)
        .not('order_number', 'is', null)
        .neq('payment_method', 'point');

      // Apply purple transaction advanced filters
      purpleFilters.forEach(filter => {
        query = applyFilterToQuery(query, filter);
      });

      // If we have matching order numbers from other tables, filter by them
      if (matchingOrderNumbers !== null) {
        query = query.in('order_number', Array.from(matchingOrderNumbers));
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Group by order_number
      const orderMap = new Map<string, OrderGridItem>();
      
      transactions?.forEach(t => {
        if (t.order_number && !orderMap.has(t.order_number)) {
          orderMap.set(t.order_number, {
            order_number: t.order_number,
            created_at_date: t.created_at_date,
            total: 0,
            payment_method: t.payment_method,
            payment_type: t.payment_type,
            order_status: t.order_status,
            is_deleted: t.is_deleted,
            payment_reference: null,
            card_number: null,
            transaction_receipt: null
          });
        }
        const existing = orderMap.get(t.order_number!);
        if (existing) {
          existing.total = (existing.total || 0) + (t.total || 0);
        }
      });

      // Get payment references and hyberpay/riyad data
      const orderNumbers = Array.from(orderMap.keys());
      if (orderNumbers.length > 0) {
        const { data: payments } = await supabase
          .from('order_payment')
          .select('ordernumber, paymentrefrence')
          .in('ordernumber', orderNumbers);

        const paymentRefs: string[] = [];
        payments?.forEach(p => {
          const order = orderMap.get(p.ordernumber);
          if (order) {
            order.payment_reference = p.paymentrefrence;
            if (p.paymentrefrence) {
              paymentRefs.push(p.paymentrefrence);
            }
          }
        });

        // Fetch hyberpay data for transaction_receipt
        if (paymentRefs.length > 0) {
          const { data: hyberpayData } = await supabase
            .from('hyberpaystatement')
            .select('transactionid, transaction_receipt')
            .in('transactionid', paymentRefs);

          const hyberpayMap = new Map<string, string>();
          const receiptToTransactionMap = new Map<string, string>();
          hyberpayData?.forEach(h => {
            if (h.transactionid && h.transaction_receipt) {
              hyberpayMap.set(h.transactionid, h.transaction_receipt);
              receiptToTransactionMap.set(h.transaction_receipt, h.transactionid);
            }
          });

          // Update orders with transaction_receipt
          payments?.forEach(p => {
            const order = orderMap.get(p.ordernumber);
            if (order && p.paymentrefrence) {
              order.transaction_receipt = hyberpayMap.get(p.paymentrefrence) || null;
            }
          });

          // Fetch riyad bank data for card_number using transaction_receipt -> txn_number
          const transactionReceipts = Array.from(hyberpayMap.values()).filter(Boolean);
          if (transactionReceipts.length > 0) {
            const { data: riyadData } = await supabase
              .from('riyadbankstatement')
              .select('txn_number, card_number')
              .in('txn_number', transactionReceipts);

            const riyadMap = new Map<string, string>();
            riyadData?.forEach(r => {
              if (r.txn_number && r.card_number) {
                riyadMap.set(r.txn_number, r.card_number);
              }
            });

            // Update orders with card_number
            orderMap.forEach(order => {
              if (order.transaction_receipt) {
                order.card_number = riyadMap.get(order.transaction_receipt) || null;
              }
            });
          }
        }
      }

      let ordersArray = Array.from(orderMap.values());

      // Apply basic filters
      if (orderNumberFilter) {
        ordersArray = ordersArray.filter(o => o.order_number.toLowerCase().includes(orderNumberFilter.toLowerCase()));
      }
      if (paymentMethodFilter !== "all") {
        ordersArray = ordersArray.filter(o => o.payment_method === paymentMethodFilter);
      }
      if (paymentTypeFilter !== "all") {
        ordersArray = ordersArray.filter(o => o.payment_type === paymentTypeFilter);
      }
      if (orderStatusFilter !== "all") {
        ordersArray = ordersArray.filter(o => o.order_status === orderStatusFilter);
      }
      if (isDeletedFilter !== "all") {
        ordersArray = ordersArray.filter(o => 
          isDeletedFilter === "deleted" ? o.is_deleted : !o.is_deleted
        );
      }
      if (paymentReferenceFilter) {
        ordersArray = ordersArray.filter(o => 
          o.payment_reference?.toLowerCase().includes(paymentReferenceFilter.toLowerCase())
        );
      }

      // Sort by date descending
      ordersArray.sort((a, b) => {
        if (!a.created_at_date) return 1;
        if (!b.created_at_date) return -1;
        return b.created_at_date.localeCompare(a.created_at_date);
      });

      setOrders(ordersArray);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(isRTL ? 'خطأ في جلب البيانات' : 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilterToQuery = (query: any, filter: FilterCondition) => {
    const { field, operator, value } = filter;
    
    switch (operator) {
      case "eq":
        return query.eq(field, value);
      case "neq":
        return query.neq(field, value);
      case "gt":
        return query.gt(field, parseFloat(value) || 0);
      case "gte":
        return query.gte(field, parseFloat(value) || 0);
      case "lt":
        return query.lt(field, parseFloat(value) || 0);
      case "lte":
        return query.lte(field, parseFloat(value) || 0);
      case "ilike":
        return query.ilike(field, `%${value}%`);
      case "starts":
        return query.ilike(field, `${value}%`);
      case "ends":
        return query.ilike(field, `%${value}`);
      case "is_null":
        return query.is(field, null);
      case "not_null":
        return query.not(field, 'is', null);
      case "is_true":
        return query.eq(field, true);
      case "is_false":
        return query.eq(field, false);
      default:
        return query;
    }
  };

  const handleOrderClick = async (orderNumber: string) => {
    try {
      // Fetch order header details
      const { data: headerData, error: headerError } = await supabase
        .from('purpletransaction')
        .select('order_number, user_name, trans_type, order_status, customer_phone, customer_name, created_at_date, payment_method, payment_brand')
        .eq('order_number', orderNumber)
        .limit(1)
        .single();

      if (headerError) throw headerError;

      setSelectedOrder(headerData);

      // Fetch order lines with product SKU join
      const { data: linesData, error: linesError } = await supabase
        .from('purpletransaction')
        .select(`
          brand_code, brand_name, product_id, product_name, vendor_name, 
          qty, unit_price, total, coins_number, cost_price, cost_sold
        `)
        .eq('order_number', orderNumber);

      if (linesError) throw linesError;

      // Get product SKUs
      const productIds = linesData?.map(l => l.product_id).filter(Boolean) || [];
      let productSkuMap: Record<string, string> = {};
      
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('product_id, sku')
          .in('product_id', productIds);
        
        products?.forEach(p => {
          if (p.product_id) {
            productSkuMap[p.product_id] = p.sku || '';
          }
        });
      }

      const lines: OrderLine[] = linesData?.map(l => ({
        ...l,
        sku: l.product_id ? productSkuMap[l.product_id] || null : null
      })) || [];

      setOrderLines(lines);

      // Fetch Hyberpay info by joining order_payment.paymentrefrence with hyberpaystatement.transactionid
      const { data: paymentData } = await supabase
        .from('order_payment')
        .select('paymentrefrence')
        .eq('ordernumber', orderNumber)
        .maybeSingle();

      if (paymentData?.paymentrefrence) {
        setPaymentRefrence(paymentData.paymentrefrence);
        const { data: hyberpayData } = await supabase
          .from('hyberpaystatement')
          .select('requesttimestamp, accountnumberlast4, returncode, credit, currency, result, statuscode, reasoncode, ip, email, connectorid, response_acquirermessage, riskfraudstatuscode, transaction_receipt, clearinginstitutename, transaction_acquirer_settlementdate, acquirerresponse, riskfrauddescription')
          .eq('transactionid', paymentData.paymentrefrence)
          .maybeSingle();

        setHyberpayInfo(hyberpayData || null);

        // Fetch Riyad Bank info by joining hyberpaystatement.transaction_receipt with riyadbankstatement.txn_number
        if (hyberpayData) {
          const { data: hyberpayWithReceipt } = await supabase
            .from('hyberpaystatement')
            .select('transaction_receipt')
            .eq('transactionid', paymentData.paymentrefrence)
            .maybeSingle();

          if (hyberpayWithReceipt?.transaction_receipt) {
            const { data: riyadBankData } = await supabase
              .from('riyadbankstatement')
              .select('txn_date, payment_date, posting_date, card_number, txn_amount, fee, vat, net_amount, auth_code, card_type, txn_number, payment_number, acquirer_private_data, payment_reference')
              .eq('txn_number', hyberpayWithReceipt.transaction_receipt)
              .maybeSingle();

            setRiyadBankInfo(riyadBankData || null);
          } else {
            setRiyadBankInfo(null);
          }
        } else {
          setRiyadBankInfo(null);
        }
      } else {
        setPaymentRefrence(null);
        setHyberpayInfo(null);
        setRiyadBankInfo(null);
      }

      setDialogOpen(true);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast.error(isRTL ? 'خطأ في جلب تفاصيل الطلب' : 'Error fetching order details');
    }
  };

  const handleSearch = () => {
    fetchOrders();
  };

  const clearFilters = () => {
    setOrderNumberFilter("");
    setPaymentMethodFilter("all");
    setPaymentTypeFilter("all");
    setOrderStatusFilter("all");
    setIsDeletedFilter("all");
    setPaymentReferenceFilter("");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    // Simple CSV export
    const headers = [
      isRTL ? 'رقم الطلب' : 'Order Number',
      isRTL ? 'التاريخ' : 'Date',
      isRTL ? 'الإجمالي' : 'Total',
      isRTL ? 'طريقة الدفع' : 'Payment Method',
      isRTL ? 'نوع الدفع' : 'Payment Type',
      isRTL ? 'الحالة' : 'Status',
      isRTL ? 'محذوف' : 'Deleted',
      isRTL ? 'مرجع الدفع' : 'Payment Reference',
      isRTL ? 'رقم البطاقة' : 'Card Number',
      isRTL ? 'إيصال المعاملة' : 'Transaction Receipt'
    ];

    const rows = orders.map(o => [
      o.order_number,
      o.created_at_date || '',
      o.total?.toFixed(2) || '0',
      o.payment_method || '',
      o.payment_type || '',
      o.order_status || '',
      o.is_deleted ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No'),
      o.payment_reference || '',
      o.card_number || '',
      o.transaction_receipt || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order_payment_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isRTL ? "تقرير مدفوعات الطلبات" : "Order Payment Report"}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? "عرض وتصفية مدفوعات الطلبات" : "View and filter order payments"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            {isRTL ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {isRTL ? "بحث" : "Search"}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {isRTL ? "فلاتر" : "Filters"}
            </Button>
            <AdvancedOrderPaymentFilter
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              onApply={fetchOrders}
              onClear={() => {
                setAdvancedFilters([]);
                fetchOrders();
              }}
            />
            {showFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                {isRTL ? "مسح الفلاتر" : "Clear Filters"}
              </Button>
            )}
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? "رقم الطلب" : "Order Number"}</Label>
                <Input
                  value={orderNumberFilter}
                  onChange={(e) => setOrderNumberFilter(e.target.value)}
                  placeholder={isRTL ? "بحث..." : "Search..."}
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "طريقة الدفع" : "Payment Method"}</Label>
                <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                    {paymentMethods.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "نوع الدفع" : "Payment Type"}</Label>
                <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                    {paymentTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "حالة الطلب" : "Order Status"}</Label>
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                    {orderStatuses.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الحذف" : "Deleted"}</Label>
                <Select value={isDeletedFilter} onValueChange={setIsDeletedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="active">{isRTL ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="deleted">{isRTL ? "محذوف" : "Deleted"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "مرجع الدفع" : "Payment Reference"}</Label>
                <Input
                  value={paymentReferenceFilter}
                  onChange={(e) => setPaymentReferenceFilter(e.target.value)}
                  placeholder={isRTL ? "بحث..." : "Search..."}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Grid */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isRTL ? `الطلبات (${orders.length})` : `Orders (${orders.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "رقم الطلب" : "Order Number"}</TableHead>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "الإجمالي" : "Total"}</TableHead>
                  <TableHead>{isRTL ? "طريقة الدفع" : "Payment Method"}</TableHead>
                  <TableHead>{isRTL ? "نوع الدفع" : "Payment Type"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "محذوف" : "Deleted"}</TableHead>
                  <TableHead>{isRTL ? "مرجع الدفع" : "Payment Ref"}</TableHead>
                  <TableHead>{isRTL ? "رقم البطاقة" : "Card Number"}</TableHead>
                  <TableHead>{isRTL ? "إيصال المعاملة" : "Transaction Receipt"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      {isRTL ? "لا توجد بيانات" : "No data found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow 
                      key={order.order_number}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOrderClick(order.order_number)}
                    >
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.created_at_date || '-'}</TableCell>
                      <TableCell>{order.total?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{order.payment_method || '-'}</TableCell>
                      <TableCell>{order.payment_type || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={order.order_status === 'Complete' ? 'default' : 'secondary'}>
                          {order.order_status || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.is_deleted ? 'destructive' : 'outline'}>
                          {order.is_deleted ? (isRTL ? 'نعم' : 'Yes') : (isRTL ? 'لا' : 'No')}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.payment_reference || '-'}</TableCell>
                      <TableCell>{order.card_number || '-'}</TableCell>
                      <TableCell>{order.transaction_receipt || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[90vw] max-h-[90vh] overflow-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {isRTL ? "تفاصيل الطلب" : "Order Details"}: {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Header Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isRTL ? "معلومات الطلب" : "Order Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "رقم الطلب" : "Order Number"}
                      </Label>
                      <p className="font-medium">{selectedOrder.order_number}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "المستخدم" : "User Name"}
                      </Label>
                      <p className="font-medium">{selectedOrder.user_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "نوع المعاملة" : "Trans Type"}
                      </Label>
                      <p className="font-medium">{selectedOrder.trans_type || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "حالة الطلب" : "Order Status"}
                      </Label>
                      <Badge variant="default">{selectedOrder.order_status || '-'}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "هاتف العميل" : "Customer Phone"}
                      </Label>
                      <p className="font-medium">{selectedOrder.customer_phone || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "اسم العميل" : "Customer Name"}
                      </Label>
                      <p className="font-medium">{selectedOrder.customer_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "التاريخ" : "Date"}
                      </Label>
                      <p className="font-medium">{selectedOrder.created_at_date || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "طريقة الدفع" : "Payment Method"}
                      </Label>
                      <p className="font-medium">{selectedOrder.payment_method || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "علامة الدفع" : "Payment Brand"}
                      </Label>
                      <p className="font-medium">{selectedOrder.payment_brand || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "مرجع الدفع" : "Payment Ref"}
                      </Label>
                      <p className="font-medium break-all">{paymentRefrence || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hyberpay Information - Collapsible */}
              <Card>
                <Collapsible open={hyberpayExpanded} onOpenChange={setHyberpayExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {hyberpayExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <CreditCard className="h-5 w-5" />
                        {isRTL ? "معلومات Hyberpay" : "Hyberpay Information"}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {hyberpayInfo ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "وقت الطلب" : "Request Timestamp"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.requesttimestamp || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "آخر 4 أرقام البطاقة" : "Card Last 4 Digits"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.accountnumberlast4 || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "كود الإرجاع" : "Return Code"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.returncode || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "المبلغ" : "Payment"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.credit || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "العملة" : "Currency"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.currency || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "النتيجة" : "Result"}
                            </Label>
                            <Badge variant={hyberpayInfo.result === 'ACK' ? 'default' : 'secondary'}>
                              {hyberpayInfo.result || '-'}
                            </Badge>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "كود الحالة" : "Status Code"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.statuscode || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "كود السبب" : "Reason Code"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.reasoncode || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "عنوان IP" : "IP"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.ip || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "البريد الإلكتروني" : "Email"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.email || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "معرف الموصل" : "Connector ID"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.connectorid || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "رسالة المستحوذ" : "Acquirer Message"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.response_acquirermessage || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "حالة مخاطر الاحتيال" : "Risk Fraud Status Code"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.riskfraudstatuscode || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "إيصال المعاملة" : "Transaction Receipt"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.transaction_receipt || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "اسم مؤسسة المقاصة" : "Clearing Institute Name"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.clearinginstitutename || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "تاريخ تسوية المستحوذ" : "Acquirer Settlement Date"}
                            </Label>
                            <p className="font-medium">{hyberpayInfo.transaction_acquirer_settlementdate || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "استجابة المستحوذ" : "Acquirer Response"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.acquirerresponse || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "وصف مخاطر الاحتيال" : "Risk Fraud Description"}
                            </Label>
                            <p className="font-medium break-all">{hyberpayInfo.riskfrauddescription || '-'}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          {isRTL ? "لا توجد بيانات Hyberpay لهذا الطلب" : "No Hyberpay data available for this order"}
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Riyad Bank Information */}
              <Card>
                <Collapsible open={riyadBankExpanded} onOpenChange={setRiyadBankExpanded}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {riyadBankExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <CreditCard className="h-5 w-5" />
                        {isRTL ? "معلومات بنك الرياض" : "Riyad Bank Information"}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {riyadBankInfo ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "تاريخ العملية" : "Txn. Date"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.txn_date || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "تاريخ الدفع" : "Payment Date"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.payment_date || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "تاريخ الترحيل" : "Posting Date"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.posting_date || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "رقم البطاقة" : "Card Number"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.card_number || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "مبلغ العملية" : "Txn. Amount"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.txn_amount || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "الرسوم" : "Fee"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.fee || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "ضريبة القيمة المضافة" : "VAT"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.vat || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "المبلغ الصافي" : "Net Amount"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.net_amount || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "كود التفويض" : "Auth Code"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.auth_code || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "نوع البطاقة" : "Card Type"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.card_type || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "رقم العملية" : "Txn. Number"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.txn_number || '-'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">
                              {isRTL ? "رقم الدفع" : "Payment Number"}
                            </Label>
                            <p className="font-medium">{riyadBankInfo.payment_number || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "بيانات المستحوذ الخاصة" : "Acquirer Private Data"}
                            </Label>
                            <p className="font-medium break-all">{riyadBankInfo.acquirer_private_data || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <Label className="text-muted-foreground">
                              {isRTL ? "مرجع الدفع" : "Payment Reference"}
                            </Label>
                            <p className="font-medium break-all">{riyadBankInfo.payment_reference || '-'}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-4">
                          {isRTL ? "لا توجد بيانات بنك الرياض لهذا الطلب" : "No Riyad Bank data available for this order"}
                        </p>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Order Lines */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isRTL ? "بنود الطلب" : "Order Lines"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? "كود البراند" : "Brand Code"}</TableHead>
                          <TableHead>{isRTL ? "اسم البراند" : "Brand Name"}</TableHead>
                          <TableHead>{isRTL ? "معرف المنتج" : "Product ID"}</TableHead>
                          <TableHead>{isRTL ? "SKU" : "SKU"}</TableHead>
                          <TableHead>{isRTL ? "البائع" : "Vendor"}</TableHead>
                          <TableHead>{isRTL ? "الكمية" : "Qty"}</TableHead>
                          <TableHead>{isRTL ? "سعر الوحدة" : "Unit Price"}</TableHead>
                          <TableHead>{isRTL ? "الإجمالي" : "Total"}</TableHead>
                          <TableHead>{isRTL ? "العملات" : "Coins"}</TableHead>
                          <TableHead>{isRTL ? "التكلفة" : "Cost"}</TableHead>
                          <TableHead>{isRTL ? "التكلفة المباعة" : "Cost Sold"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderLines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-4">
                              {isRTL ? "لا توجد بنود" : "No lines found"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          orderLines.map((line, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{line.brand_code || '-'}</TableCell>
                              <TableCell>{line.brand_name || '-'}</TableCell>
                              <TableCell>{line.product_id || '-'}</TableCell>
                              <TableCell>{line.sku || '-'}</TableCell>
                              <TableCell>{line.vendor_name || '-'}</TableCell>
                              <TableCell>{line.qty || 0}</TableCell>
                              <TableCell>{line.unit_price?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>{line.total?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>{line.coins_number || 0}</TableCell>
                              <TableCell>{line.cost_price?.toFixed(2) || '0.00'}</TableCell>
                              <TableCell>{line.cost_sold?.toFixed(2) || '0.00'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderPaymentReport;
