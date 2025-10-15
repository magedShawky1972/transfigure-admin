import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { getCachedData, setCachedData, getDailyCacheKey, invalidateCache } from "@/lib/queryCache";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import { Pencil, Trash2, Receipt, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Eraser } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Customer {
  id: string;
  customer_phone: string;
  customer_name: string;
  creation_date: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  status: string;
  is_blocked: boolean;
  block_reason: string | null;
  totalSpend?: number;
  lastTransactionDate?: string;
}

interface Brand {
  id: string;
  brand_name: string;
  status: string;
}

interface Transaction {
  id: string;
  created_at_date: string;
  brand_name: string;
  product_name: string;
  total: string;
  order_number: string;
}

interface BrandSummary {
  brand: string;
  totalSpent: number;
  lastTransaction: string;
  transactionCount: number;
}

const CustomerSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCustomerCount, setTotalCustomerCount] = useState<number>(0);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerTransactions, setSelectedCustomerTransactions] = useState<Transaction[]>([]);
  const [selectedCustomerBrands, setSelectedCustomerBrands] = useState<BrandSummary[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [cacheLoaded, setCacheLoaded] = useState<boolean>(false);
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 30;
  
  // Filter states
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterBlocked, setFilterBlocked] = useState<string>("all");
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState<keyof Customer | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Watch for filter changes (name, phone, blocked)
  useEffect(() => {
    if ((filterName || filterPhone || filterBlocked !== "all") && hasMore) {
      fetchAllCustomers();
    }
  }, [filterName, filterPhone, filterBlocked]);
  
  const [formData, setFormData] = useState({
    customer_name: "",
    status: "active",
    block_reason: "",
  });

  useEffect(() => {
    fetchCustomers(true);
    fetchTotalCount();
    fetchBrands();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop
        >= document.documentElement.offsetHeight - 100
      ) {
        if (hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading]);

  useEffect(() => {
    if (page > 1) {
      fetchCustomers(false);
    }
  }, [page]);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("status", "active")
        .order("brand_name", { ascending: true });

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      console.error("Error fetching brands:", error);
    }
  };

  const fetchTotalCount = async () => {
    try {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: 'exact', head: true });

      if (error) throw error;
      setTotalCustomerCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching total count:", error);
    }
  };

  const fetchCustomers = async (reset: boolean = false) => {
    setLoading(true);
    setCacheLoaded(false);
    try {
      const from = reset ? 0 : (page - 1) * ITEMS_PER_PAGE;
      const to = reset ? ITEMS_PER_PAGE - 1 : page * ITEMS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("creation_date", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if ((data || []).length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }

      // Fetch ALL transactions for these customers in ONE query
      const customerPhones = (data || []).map(c => c.customer_phone);
      const { data: allTransactions } = await supabase
        .from("purpletransaction")
        .select("customer_phone, total, created_at_date")
        .in("customer_phone", customerPhones)
        .order("created_at_date", { ascending: true });

      // Group transactions by customer phone in memory
      const transactionsByPhone = new Map<string, any[]>();
      (allTransactions || []).forEach((t) => {
        if (!transactionsByPhone.has(t.customer_phone)) {
          transactionsByPhone.set(t.customer_phone, []);
        }
        transactionsByPhone.get(t.customer_phone)!.push(t);
      });

      // Process customers with their transactions
      const customersWithData = (data || []).map((customer) => {
        const transactions = transactionsByPhone.get(customer.customer_phone) || [];
        
        const totalSpend = transactions.reduce((sum, t) => {
          const amount = parseFloat(t.total?.replace(/[^0-9.-]/g, '') || '0');
          return sum + amount;
        }, 0);

        const lastTransactionDate = transactions[transactions.length - 1]?.created_at_date || null;

        return { 
          ...customer, 
          totalSpend, 
          lastTransactionDate
        };
      });

      if (reset) {
        setCustomers(customersWithData);
        setPage(1);
        setHasMore(true);
      } else {
        setCustomers((prev) => [...prev, ...customersWithData]);
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCustomers = async () => {
    setLoading(true);
    try {
      // Try to get from cache first
      const cacheKey = getDailyCacheKey("customers_all");
      const cachedData = await getCachedData<Customer[]>(cacheKey);
      
      if (cachedData) {
        console.log("Loading customers from cache");
        setCacheLoaded(true);
        setCustomers(cachedData);
        setHasMore(false);
        setLoading(false);
        return;
      }

      console.log("Cache miss - fetching from database");
      setCacheLoaded(false);
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("creation_date", { ascending: false });

      if (error) throw error;

      // Fetch ALL transactions in ONE query
      const { data: allTransactions } = await supabase
        .from("purpletransaction")
        .select("customer_phone, total, created_at_date")
        .order("created_at_date", { ascending: true });

      // Group transactions by customer phone in memory
      const transactionsByPhone = new Map<string, any[]>();
      (allTransactions || []).forEach((t) => {
        if (!transactionsByPhone.has(t.customer_phone)) {
          transactionsByPhone.set(t.customer_phone, []);
        }
        transactionsByPhone.get(t.customer_phone)!.push(t);
      });

      // Process customers with their transactions
      const customersWithData = (data || []).map((customer) => {
        const transactions = transactionsByPhone.get(customer.customer_phone) || [];
        
        const totalSpend = transactions.reduce((sum, t) => {
          const amount = parseFloat(t.total?.replace(/[^0-9.-]/g, '') || '0');
          return sum + amount;
        }, 0);

        const lastTransactionDate = transactions[transactions.length - 1]?.created_at_date || null;

        return { 
          ...customer, 
          totalSpend, 
          lastTransactionDate
        };
      });

      // Validate data completeness before caching
      if (customersWithData && customersWithData.length > 0) {
        console.log(`Fetched ${customersWithData.length} customers with complete data`);
        
        // Set state first
        setCustomers(customersWithData);
        setHasMore(false);
        setCacheLoaded(false);
        
        // Only cache after successful state update
        await setCachedData(cacheKey, customersWithData, { expiryHours: 24 });
        console.log("Customers cached successfully after validation");
      } else {
        console.warn("No customer data to cache");
        setCustomers([]);
        setHasMore(false);
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const [customerTransactions, setCustomerTransactions] = useState<Record<string, Transaction[]>>({});

  // Fetch transactions for brand/product filtering
  useEffect(() => {
    if (filterBrand || filterProduct) {
      // Load all customers when filtering
      if (hasMore) {
        fetchAllCustomers();
      }
      fetchFilteredTransactions();
    }
  }, [filterBrand, filterProduct]);

  const fetchFilteredTransactions = async () => {
    try {
      let query = supabase
        .from("purpletransaction")
        .select("customer_phone, brand_name, product_name");

      if (filterBrand) {
        query = query.eq("brand_name", filterBrand);
      }
      if (filterProduct) {
        query = query.ilike("product_name", `%${filterProduct}%`);
      }

      const { data } = await query;
      
      // Group by customer phone
      const grouped: Record<string, Transaction[]> = {};
      (data || []).forEach((item: any) => {
        if (!grouped[item.customer_phone]) {
          grouped[item.customer_phone] = [];
        }
        grouped[item.customer_phone].push(item);
      });
      
      setCustomerTransactions(grouped);
    } catch (error) {
      console.error("Error fetching filtered transactions:", error);
    }
  };

  const filteredCustomers = useMemo(() => {
    let filtered = customers.filter((customer) => {
      const nameMatch = !filterName || customer.customer_name.toLowerCase().includes(filterName.toLowerCase());
      const phoneMatch = !filterPhone || customer.customer_phone.includes(filterPhone);
      const blockedMatch = filterBlocked === "all" || 
        (filterBlocked === "blocked" && customer.is_blocked) ||
        (filterBlocked === "active" && !customer.is_blocked);

      // Brand and product filter
      let brandProductMatch = true;
      if (filterBrand || filterProduct) {
        brandProductMatch = !!customerTransactions[customer.customer_phone];
      }

      return nameMatch && phoneMatch && blockedMatch && brandProductMatch;
    });

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortColumn];
        let bVal: any = b[sortColumn];
        
        // Handle special cases
        if (sortColumn === "totalSpend") {
          aVal = a.totalSpend || 0;
          bVal = b.totalSpend || 0;
        } else if (sortColumn === "creation_date" || sortColumn === "lastTransactionDate") {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [customers, filterName, filterPhone, filterBlocked, filterBrand, filterProduct, customerTransactions, sortColumn, sortDirection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCustomer) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("customers")
          .update({
            customer_name: formData.customer_name,
            status: formData.status,
            block_reason: formData.status === 'disable' ? formData.block_reason : null,
            updated_by: user?.id,
          })
          .eq("id", editingCustomer.id);

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("customerSetup.success"),
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchCustomers(true);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customer_name: customer.customer_name,
      status: customer.status,
      block_reason: customer.block_reason || "",
    });
    setDialogOpen(true);
  };

  const handleToggleBlock = async (customer: Customer) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("customers")
        .update({ 
          is_blocked: !customer.is_blocked,
          updated_by: user?.id,
        })
        .eq("id", customer.id);

      if (error) throw error;
      fetchCustomers(true);
      
      toast({
        title: t("common.success"),
        description: t("customerSetup.success"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewTransactions = async (customer: Customer) => {
    setSelectedCustomerName(customer.customer_name);
    const { data } = await supabase
      .from("purpletransaction")
      .select("id, created_at_date, brand_name, product_name, total, order_number")
      .eq("customer_phone", customer.customer_phone)
      .order("created_at_date", { ascending: false });

    setSelectedCustomerTransactions(data || []);
    setTransactionsDialogOpen(true);
  };

  const handleViewSummary = async (customer: Customer) => {
    setSelectedCustomerName(customer.customer_name);
    const { data } = await supabase
      .from("purpletransaction")
      .select("brand_name, product_name, total, created_at_date")
      .eq("customer_phone", customer.customer_phone);

    // Group by brand
    const brandMap = new Map<string, BrandSummary>();
    (data || []).forEach((t) => {
      const brand = t.brand_name || "Unknown";
      const amount = parseFloat(t.total?.replace(/[^0-9.-]/g, '') || '0');
      
      if (brandMap.has(brand)) {
        const existing = brandMap.get(brand)!;
        existing.totalSpent += amount;
        existing.transactionCount += 1;
        if (new Date(t.created_at_date) > new Date(existing.lastTransaction)) {
          existing.lastTransaction = t.created_at_date;
        }
      } else {
        brandMap.set(brand, {
          brand,
          totalSpent: amount,
          lastTransaction: t.created_at_date,
          transactionCount: 1,
        });
      }
    });

    setSelectedCustomerBrands(Array.from(brandMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
    setSummaryDialogOpen(true);
  };

  const handleClearAll = async () => {
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
      
      toast({
        title: t("common.success"),
        description: t("customerSetup.cleared"),
      });
      
      fetchCustomers(true);
      fetchTotalCount();
      setClearDialogOpen(false);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncCustomers = async () => {
    setSyncingCustomers(true);
    try {
      toast({
        title: "Syncing customers...",
        description: "Scanning all transactions for missing customers",
      });

      // Get all unique customers from purpletransaction table
      const { data: allTransactions } = await supabase
        .from("purpletransaction")
        .select("customer_phone, customer_name, created_at_date")
        .not("customer_phone", "is", null)
        .not("customer_name", "is", null);

      if (!allTransactions || allTransactions.length === 0) {
        toast({
          title: "No transactions found",
          description: "No transaction data to sync from",
          variant: "destructive",
        });
        return;
      }

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

      if (missingCustomers.length === 0) {
        toast({
          title: "All synced!",
          description: "No missing customers found. All customers are already in the database.",
        });
        return;
      }

      // Insert missing customers
      const { error: syncError } = await supabase
        .from("customers")
        .insert(missingCustomers);

      if (syncError) throw syncError;

      toast({
        title: "Sync completed!",
        description: `Successfully created ${missingCustomers.length} missing customers from transaction history`,
      });

      // Refresh the customer list
      setCustomers([]);
      setPage(1);
      setHasMore(true);
      fetchCustomers(true);
      fetchTotalCount();

    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncingCustomers(false);
    }
  };

  const handleClearCache = async () => {
    try {
      toast({
        title: "Clearing cache...",
        description: "Removing cached customer data",
      });

      await invalidateCache("customers");

      // Clear current data and refetch
      setCustomers([]);
      setPage(1);
      setHasMore(true);
      await fetchCustomers(true);
      await fetchTotalCount();

      toast({
        title: "Cache cleared!",
        description: "Customer data has been refreshed from the database",
      });
    } catch (error: any) {
      toast({
        title: "Clear cache failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      status: "active",
      block_reason: "",
    });
    setEditingCustomer(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const isNewCustomer = (creationDate: string) => {
    const created = new Date(creationDate);
    const now = new Date();
    const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7; // Consider new if created within last 7 days
  };

  const handleSort = (column: keyof Customer) => {
    // Load all customers when sorting
    if (hasMore) {
      fetchAllCustomers();
    }
    
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof Customer }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1 inline" />
      : <ArrowDown className="h-4 w-4 ml-1 inline" />;
  };

  return (
    <>
      {loading && <LoadingOverlay progress={100} message={t("common.loading")} />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">{t("customerSetup.title")}</h1>
            <Badge variant="secondary" className="text-lg px-4 py-1">
              {totalCustomerCount} {t("customerSetup.customers")}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant={cacheLoaded ? "secondary" : "outline"}
              onClick={handleClearCache}
              className="flex items-center gap-2"
            >
              <Eraser className="h-4 w-4" />
              {cacheLoaded ? "Clear Cache (Active)" : "Clear Cache"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncCustomers}
              disabled={syncingCustomers}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncingCustomers ? 'animate-spin' : ''}`} />
              {syncingCustomers ? "Syncing..." : "Sync Customers"}
            </Button>
            <Button variant="destructive" onClick={() => setClearDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t("customerSetup.clearAll")}
            </Button>
          </div>
        </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-card rounded-md border">
        <Input
          placeholder={t("customerSetup.filterByName")}
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
        />
        <Input
          placeholder={t("customerSetup.filterByPhone")}
          value={filterPhone}
          onChange={(e) => setFilterPhone(e.target.value)}
        />
        <Select value={filterBlocked} onValueChange={setFilterBlocked}>
          <SelectTrigger>
            <SelectValue placeholder={t("customerSetup.blocked")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="active">{t("customerSetup.active")}</SelectItem>
            <SelectItem value="blocked">{t("customerSetup.blocked")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBrand || "all"} onValueChange={(value) => setFilterBrand(value === "all" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder={t("customerSetup.filterByBrand")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.brand_name}>
                {brand.brand_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder={t("customerSetup.filterByProduct")}
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("customer_phone")}
              >
                {t("customerSetup.phone")}
                <SortIcon column="customer_phone" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("customer_name")}
              >
                {t("customerSetup.name")}
                <SortIcon column="customer_name" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("creation_date")}
              >
                {t("customerSetup.creationDate")}
                <SortIcon column="creation_date" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("lastTransactionDate" as keyof Customer)}
              >
                {t("customerSetup.lastTransactionDate")}
                <SortIcon column={"lastTransactionDate" as keyof Customer} />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("totalSpend" as keyof Customer)}
              >
                {t("customerSetup.totalSpend")}
                <SortIcon column={"totalSpend" as keyof Customer} />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("status")}
              >
                {t("customerSetup.status")}
                <SortIcon column="status" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("is_blocked")}
              >
                {t("customerSetup.blocked")}
                <SortIcon column="is_blocked" />
              </TableHead>
              <TableHead className="text-right">{t("customerSetup.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map((customer) => (
              <TableRow 
                key={customer.id}
                className={isNewCustomer(customer.creation_date) ? "bg-primary/5" : ""}
              >
                <TableCell className="font-medium">{customer.customer_phone}</TableCell>
                <TableCell>
                  <button
                    onClick={() => handleViewSummary(customer)}
                    className="text-primary hover:underline font-medium flex items-center gap-2"
                  >
                    {customer.customer_name}
                    {isNewCustomer(customer.creation_date) && (
                      <Badge variant="default" className="text-xs">
                        {t("customerSetup.newCustomer")}
                      </Badge>
                    )}
                  </button>
                </TableCell>
                <TableCell>{format(new Date(customer.creation_date), "MMM dd, yyyy")}</TableCell>
                <TableCell>
                  {customer.lastTransactionDate 
                    ? format(new Date(customer.lastTransactionDate), "MMM dd, yyyy")
                    : "-"
                  }
                </TableCell>
                <TableCell className="font-semibold">
                  {(customer.totalSpend || 0).toLocaleString('en-US', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })}
                </TableCell>
                <TableCell>
                  <span className={customer.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                    {customer.status}
                  </span>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={customer.is_blocked}
                    onCheckedChange={() => handleToggleBlock(customer)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewTransactions(customer)}
                      title={t("customerSetup.viewTransactions")}
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewSummary(customer)}
                      title={t("customerSetup.viewSummary")}
                    >
                      <TrendingUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(customer)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("customerSetup.editCustomer")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_phone">{t("customerSetup.phone")}</Label>
              <Input
                id="customer_phone"
                value={editingCustomer?.customer_phone || ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">{t("customerSetup.customerName")}</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{t("customerSetup.status")}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("customerSetup.active")}</SelectItem>
                  <SelectItem value="disable">{t("customerSetup.disabled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.status === 'disable' && (
              <div className="space-y-2">
                <Label htmlFor="block_reason">{t("customerSetup.blockReason")}</Label>
                <Textarea
                  id="block_reason"
                  value={formData.block_reason}
                  onChange={(e) =>
                    setFormData({ ...formData, block_reason: e.target.value })
                  }
                  placeholder={t("customerSetup.blockReasonPlaceholder")}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("customerSetup.saving") : t("customerSetup.save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("customerSetup.customerTransactions")} - {selectedCustomerName}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dashboard.date")}</TableHead>
                <TableHead>{t("customerSetup.brand")}</TableHead>
                <TableHead>{t("customerSetup.product")}</TableHead>
                <TableHead>{t("dashboard.orderNumber")}</TableHead>
                <TableHead className="text-right">{t("dashboard.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedCustomerTransactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{format(new Date(txn.created_at_date), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{txn.brand_name}</TableCell>
                  <TableCell>{txn.product_name}</TableCell>
                  <TableCell>{txn.order_number}</TableCell>
                  <TableCell className="text-right">{txn.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("customerSetup.customerSummary")} - {selectedCustomerName}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customerSetup.brand")}</TableHead>
                <TableHead className="text-right">{t("customerSetup.totalSpend")}</TableHead>
                <TableHead className="text-right">{t("dashboard.transactions")}</TableHead>
                <TableHead>{t("customerSetup.lastTransaction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedCustomerBrands.map((brand) => (
                <TableRow key={brand.brand}>
                  <TableCell className="font-medium">{brand.brand}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {brand.totalSpent.toLocaleString('en-US', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2 
                    })}
                  </TableCell>
                  <TableCell className="text-right">{brand.transactionCount}</TableCell>
                  <TableCell>{format(new Date(brand.lastTransaction), "MMM dd, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("customerSetup.clearAll")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("customerSetup.clearConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("customerSetup.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
};

export default CustomerSetup;
