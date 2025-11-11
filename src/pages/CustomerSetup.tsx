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
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    customer_phone: "",
    customer_name: "",
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

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

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("customerSetup.phone")}</TableHead>
                <TableHead>{t("customerSetup.name")}</TableHead>
                <TableHead>{t("customerSetup.creationDate")}</TableHead>
                <TableHead>{t("customerSetup.partnerId")}</TableHead>
                <TableHead className="text-right">{t("customerSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("customerSetup.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
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
