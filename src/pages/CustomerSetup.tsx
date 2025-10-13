import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Ban } from "lucide-react";
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
}

const CustomerSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState({
    customer_name: "",
    status: "active",
    block_reason: "",
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
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
          description: "Customer updated successfully",
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
        description: customer.is_blocked ? "Customer unblocked" : "Customer blocked",
      });
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Customer Setup</h1>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Phone</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Creation Date</TableHead>
              <TableHead>Updated Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Blocked</TableHead>
              <TableHead>Block Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.customer_phone}</TableCell>
                <TableCell>{customer.customer_name}</TableCell>
                <TableCell>{format(new Date(customer.creation_date), "MMM dd, yyyy")}</TableCell>
                <TableCell>{format(new Date(customer.updated_at), "MMM dd, yyyy HH:mm")}</TableCell>
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
                <TableCell className="max-w-xs truncate">
                  {customer.block_reason || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
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

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer_phone">Customer Phone</Label>
              <Input
                id="customer_phone"
                value={editingCustomer?.customer_phone || ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
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
              <Label htmlFor="status">Status</Label>
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disable">Disable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.status === 'disable' && (
              <div className="space-y-2">
                <Label htmlFor="block_reason">Block Reason</Label>
                <Textarea
                  id="block_reason"
                  value={formData.block_reason}
                  onChange={(e) =>
                    setFormData({ ...formData, block_reason: e.target.value })
                  }
                  placeholder="Enter reason for disabling customer..."
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Update Customer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerSetup;
