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
import { Pencil, Trash2, Receipt, TrendingUp } from "lucide-react";
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
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerTransactions, setSelectedCustomerTransactions] = useState<Transaction[]>([]);
  const [selectedCustomerBrands, setSelectedCustomerBrands] = useState<BrandSummary[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  
  // Filter states
  const [filterName, setFilterName] = useState("");
  const [filterPhone, setFilterPhone] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterBlocked, setFilterBlocked] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    customer_name: "",
    status: "active",
    block_reason: "",
  });

  useEffect(() => {
    fetchCustomers();
    fetchBrands();
  }, []);

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

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("creation_date", { ascending: false });

      if (error) throw error;

      // Fetch total spend and last transaction date for each customer
      const customersWithData = await Promise.all(
        (data || []).map(async (customer) => {
          const { data: transactions } = await supabase
            .from("purpletransaction")
            .select("total, created_at_date")
            .eq("customer_phone", customer.customer_phone)
            .order("created_at_date", { ascending: false });

          const totalSpend = (transactions || []).reduce((sum, t) => {
            const amount = parseFloat(t.total?.replace(/[^0-9.-]/g, '') || '0');
            return sum + amount;
          }, 0);

          const lastTransactionDate = transactions?.[0]?.created_at_date || null;

          return { ...customer, totalSpend, lastTransactionDate };
        })
      );

      setCustomers(customersWithData);
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

    return filtered;
  }, [customers, filterName, filterPhone, filterBlocked, filterBrand, filterProduct, customerTransactions]);

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
      fetchCustomers();
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
      fetchCustomers();
      
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
      
      fetchCustomers();
      setClearDialogOpen(false);
    } catch (error: any) {
      toast({
        title: t("common.error"),
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

  return (
    <>
      {loading && <LoadingOverlay progress={100} message={t("common.loading")} />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("customerSetup.title")}</h1>
          <Button variant="destructive" onClick={() => setClearDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t("customerSetup.clearAll")}
          </Button>
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
              <TableHead>{t("customerSetup.phone")}</TableHead>
              <TableHead>{t("customerSetup.name")}</TableHead>
              <TableHead>{t("customerSetup.creationDate")}</TableHead>
              <TableHead>{t("customerSetup.lastTransactionDate")}</TableHead>
              <TableHead>{t("customerSetup.totalSpend")}</TableHead>
              <TableHead>{t("customerSetup.status")}</TableHead>
              <TableHead>{t("customerSetup.blocked")}</TableHead>
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
