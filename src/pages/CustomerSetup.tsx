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
import { Pencil, Trash2, Receipt, TrendingUp, ArrowUpDown, RefreshCw, Send } from "lucide-react";
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
  partner_id?: number | null;
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerTotal | null>(null);
  
  // Filter states
  const [nameFilter, setNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  
  // Sort states - default to creation_date desc
  const [sortColumn, setSortColumn] = useState<keyof CustomerTotal | null>("creation_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchCustomers("creation_date", "desc");

    // Listen for data upload events to auto-refresh
    const handleDataUploaded = () => {
      fetchCustomers(sortColumn ?? undefined, sortDirection);
    };
    window.addEventListener('dataUploaded', handleDataUploaded);

    return () => {
      window.removeEventListener('dataUploaded', handleDataUploaded);
    };
  }, []);

  // Refetch from backend when sort column/direction changes to avoid 1000-row client limits
  useEffect(() => {
    if (sortColumn) {
      fetchCustomers(sortColumn, sortDirection);
    }
  }, [sortColumn, sortDirection]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [customers, nameFilter, phoneFilter, blockedFilter, brandFilter, productFilter, sortColumn, sortDirection]);

  const fetchCustomers = async (
    orderBy?: keyof CustomerTotal,
    direction: "asc" | "desc" = "desc"
  ) => {
    setLoading(true);
    try {
      const pageSize = 1000;
      const orderColumn: keyof CustomerTotal = (orderBy as keyof CustomerTotal) || "total";

      // Fetch total count first (head request)
      const { count, error: countError } = await supabase
        .from("customer_totals")
        .select("*", { count: "exact", head: true });
      if (countError) throw countError;

      const total = count ?? 0;

      const all: CustomerTotal[] = [];
      const pages = total > 0 ? Math.ceil(total / pageSize) : 0;
      for (let p = 0; p < pages; p++) {
        const from = p * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("customer_totals")
          .select("*")
          .order(orderColumn as string, { ascending: direction === "asc", nullsFirst: false })
          .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as CustomerTotal[]));
        if (data.length < pageSize) break;
      }

      // Fallback if count is 0 or pagination returned nothing
      if (all.length === 0) {
        const { data, error } = await supabase
          .from("customer_totals")
          .select("*")
          .order(orderColumn as string, { ascending: direction === "asc", nullsFirst: false })
          .range(0, pageSize - 1);
        if (error) throw error;
        setCustomers((data as CustomerTotal[]) || []);
        setTotalCount(data?.length ?? 0);
      } else {
        setCustomers(all);
        setTotalCount(total);
      }

      console.log("Fetched customers count:", (all.length || 0) || "unknown");
      console.log("Sample customer phones:", (all.length ? all : undefined)?.slice(0, 5)?.map((c) => c.customer_phone));
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
      const pf = phoneFilter.replace(/\D/g, "").trim();
      result = result.filter((c) => {
        const cp = (c.customer_phone ?? "").replace(/\D/g, "");
        return pf === "" ? true : cp.includes(pf);
      });
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
        
        // Handle date columns specially
        if (sortColumn === "creation_date" || sortColumn === "last_trans_date") {
          const aDate = new Date(aVal as string).getTime();
          const bDate = new Date(bVal as string).getTime();
          comparison = aDate - bDate;
        } else if (typeof aVal === "number" && typeof bVal === "number") {
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

  // Fallback: if local filtering returns nothing, query backend by phone
  useEffect(() => {
    const run = async () => {
      const pf = phoneFilter.replace(/\D/g, "").trim();
      if (!pf) return;
      if (filteredCustomers.length === 0 && customers.length > 0) {
        const { data, error } = await supabase
          .from("customer_totals")
          .select("*")
          .ilike("customer_phone", `%${pf}%`)
          .limit(100);
        if (!error && data && data.length > 0) {
          setFilteredCustomers(data as any);
        }
      }
    };
    run();
  }, [phoneFilter, customers]);

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

  const isNewCustomer = (creationDate: string) => {
    const created = new Date(creationDate);
    const now = new Date();
    const diffTime = now.getTime() - created.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= 2 && diffDays >= 0;
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

  const handleSendToOdoo = async (customer: CustomerTotal) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-customer-to-odoo', {
        body: {
          customerPhone: customer.customer_phone,
          customerName: customer.customer_name,
          email: '',
          customerGroup: '',
          status: customer.status,
          isBlocked: customer.is_blocked,
          blockReason: customer.block_reason || '',
        },
      });

      if (error) throw error;

      if (data?.success) {
        // Update customer with partner_id from Odoo response
        if (data.partner_id) {
          const { error: updateError } = await supabase
            .from('customers')
            .update({ partner_id: data.partner_id })
            .eq('customer_phone', customer.customer_phone);
          
          if (updateError) {
            console.error('Error updating partner_id:', updateError);
          } else {
            // Refresh customers list to show updated partner_id
            fetchCustomers(sortColumn ?? undefined, sortDirection);
          }
        }

        toast({
          title: t("common.success"),
          description: `Customer sent to Odoo successfully. Partner ID: ${data.partner_id}`,
        });
      } else {
        throw new Error(data?.error || 'Failed to send customer to Odoo');
      }
    } catch (error: any) {
      console.error('Error sending customer to Odoo:', error);
      toast({
        title: t("common.error"),
        description: error.message || 'Failed to send customer to Odoo',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = (customer: CustomerTotal) => {
    setEditingCustomer(customer);
    setEditDialogOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          customer_name: editingCustomer.customer_name,
          status: editingCustomer.status,
          is_blocked: editingCustomer.is_blocked,
          block_reason: editingCustomer.block_reason,
        })
        .eq('customer_phone', editingCustomer.customer_phone);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("customerSetup.customerUpdated"),
      });

      setEditDialogOpen(false);
      setEditingCustomer(null);
      fetchCustomers(sortColumn ?? undefined, sortDirection);
    } catch (error: any) {
      console.error('Error updating customer:', error);
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
                <TableHead className="text-center">Odoo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No customers to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.customer_phone}>
                    <TableCell className="font-mono">{customer.customer_phone}</TableCell>
                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {customer.creation_date
                          ? format(new Date(customer.creation_date), "MMM dd, yyyy")
                          : "-"}
                        {customer.creation_date && isNewCustomer(customer.creation_date) && (
                          <Badge variant="default" className="text-xs">NEW</Badge>
                        )}
                      </div>
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditCustomer(customer)}
                          title={t("customerSetup.editCustomer")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendToOdoo(customer)}
                        title="Send customer to Odoo"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("customerSetup.editCustomer")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveCustomer(); }} className="space-y-4">
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
                  value={editingCustomer?.customer_name || ""}
                  onChange={(e) => setEditingCustomer(editingCustomer ? {...editingCustomer, customer_name: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner_id">Partner ID (Odoo)</Label>
                <Input
                  id="partner_id"
                  value={editingCustomer?.partner_id?.toString() || "Not synced"}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t("customerSetup.status")}</Label>
                <Select 
                  value={editingCustomer?.status || "active"}
                  onValueChange={(value) => setEditingCustomer(editingCustomer ? {...editingCustomer, status: value} : null)}
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
              <div className="flex items-center gap-2">
                <Switch 
                  id="is_blocked"
                  checked={editingCustomer?.is_blocked || false}
                  onCheckedChange={(checked) => setEditingCustomer(editingCustomer ? {...editingCustomer, is_blocked: checked} : null)}
                />
                <Label htmlFor="is_blocked">{t("customerSetup.blocked")}</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="block_reason">{t("customerSetup.blockReason")}</Label>
                <Textarea
                  id="block_reason"
                  value={editingCustomer?.block_reason || ""}
                  onChange={(e) => setEditingCustomer(editingCustomer ? {...editingCustomer, block_reason: e.target.value} : null)}
                  placeholder={t("customerSetup.blockReasonPlaceholder")}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.loading") : t("customerSetup.save")}
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
