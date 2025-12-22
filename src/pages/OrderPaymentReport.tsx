import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Filter, X, Printer, FileSpreadsheet, ChevronDown, ChevronRight, CreditCard, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SortDirection = "asc" | "desc" | null;
type SortConfig = {
  column: keyof OrderGridItem | null;
  direction: SortDirection;
};

type ColumnFilters = {
  [K in keyof OrderGridItem]?: string;
};
import { format } from "date-fns";
import { AdvancedOrderPaymentFilter, FilterCondition } from "@/components/AdvancedOrderPaymentFilter";

interface OrderGridItem {
  transactionid: string;
  order_number: string | null;
  request_timestamp: string | null;
  created_at_date: string | null;
  total: number | null;
  payment_method: string | null;
  payment_type: string | null;
  order_status: string | null;
  is_deleted: boolean;
  payment_reference: string | null;
  card_number: string | null;
  transaction_receipt: string | null;
  credit: string | null;
  result: string | null;
  statuscode: string | null;
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
  const [dataSourceFilter, setDataSourceFilter] = useState<"all" | "hyberpay" | "riyadbank" | "purpletransaction">("all");
  
  // Column filters and sorting
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  
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
      // Check if we have advanced filters for tables
      const riyadFilters = advancedFilters.filter(f => f.table === "riyadbankstatement");
      const hyberpayFilters = advancedFilters.filter(f => f.table === "hyberpaystatement");
      const purpleFilters = advancedFilters.filter(f => f.table === "purpletransaction");

      const orderMap = new Map<string, OrderGridItem>();

      // Fetch based on data source filter
      if (dataSourceFilter === "all" || dataSourceFilter === "hyberpay") {
        // Start from hyberpaystatement
        let hyberpayQuery = supabase
          .from('hyberpaystatement')
          .select('transactionid, requesttimestamp, transaction_receipt, credit, result, statuscode, paymenttype')
          .gte('requesttimestamp', `${startDate}T00:00:00`)
          .lte('requesttimestamp', `${endDate}T23:59:59`);

        // Apply hyberpay advanced filters
        hyberpayFilters.forEach(filter => {
          hyberpayQuery = applyFilterToQuery(hyberpayQuery, filter);
        });

        const { data: hyberpayData, error: hyberpayError } = await hyberpayQuery;

        if (hyberpayError) throw hyberpayError;

        if (hyberpayData && hyberpayData.length > 0) {
          const transactionIds = hyberpayData.map(h => h.transactionid).filter(Boolean);

          hyberpayData.forEach(h => {
            if (h.transactionid) {
              orderMap.set(h.transactionid, {
                transactionid: h.transactionid,
                order_number: null,
                request_timestamp: h.requesttimestamp,
                created_at_date: null,
                total: null,
                payment_method: null,
                payment_type: h.paymenttype,
                order_status: null,
                is_deleted: false,
                payment_reference: h.transactionid,
                card_number: null,
                transaction_receipt: h.transaction_receipt,
                credit: h.credit,
                result: h.result,
                statuscode: h.statuscode
              });
            }
          });

          // LEFT JOIN: Get order_payment data to link transactionid to order_number
          if (transactionIds.length > 0 && (dataSourceFilter === "all" || dataSourceFilter === "hyberpay")) {
            const { data: paymentData } = await supabase
              .from('order_payment')
              .select('ordernumber, paymentrefrence')
              .in('paymentrefrence', transactionIds);

            paymentData?.forEach(p => {
              const order = orderMap.get(p.paymentrefrence || '');
              if (order) {
                order.order_number = p.ordernumber;
              }
            });

            // Get order numbers that have payment data
            const orderNumbers = paymentData?.map(p => p.ordernumber).filter(Boolean) || [];

            // LEFT JOIN: Get purpletransaction data (if not filtering by hyberpay only)
            if (orderNumbers.length > 0 && dataSourceFilter === "all") {
              let purpleQuery = supabase
                .from('purpletransaction')
                .select('order_number, created_at_date, total, payment_method, order_status, is_deleted')
                .in('order_number', orderNumbers)
                .neq('payment_method', 'point');

              // Apply purple filters
              purpleFilters.forEach(filter => {
                purpleQuery = applyFilterToQuery(purpleQuery, filter);
              });

              const { data: purpleData } = await purpleQuery;

              // Group purple data by order_number
              const purpleMap = new Map<string, { total: number; created_at_date: string | null; payment_method: string | null; order_status: string | null; is_deleted: boolean }>();
              
              purpleData?.forEach(p => {
                if (p.order_number) {
                  const existing = purpleMap.get(p.order_number);
                  if (existing) {
                    existing.total += (p.total || 0);
                  } else {
                    purpleMap.set(p.order_number, {
                      total: p.total || 0,
                      created_at_date: p.created_at_date,
                      payment_method: p.payment_method,
                      order_status: p.order_status,
                      is_deleted: p.is_deleted
                    });
                  }
                }
              });

              // Update order map with purple data
              orderMap.forEach(order => {
                if (order.order_number) {
                  const purpleInfo = purpleMap.get(order.order_number);
                  if (purpleInfo) {
                    order.total = purpleInfo.total;
                    order.created_at_date = purpleInfo.created_at_date;
                    order.payment_method = purpleInfo.payment_method;
                    order.order_status = purpleInfo.order_status;
                    order.is_deleted = purpleInfo.is_deleted;
                  }
                }
              });

              // Apply purple filters to remove non-matching entries if filters exist
              if (purpleFilters.length > 0) {
                const matchingOrderNumbers = new Set(purpleData?.map(p => p.order_number).filter(Boolean) || []);
                orderMap.forEach((order, key) => {
                  if (order.order_number && !matchingOrderNumbers.has(order.order_number)) {
                    orderMap.delete(key);
                  }
                });
              }
            }

            // LEFT JOIN: Get riyadbankstatement data (if not filtering by hyberpay only)
            if (dataSourceFilter === "all") {
              const transactionReceipts = Array.from(orderMap.values())
                .map(o => o.transaction_receipt)
                .filter(Boolean) as string[];

              if (transactionReceipts.length > 0) {
                let riyadQuery = supabase
                  .from('riyadbankstatement')
                  .select('txn_number, card_number')
                  .in('txn_number', transactionReceipts);

                // Apply riyad filters
                riyadFilters.forEach(filter => {
                  riyadQuery = applyFilterToQuery(riyadQuery, filter);
                });

                const { data: riyadData } = await riyadQuery;

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

                // Apply riyad filters to remove non-matching entries if filters exist
                if (riyadFilters.length > 0) {
                  const matchingReceipts = new Set(riyadData?.map(r => r.txn_number).filter(Boolean) || []);
                  orderMap.forEach((order, key) => {
                    if (order.transaction_receipt && !matchingReceipts.has(order.transaction_receipt)) {
                      orderMap.delete(key);
                    }
                  });
                }
              }
            }
          }
        }
      }

      // Fetch from riyadbankstatement only
      if (dataSourceFilter === "riyadbank") {
        // Convert YYYY-MM-DD to DD/MM/YYYY for comparison
        const startDateParts = startDate.split('-');
        const endDateParts = endDate.split('-');
        const startDateFormatted = `${startDateParts[2]}/${startDateParts[1]}/${startDateParts[0]}`;
        const endDateFormatted = `${endDateParts[2]}/${endDateParts[1]}/${endDateParts[0]}`;

        let riyadQuery = supabase
          .from('riyadbankstatement')
          .select('txn_number, txn_date, card_number, txn_amount, card_type, auth_code, payment_reference');

        // Apply riyad filters
        riyadFilters.forEach(filter => {
          riyadQuery = applyFilterToQuery(riyadQuery, filter);
        });

        const { data: riyadData, error: riyadError } = await riyadQuery;

        if (riyadError) throw riyadError;

        // Filter by date client-side since txn_date format is DD/MM/YYYY HH:mm:ss
        const filteredRiyadData = riyadData?.filter(r => {
          if (!r.txn_date) return false;
          // Extract date part (DD/MM/YYYY) from txn_date
          const datePart = r.txn_date.split(' ')[0];
          const [day, month, year] = datePart.split('/');
          const txnDateObj = new Date(`${year}-${month}-${day}`);
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);
          return txnDateObj >= startDateObj && txnDateObj <= endDateObj;
        }) || [];

        filteredRiyadData.forEach(r => {
          if (r.txn_number) {
            orderMap.set(r.txn_number, {
              transactionid: r.txn_number,
              order_number: null,
              request_timestamp: r.txn_date,
              created_at_date: r.txn_date,
              total: parseFloat(r.txn_amount || '0'),
              payment_method: r.card_type,
              payment_type: 'RiyadBank',
              order_status: null,
              is_deleted: false,
              payment_reference: r.payment_reference,
              card_number: r.card_number,
              transaction_receipt: r.txn_number,
              credit: r.txn_amount,
              result: 'ACK',
              statuscode: r.auth_code
            });
          }
        });
      }

      // Fetch from purpletransaction only
      if (dataSourceFilter === "purpletransaction") {
        let purpleQuery = supabase
          .from('purpletransaction')
          .select('order_number, created_at_date, total, payment_method, payment_type, order_status, is_deleted, payment_brand')
          .gte('created_at_date', startDate)
          .lte('created_at_date', endDate)
          .neq('payment_method', 'point');

        // Apply purple filters
        purpleFilters.forEach(filter => {
          purpleQuery = applyFilterToQuery(purpleQuery, filter);
        });

        const { data: purpleData, error: purpleError } = await purpleQuery;

        if (purpleError) throw purpleError;

        // Group by order_number
        const purpleGrouped = new Map<string, { total: number; item: typeof purpleData[0] }>();
        
        purpleData?.forEach(p => {
          if (p.order_number) {
            const existing = purpleGrouped.get(p.order_number);
            if (existing) {
              existing.total += (p.total || 0);
            } else {
              purpleGrouped.set(p.order_number, {
                total: p.total || 0,
                item: p
              });
            }
          }
        });

        purpleGrouped.forEach((value, orderNum) => {
          const p = value.item;
          orderMap.set(orderNum, {
            transactionid: orderNum,
            order_number: p.order_number,
            request_timestamp: p.created_at_date,
            created_at_date: p.created_at_date,
            total: value.total,
            payment_method: p.payment_method,
            payment_type: p.payment_type,
            order_status: p.order_status,
            is_deleted: p.is_deleted,
            payment_reference: null,
            card_number: null,
            transaction_receipt: null,
            credit: value.total?.toString(),
            result: p.order_status === 'Complete' ? 'ACK' : 'NOK',
            statuscode: p.order_status
          });
        });
      }

      let ordersArray = Array.from(orderMap.values());

      // Apply basic filters
      if (orderNumberFilter) {
        ordersArray = ordersArray.filter(o => o.order_number?.toLowerCase().includes(orderNumberFilter.toLowerCase()));
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

      // Initial sort by request_timestamp descending (will be overridden by sortConfig if set)
      ordersArray.sort((a, b) => {
        if (!a.request_timestamp) return 1;
        if (!b.request_timestamp) return -1;
        return b.request_timestamp.localeCompare(a.request_timestamp);
      });

      setOrders(ordersArray);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(isRTL ? 'خطأ في جلب البيانات' : 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  // Handle column filter change
  const handleColumnFilterChange = (column: keyof OrderGridItem, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  // Handle sort
  const handleSort = (column: keyof OrderGridItem) => {
    setSortConfig(prev => {
      if (prev.column === column) {
        if (prev.direction === "asc") {
          return { column, direction: "desc" };
        } else if (prev.direction === "desc") {
          return { column: null, direction: null };
        }
      }
      return { column, direction: "asc" };
    });
  };

  // Get sort icon
  const getSortIcon = (column: keyof OrderGridItem) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="h-3 w-3 ml-1 text-primary" />;
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  // Filtered and sorted orders
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];

    // Apply column filters
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue && filterValue.trim()) {
        result = result.filter(order => {
          const cellValue = order[column as keyof OrderGridItem];
          if (cellValue === null || cellValue === undefined) {
            return false;
          }
          return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig.column && sortConfig.direction) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.column!];
        const bValue = b[sortConfig.column!];

        if (aValue === null || aValue === undefined) return sortConfig.direction === "asc" ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === "asc" ? -1 : 1;

        // Handle numeric values
        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        // Handle boolean values
        if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          return sortConfig.direction === "asc" 
            ? (aValue === bValue ? 0 : aValue ? 1 : -1)
            : (aValue === bValue ? 0 : aValue ? -1 : 1);
        }

        // Handle string values
        const aStr = String(aValue);
        const bStr = String(bValue);
        return sortConfig.direction === "asc" 
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [orders, columnFilters, sortConfig]);

  // Clear column filters
  const clearColumnFilters = () => {
    setColumnFilters({});
    setSortConfig({ column: null, direction: null });
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

  const handleOrderClick = async (orderNumber: string, transactionId?: string) => {
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

      // Use transactionId directly if available, otherwise lookup from order_payment
      let paymentRef = transactionId || null;
      
      if (!paymentRef) {
        const { data: paymentData } = await supabase
          .from('order_payment')
          .select('paymentrefrence')
          .eq('ordernumber', orderNumber)
          .maybeSingle();
        paymentRef = paymentData?.paymentrefrence || null;
      }

      if (paymentRef) {
        setPaymentRefrence(paymentRef);
        const { data: hyberpayDataArr } = await supabase
          .from('hyberpaystatement')
          .select('requesttimestamp, accountnumberlast4, returncode, credit, currency, result, statuscode, reasoncode, ip, email, connectorid, response_acquirermessage, riskfraudstatuscode, transaction_receipt, clearinginstitutename, transaction_acquirer_settlementdate, acquirerresponse, riskfrauddescription')
          .eq('transactionid', paymentRef)
          .limit(1);

        const hyberpayData = hyberpayDataArr?.[0] || null;
        setHyberpayInfo(hyberpayData);

        // Fetch Riyad Bank info using transaction_receipt from hyberpayData (join: riyadbankstatement.txn_number = hyberpaystatement.transaction_receipt)
        if (hyberpayData?.transaction_receipt) {
          const { data: riyadBankDataArr } = await supabase
            .from('riyadbankstatement')
            .select('txn_date, payment_date, posting_date, card_number, txn_amount, fee, vat, net_amount, auth_code, card_type, txn_number, payment_number, acquirer_private_data, payment_reference')
            .eq('txn_number', hyberpayData.transaction_receipt)
            .limit(1);

          setRiyadBankInfo(riyadBankDataArr?.[0] || null);
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

  // Handle NOK (rejected) transaction click - fetch Hyberpay details directly by transactionid
  const handleNokTransactionClick = async (transactionId: string) => {
    try {
      // Clear order-specific data since NOK transactions don't have orders
      setSelectedOrder(null);
      setOrderLines([]);
      setPaymentRefrence(transactionId);
      setRiyadBankInfo(null);

      // Fetch Hyberpay info directly by transactionid
      const { data: hyberpayDataArr } = await supabase
        .from('hyberpaystatement')
        .select('requesttimestamp, accountnumberlast4, returncode, credit, currency, result, statuscode, reasoncode, ip, email, connectorid, response_acquirermessage, riskfraudstatuscode, transaction_receipt, clearinginstitutename, transaction_acquirer_settlementdate, acquirerresponse, riskfrauddescription')
        .eq('transactionid', transactionId)
        .limit(1);

      setHyberpayInfo(hyberpayDataArr?.[0] || null);

      setDialogOpen(true);
    } catch (error) {
      console.error('Error fetching NOK transaction details:', error);
      toast.error(isRTL ? 'خطأ في جلب تفاصيل المعاملة' : 'Error fetching transaction details');
    }
  };

  // Combined click handler for rows
  const handleRowClick = (order: OrderGridItem) => {
    if (order.order_number) {
      // Has order number - pass transactionid for direct Hyberpay lookup
      handleOrderClick(order.order_number, order.transactionid);
    } else if (order.result === 'NOK' && order.transactionid) {
      // NOK transaction without order - show Hyberpay details
      handleNokTransactionClick(order.transactionid);
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
      isRTL ? 'معرف المعاملة' : 'Transaction ID',
      isRTL ? 'رقم الطلب' : 'Order Number',
      isRTL ? 'وقت الطلب' : 'Request Time',
      isRTL ? 'المبلغ' : 'Credit',
      isRTL ? 'النتيجة' : 'Result',
      isRTL ? 'كود الحالة' : 'Status Code',
      isRTL ? 'الإجمالي' : 'Total',
      isRTL ? 'طريقة الدفع' : 'Payment Method',
      isRTL ? 'حالة الطلب' : 'Order Status',
      isRTL ? 'رقم البطاقة' : 'Card Number',
      isRTL ? 'إيصال المعاملة' : 'Transaction Receipt'
    ];

    const rows = orders.map(o => [
      o.transactionid || '',
      o.order_number || '',
      o.request_timestamp ? new Date(o.request_timestamp).toLocaleString() : '',
      o.credit || '',
      o.result || '',
      o.statuscode || '',
      o.total?.toFixed(2) || '',
      o.payment_method || '',
      o.order_status || '',
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
              <Label>{isRTL ? "مصدر البيانات" : "Data Source"}</Label>
              <Select value={dataSourceFilter} onValueChange={(value: "all" | "hyberpay" | "riyadbank" | "purpletransaction") => setDataSourceFilter(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "جميع الجداول" : "All Tables"}</SelectItem>
                  <SelectItem value="hyberpay">{isRTL ? "هايبرباي فقط" : "Hyberpay Only"}</SelectItem>
                  <SelectItem value="riyadbank">{isRTL ? "بنك الرياض فقط" : "Riyad Bank Only"}</SelectItem>
                  <SelectItem value="purpletransaction">{isRTL ? "المعاملات فقط" : "Transactions Only"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {isRTL ? `الطلبات (${filteredAndSortedOrders.length})` : `Orders (${filteredAndSortedOrders.length})`}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={showColumnFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowColumnFilters(!showColumnFilters)}
            >
              <Filter className="h-4 w-4 mr-1" />
              {isRTL ? "فلترة الأعمدة" : "Column Filters"}
            </Button>
            {(Object.keys(columnFilters).some(k => columnFilters[k as keyof OrderGridItem]) || sortConfig.column) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearColumnFilters}
              >
                <X className="h-4 w-4 mr-1" />
                {isRTL ? "مسح" : "Clear"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("transactionid")}
                    >
                      {isRTL ? "معرف المعاملة" : "Transaction ID"}
                      {getSortIcon("transactionid")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("order_number")}
                    >
                      {isRTL ? "رقم الطلب" : "Order Number"}
                      {getSortIcon("order_number")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("request_timestamp")}
                    >
                      {isRTL ? "وقت الطلب" : "Request Time"}
                      {getSortIcon("request_timestamp")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("credit")}
                    >
                      {isRTL ? "المبلغ" : "Credit"}
                      {getSortIcon("credit")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[80px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("result")}
                    >
                      {isRTL ? "النتيجة" : "Result"}
                      {getSortIcon("result")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("statuscode")}
                    >
                      {isRTL ? "كود الحالة" : "Status Code"}
                      {getSortIcon("statuscode")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("total")}
                    >
                      {isRTL ? "الإجمالي" : "Total"}
                      {getSortIcon("total")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("payment_method")}
                    >
                      {isRTL ? "طريقة الدفع" : "Payment Method"}
                      {getSortIcon("payment_method")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("order_status")}
                    >
                      {isRTL ? "حالة الطلب" : "Order Status"}
                      {getSortIcon("order_status")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("card_number")}
                    >
                      {isRTL ? "رقم البطاقة" : "Card Number"}
                      {getSortIcon("card_number")}
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <div 
                      className="flex items-center cursor-pointer select-none hover:text-primary"
                      onClick={() => handleSort("transaction_receipt")}
                    >
                      {isRTL ? "إيصال المعاملة" : "Transaction Receipt"}
                      {getSortIcon("transaction_receipt")}
                    </div>
                  </TableHead>
                </TableRow>
                {showColumnFilters && (
                  <TableRow className="bg-muted/30">
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.transactionid || ""}
                        onChange={(e) => handleColumnFilterChange("transactionid", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.order_number || ""}
                        onChange={(e) => handleColumnFilterChange("order_number", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.request_timestamp || ""}
                        onChange={(e) => handleColumnFilterChange("request_timestamp", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.credit || ""}
                        onChange={(e) => handleColumnFilterChange("credit", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.result || ""}
                        onChange={(e) => handleColumnFilterChange("result", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.statuscode || ""}
                        onChange={(e) => handleColumnFilterChange("statuscode", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.total || ""}
                        onChange={(e) => handleColumnFilterChange("total", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.payment_method || ""}
                        onChange={(e) => handleColumnFilterChange("payment_method", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.order_status || ""}
                        onChange={(e) => handleColumnFilterChange("order_status", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.card_number || ""}
                        onChange={(e) => handleColumnFilterChange("card_number", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                    <TableHead className="py-2">
                      <Input
                        placeholder={isRTL ? "فلتر..." : "Filter..."}
                        value={columnFilters.transaction_receipt || ""}
                        onChange={(e) => handleColumnFilterChange("transaction_receipt", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      {isRTL ? "لا توجد بيانات" : "No data found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedOrders.map((order) => (
                    <TableRow 
                      key={order.transactionid}
                      className={`hover:bg-muted/50 ${order.order_number || order.result === 'NOK' ? 'cursor-pointer' : ''}`}
                      onClick={() => handleRowClick(order)}
                    >
                      <TableCell className="font-medium text-xs">{order.transactionid}</TableCell>
                      <TableCell>{order.order_number || '-'}</TableCell>
                      <TableCell className="text-xs">{order.request_timestamp ? new Date(order.request_timestamp).toLocaleString() : '-'}</TableCell>
                      <TableCell>{order.credit || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={order.result === 'ACK' ? 'default' : 'secondary'}>
                          {order.result || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.statuscode || '-'}</TableCell>
                      <TableCell>{order.total?.toFixed(2) || '-'}</TableCell>
                      <TableCell>{order.payment_method || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={order.order_status === 'Complete' ? 'default' : 'secondary'}>
                          {order.order_status || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.card_number || '-'}</TableCell>
                      <TableCell className="text-xs">{order.transaction_receipt || '-'}</TableCell>
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
              {selectedOrder 
                ? `${isRTL ? "تفاصيل الطلب" : "Order Details"}: ${selectedOrder.order_number}`
                : isRTL ? "تفاصيل المعاملة المرفوضة" : "Rejected Transaction Details"
              }
            </DialogTitle>
          </DialogHeader>

          {/* Show Hyberpay info for NOK transactions without order */}
          {!selectedOrder && hyberpayInfo && (
            <div className="space-y-6">
              {/* Transaction Reference */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {isRTL ? "معلومات المعاملة" : "Transaction Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "معرف المعاملة" : "Transaction ID"}
                      </Label>
                      <p className="font-medium break-all">{paymentRefrence || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "النتيجة" : "Result"}
                      </Label>
                      <Badge variant="destructive">NOK</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "الحالة" : "Status"}
                      </Label>
                      <p className="font-medium text-destructive">{isRTL ? "مرفوض من البنك" : "Rejected by Bank"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hyberpay Information - Always Expanded for NOK */}
              <Card className="border-destructive/50">
                <CardHeader className="bg-destructive/10">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {isRTL ? "تفاصيل سبب الرفض" : "Rejection Details"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
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
                      <p className="font-medium font-mono bg-muted px-2 py-1 rounded">{hyberpayInfo.returncode || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "المبلغ" : "Amount"}
                      </Label>
                      <p className="font-medium">{hyberpayInfo.credit || '-'} {hyberpayInfo.currency || ''}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "كود الحالة" : "Status Code"}
                      </Label>
                      <p className="font-medium font-mono bg-muted px-2 py-1 rounded">{hyberpayInfo.statuscode || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "كود السبب" : "Reason Code"}
                      </Label>
                      <p className="font-medium font-mono bg-destructive/20 px-2 py-1 rounded">{hyberpayInfo.reasoncode || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "رسالة المستحوذ" : "Acquirer Message"}
                      </Label>
                      <p className="font-medium break-all bg-destructive/10 p-2 rounded border border-destructive/30">{hyberpayInfo.response_acquirermessage || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "استجابة المستحوذ" : "Acquirer Response"}
                      </Label>
                      <p className="font-medium break-all">{hyberpayInfo.acquirerresponse || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "عنوان IP" : "IP Address"}
                      </Label>
                      <p className="font-medium font-mono">{hyberpayInfo.ip || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "البريد الإلكتروني" : "Email"}
                      </Label>
                      <p className="font-medium break-all">{hyberpayInfo.email || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {isRTL ? "حالة مخاطر الاحتيال" : "Risk Fraud Status"}
                      </Label>
                      <p className="font-medium">{hyberpayInfo.riskfraudstatuscode || '-'}</p>
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-muted-foreground">
                        {isRTL ? "وصف مخاطر الاحتيال" : "Risk Fraud Description"}
                      </Label>
                      <p className="font-medium break-all">{hyberpayInfo.riskfrauddescription || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "معرف الموصل" : "Connector ID"}
                      </Label>
                      <p className="font-medium break-all">{hyberpayInfo.connectorid || '-'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-muted-foreground">
                        {isRTL ? "اسم مؤسسة المقاصة" : "Clearing Institute"}
                      </Label>
                      <p className="font-medium break-all">{hyberpayInfo.clearinginstitutename || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Show full order details for orders with order_number */}
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
