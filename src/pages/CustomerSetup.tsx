import { useState, useEffect } from "react";
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
import { Pencil, Trash2, Receipt, TrendingUp, ArrowUpDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerTransactionsDialog } from "@/components/CustomerTransactionsDialog";

interface CustomerTotal {
  customer_phone: string;
  customer_name: string;
  creation_date: string;
  last_trans_date: string;
  total: number;
  status: string;
  is_blocked: boolean;
  block_reason: string | null;
}

const CustomerSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<CustomerTotal[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerTotal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [missingCustomers, setMissingCustomers] = useState<any[]>([]);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ phone: string; name: string } | null>(null);
  
  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  
  // Sort states
  const [sortColumn, setSortColumn] = useState<keyof CustomerTotal | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchCustomers();

    // Listen for data upload events to auto-refresh
    const handleDataUploaded = () => {
      fetchCustomers();
    };
    window.addEventListener('dataUploaded', handleDataUploaded);

    return () => {
      window.removeEventListener('dataUploaded', handleDataUploaded);
    };
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [customers, nameFilter, phoneFilter, blockedFilter, brandFilter, productFilter, sortColumn, sortDirection]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // Fetch customers data
      const { data, error } = await supabase
        .from("customer_totals")
        .select("*")
        .order("total", { ascending: false });

      if (error) throw error;
      console.log('Fetched customers count:', data?.length);
      console.log('Sample customer phones:', data?.slice(0, 5).map(c => c.customer_phone));
      setCustomers(data || []);

      // Fetch total count
      const { count, error: countError } = await supabase
        .from("customer_totals")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error loading customers",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let result = [...customers];
    console.log('Total customers before filters:', result.length);

    // Apply filters
    if (nameFilter) {
      result = result.filter((c) =>
        c.customer_name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }
    if (phoneFilter) {
      result = result.filter((c) =>
        c.customer_phone?.includes(phoneFilter)
      );
    }
    if (blockedFilter !== "all") {
      result = result.filter((c) =>
        blockedFilter === "blocked" ? c.is_blocked : !c.is_blocked
      );
    }
    if (productFilter) {
      // Product filter would need to query transactions - skipping for now
    }

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        let comparison = 0;
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = aVal.localeCompare(bVal);
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    console.log('Customers after filters:', result.length);
    setFilteredCustomers(result);
  };

  const handleSort = (column: keyof CustomerTotal) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleViewTransactions = (customer: CustomerTotal) => {
    setSelectedCustomer({
      phone: customer.customer_phone,
      name: customer.customer_name,
    });
    setTransactionsDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("customerSetup.cleared"),
      });

      setClearAllDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      console.error("Error clearing customers:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCustomers = async () => {
    setLoading(true);
    try {
      const pageSize = 1000;
      // Get total count first
      const { count, error: countError } = await supabase
        .from("notin_customer_incustomer")
        .select("*", { count: "exact", head: true });
      if (countError) throw countError;

      const total = count || 0;
      const all: any[] = [];
      // Paginate to bypass 1000-row limit
      const pages = total > 0 ? Math.ceil(total / pageSize) : 0;
      for (let p = 0; p < pages; p++) {
        const from = p * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("notin_customer_incustomer")
          .select("*")
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }

      setMissingCustomers(all);
      setSyncDialogOpen(true);
    } catch (error: any) {
      console.error("Error fetching missing customers:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSync = async () => {
    setLoading(true);
    try {
      const normalizePhone = (p: string) => (p ?? "").trim();
      const customersToInsert = missingCustomers.map((customer) => ({
        customer_phone: normalizePhone(customer.customer_phone),
        customer_name: customer.customer_name?.trim?.() ?? customer.customer_name,
        creation_date: customer.creation_date,
        status: "active",
        is_blocked: false,
      }));

      const batchSize = 1000;
      for (let i = 0; i < customersToInsert.length; i += batchSize) {
        const chunk = customersToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from("customers")
          .upsert(chunk, { onConflict: "customer_phone" });
        if (error) throw error;
      }

      toast({
        title: t("common.success"),
        description: `${missingCustomers.length} ${t("customerSetup.customersAdded")}`,
      });

      setSyncDialogOpen(false);
      setMissingCustomers([]);
      fetchCustomers();
    } catch (error: any) {
      console.error("Error syncing customers:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <LoadingOverlay progress={50} message="Loading customers..." />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">{t("customerSetup.title")}</h1>
            <Badge variant="secondary" className="text-lg px-4 py-1">
              {totalCount} {t("customerSetup.customers")}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSyncCustomers}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t("customerSetup.syncCustomers")}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setClearAllDialogOpen(true)}
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("customerSetup.clearAll")}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-card rounded-md border">
          <Input
            placeholder={t("customerSetup.filterByName")}
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
          <Input
            placeholder={t("customerSetup.filterByPhone")}
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
          />
          <Select value={blockedFilter} onValueChange={setBlockedFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t("customerSetup.blocked")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="active">{t("customerSetup.active")}</SelectItem>
              <SelectItem value="blocked">{t("customerSetup.blocked")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter} disabled>
            <SelectTrigger>
              <SelectValue placeholder={t("customerSetup.filterByBrand")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t("customerSetup.filterByProduct")}
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            disabled
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
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("customer_name")}
                >
                  {t("customerSetup.name")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("creation_date")}
                >
                  {t("customerSetup.creationDate")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("last_trans_date")}
                >
                  {t("customerSetup.lastTransactionDate")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("total")}
                >
                  {t("customerSetup.totalSpend")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("status")}
                >
                  {t("customerSetup.status")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("is_blocked")}
                >
                  {t("customerSetup.blocked")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="text-right">{t("customerSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No customers to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.customer_phone}>
                    <TableCell className="font-mono">{customer.customer_phone}</TableCell>
                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                    <TableCell>
                      {customer.creation_date
                        ? format(new Date(customer.creation_date), "MMM dd, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {customer.last_trans_date
                        ? format(new Date(customer.last_trans_date), "MMM dd, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="font-semibold text-right">
                      {formatCurrency(customer.total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={customer.is_blocked} disabled />
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
                        <Button variant="outline" size="sm" disabled>
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Dialog */}
        <Dialog open={false}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("customerSetup.editCustomer")}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_phone">{t("customerSetup.phone")}</Label>
                <Input
                  id="customer_phone"
                  value=""
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_name">{t("customerSetup.customerName")}</Label>
                <Input
                  id="customer_name"
                  value=""
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t("customerSetup.status")}</Label>
                <Select value="active" disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("customerSetup.active")}</SelectItem>
                    <SelectItem value="disable">{t("customerSetup.disabled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="block_reason">{t("customerSetup.blockReason")}</Label>
                <Textarea
                  id="block_reason"
                  value=""
                  disabled
                  placeholder={t("customerSetup.blockReasonPlaceholder")}
                />
              </div>
              <Button type="submit" className="w-full" disabled>
                {t("customerSetup.save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transactions Dialog */}
        <CustomerTransactionsDialog
          open={transactionsDialogOpen}
          onOpenChange={setTransactionsDialogOpen}
          customerPhone={selectedCustomer?.phone || null}
          customerName={selectedCustomer?.name || null}
        />

        {/* Summary Dialog */}
        <Dialog open={false}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("customerSetup.customerSummary")}</DialogTitle>
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
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    No summary data
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Clear All Confirmation */}
        <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("customerSetup.clearAll")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("customerSetup.clearConfirm")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("customerSetup.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearAll} disabled={loading}>
                {loading ? t("common.loading") : t("clearData.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Sync Customers Confirmation */}
        <AlertDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("customerSetup.syncCustomers")}</AlertDialogTitle>
              <AlertDialogDescription>
                {missingCustomers.length > 0
                  ? `${t("customerSetup.missingCustomersFound")}: ${missingCustomers.length}`
                  : t("customerSetup.noMissingCustomers")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("customerSetup.cancel")}</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmSync} 
                disabled={loading || missingCustomers.length === 0}
              >
                {loading ? t("common.loading") : t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default CustomerSetup;
