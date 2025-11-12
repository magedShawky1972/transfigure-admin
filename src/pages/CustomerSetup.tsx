import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash2, Send, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

interface Customer {
  id: string;
  customer_phone: string;
  customer_name: string;
  creation_date: string;
  partner_id: number | null;
}

const CustomerSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    customer_phone: "",
    customer_name: "",
  });

  // Filter states
  const [phoneFilter, setPhoneFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [partnerIdFilter, setPartnerIdFilter] = useState("all");

  // Sort states
  const [sortColumn, setSortColumn] = useState<keyof Customer | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [customers, phoneFilter, nameFilter, dateFilter, partnerIdFilter, sortColumn, sortDirection]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_phone, customer_name, creation_date, partner_id")
        .order("creation_date", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let result = [...customers];

    // Apply filters
    if (phoneFilter) {
      const pf = phoneFilter.replace(/\D/g, "").trim();
      result = result.filter((c) => {
        const cp = (c.customer_phone ?? "").replace(/\D/g, "");
        return cp.includes(pf);
      });
    }

    if (nameFilter) {
      result = result.filter((c) =>
        c.customer_name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    if (dateFilter) {
      result = result.filter((c) =>
        c.creation_date?.includes(dateFilter)
      );
    }

    if (partnerIdFilter !== "all") {
      if (partnerIdFilter === "synced") {
        result = result.filter((c) => c.partner_id !== null);
      } else if (partnerIdFilter === "not_synced") {
        result = result.filter((c) => c.partner_id === null);
      }
    }

    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        let comparison = 0;
        
        if (sortColumn === "creation_date") {
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

    setFilteredCustomers(result);
  };

  const handleSort = (column: keyof Customer) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleAdd = () => {
    setEditingCustomer(null);
    setFormData({
      customer_phone: "",
      customer_name: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customer_phone: customer.customer_phone,
      customer_name: customer.customer_name,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("customerSetup.deleteConfirm"))) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("customerSetup.deleted"),
      });

      fetchCustomers();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.customer_phone || !formData.customer_name) {
      toast({
        title: t("common.error"),
        description: t("customerSetup.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update({
            customer_name: formData.customer_name,
          })
          .eq("id", editingCustomer.id);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("customerSetup.updated"),
        });
      } else {
        // Insert new customer
        const { error } = await supabase
          .from("customers")
          .insert({
            customer_phone: formData.customer_phone,
            customer_name: formData.customer_name,
            creation_date: new Date().toISOString(),
            status: "active",
            is_blocked: false,
          });

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("customerSetup.created"),
        });
      }

      setDialogOpen(false);
      fetchCustomers();
    } catch (error: any) {
      console.error("Error saving customer:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendToOdoo = async (customer: Customer) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-customer-to-odoo', {
        body: {
          customerPhone: customer.customer_phone,
          customerName: customer.customer_name,
          email: '',
          customerGroup: '',
          status: 'active',
          isBlocked: false,
          blockReason: '',
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
            fetchCustomers();
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

  return (
    <>
      {loading && <LoadingOverlay progress={50} message={t("customerSetup.loading")} />}

      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("customerSetup.title")}</h1>
            <p className="text-muted-foreground">{t("customerSetup.subtitle")}</p>
          </div>
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {t("customerSetup.addNew")}
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-card rounded-md border">
          <div className="space-y-2">
            <Label>{t("customerSetup.phone")}</Label>
            <Input
              placeholder={t("customerSetup.filterByPhone")}
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("customerSetup.name")}</Label>
            <Input
              placeholder={t("customerSetup.filterByName")}
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("customerSetup.creationDate")}</Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Odoo Status</Label>
            <Select value={partnerIdFilter} onValueChange={setPartnerIdFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="not_synced">Not Synced</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  onClick={() => handleSort("partner_id")}
                >
                  {t("customerSetup.partnerId")}
                  <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />
                </TableHead>
                <TableHead className="text-right">{t("customerSetup.actions")}</TableHead>
                <TableHead className="text-center">Odoo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {customers.length === 0 ? t("customerSetup.noData") : "No matching results"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-mono">{customer.customer_phone}</TableCell>
                    <TableCell className="font-medium">{customer.customer_name}</TableCell>
                    <TableCell>
                      {customer.creation_date
                        ? format(new Date(customer.creation_date), "MMM dd, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {customer.partner_id ? (
                        <Badge variant="default">{customer.partner_id}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{t("customerSetup.notSynced")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(customer)}
                          title={t("customerSetup.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(customer.id)}
                          title={t("customerSetup.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
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

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? t("customerSetup.editCustomer") : t("customerSetup.addNew")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t("customerSetup.phone")}</Label>
                <Input
                  id="phone"
                  value={formData.customer_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_phone: e.target.value })
                  }
                  placeholder={t("customerSetup.phonePlaceholder")}
                  disabled={!!editingCustomer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t("customerSetup.name")}</Label>
                <Input
                  id="name"
                  value={formData.customer_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_name: e.target.value })
                  }
                  placeholder={t("customerSetup.namePlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("customerSetup.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? t("customerSetup.saving") : t("customerSetup.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default CustomerSetup;
