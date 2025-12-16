import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, RefreshCw, Search } from "lucide-react";

interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  supplier_email: string | null;
  supplier_phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function SupplierSetup() {
  const { language } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    supplier_code: "",
    supplier_name: "",
    supplier_email: "",
    supplier_phone: "",
    status: "active",
  });

  const isArabic = language === "ar";

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("supplier_name", { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في تحميل الموردين" : "Failed to load suppliers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncFromTransactions = async () => {
    try {
      setSyncing(true);
      
      // Fetch distinct vendor_name from purpletransaction
      const { data: vendorNames, error: fetchError } = await supabase
        .from("purpletransaction")
        .select("vendor_name")
        .not("vendor_name", "is", null)
        .neq("vendor_name", "");

      if (fetchError) throw fetchError;

      // Get unique vendor names
      const uniqueVendors = [...new Set(vendorNames?.map(v => v.vendor_name).filter(Boolean))] as string[];

      // Fetch existing supplier codes
      const { data: existingSuppliers } = await supabase
        .from("suppliers")
        .select("supplier_code");

      const existingCodes = new Set(existingSuppliers?.map(s => s.supplier_code) || []);

      // Find new vendors
      const newVendors = uniqueVendors.filter(v => !existingCodes.has(v));

      if (newVendors.length === 0) {
        toast({
          title: isArabic ? "تم" : "Done",
          description: isArabic ? "لا يوجد موردين جدد للإضافة" : "No new suppliers to add",
        });
        return;
      }

      // Insert new suppliers
      const suppliersToInsert = newVendors.map(vendor => ({
        supplier_code: vendor,
        supplier_name: vendor,
        status: "active",
      }));

      const { error: insertError } = await supabase
        .from("suppliers")
        .insert(suppliersToInsert);

      if (insertError) throw insertError;

      toast({
        title: isArabic ? "تم" : "Success",
        description: isArabic 
          ? `تم إضافة ${newVendors.length} مورد جديد` 
          : `Added ${newVendors.length} new suppliers`,
      });

      fetchSuppliers();
    } catch (error) {
      console.error("Error syncing suppliers:", error);
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في مزامنة الموردين" : "Failed to sync suppliers",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = () => {
    setSelectedSupplier(null);
    setFormData({
      supplier_code: "",
      supplier_name: "",
      supplier_email: "",
      supplier_phone: "",
      status: "active",
    });
    setDialogOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      supplier_code: supplier.supplier_code,
      supplier_name: supplier.supplier_name,
      supplier_email: supplier.supplier_email || "",
      supplier_phone: supplier.supplier_phone || "",
      status: supplier.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedSupplier) return;

    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", selectedSupplier.id);

      if (error) throw error;

      toast({
        title: isArabic ? "تم" : "Success",
        description: isArabic ? "تم حذف المورد بنجاح" : "Supplier deleted successfully",
      });

      setDeleteDialogOpen(false);
      fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "فشل في حذف المورد" : "Failed to delete supplier",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!formData.supplier_code || !formData.supplier_name) {
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: isArabic ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (selectedSupplier) {
        // Update existing
        const { error } = await supabase
          .from("suppliers")
          .update({
            supplier_code: formData.supplier_code,
            supplier_name: formData.supplier_name,
            supplier_email: formData.supplier_email || null,
            supplier_phone: formData.supplier_phone || null,
            status: formData.status,
          })
          .eq("id", selectedSupplier.id);

        if (error) throw error;

        toast({
          title: isArabic ? "تم" : "Success",
          description: isArabic ? "تم تحديث المورد بنجاح" : "Supplier updated successfully",
        });
      } else {
        // Insert new
        const { error } = await supabase
          .from("suppliers")
          .insert({
            supplier_code: formData.supplier_code,
            supplier_name: formData.supplier_name,
            supplier_email: formData.supplier_email || null,
            supplier_phone: formData.supplier_phone || null,
            status: formData.status,
          });

        if (error) throw error;

        toast({
          title: isArabic ? "تم" : "Success",
          description: isArabic ? "تم إضافة المورد بنجاح" : "Supplier added successfully",
        });
      }

      setDialogOpen(false);
      fetchSuppliers();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: error.message || (isArabic ? "فشل في حفظ المورد" : "Failed to save supplier"),
        variant: "destructive",
      });
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.supplier_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-2xl font-bold">
              {isArabic ? "إعداد الموردين" : "Supplier Setup"}
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={syncFromTransactions} variant="outline" disabled={syncing}>
                <RefreshCw className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"} ${syncing ? "animate-spin" : ""}`} />
                {isArabic ? "مزامنة من المعاملات" : "Sync from Transactions"}
              </Button>
              <Button onClick={handleAdd}>
                <Plus className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
                {isArabic ? "إضافة مورد" : "Add Supplier"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4 relative max-w-md">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isArabic ? "right-3" : "left-3"}`} />
            <Input
              placeholder={isArabic ? "بحث بالكود أو الاسم..." : "Search by code or name..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={isArabic ? "pr-10" : "pl-10"}
            />
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "كود المورد" : "Supplier Code"}</TableHead>
                  <TableHead>{isArabic ? "اسم المورد" : "Supplier Name"}</TableHead>
                  <TableHead>{isArabic ? "البريد الإلكتروني" : "Email"}</TableHead>
                  <TableHead>{isArabic ? "رقم الهاتف" : "Phone"}</TableHead>
                  <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isArabic ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {isArabic ? "لا يوجد موردين" : "No suppliers found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplier_code}</TableCell>
                      <TableCell>{supplier.supplier_name}</TableCell>
                      <TableCell>{supplier.supplier_email || "-"}</TableCell>
                      <TableCell>{supplier.supplier_phone || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          supplier.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }`}>
                          {supplier.status === "active" 
                            ? (isArabic ? "نشط" : "Active") 
                            : (isArabic ? "معلق" : "Suspended")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(supplier)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(supplier)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier 
                ? (isArabic ? "تعديل المورد" : "Edit Supplier")
                : (isArabic ? "إضافة مورد جديد" : "Add New Supplier")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isArabic ? "كود المورد *" : "Supplier Code *"}</Label>
              <Input
                value={formData.supplier_code}
                onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                placeholder={isArabic ? "أدخل كود المورد" : "Enter supplier code"}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "اسم المورد *" : "Supplier Name *"}</Label>
              <Input
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder={isArabic ? "أدخل اسم المورد" : "Enter supplier name"}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "البريد الإلكتروني" : "Email"}</Label>
              <Input
                type="email"
                value={formData.supplier_email}
                onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                placeholder={isArabic ? "أدخل البريد الإلكتروني" : "Enter email"}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "رقم الهاتف" : "Phone"}</Label>
              <Input
                value={formData.supplier_phone}
                onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
                placeholder={isArabic ? "أدخل رقم الهاتف" : "Enter phone number"}
              />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الحالة" : "Status"}</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{isArabic ? "نشط" : "Active"}</SelectItem>
                  <SelectItem value="suspended">{isArabic ? "معلق" : "Suspended"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isArabic ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            {isArabic 
              ? `هل أنت متأكد من حذف المورد "${selectedSupplier?.supplier_name}"؟`
              : `Are you sure you want to delete supplier "${selectedSupplier?.supplier_name}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {isArabic ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
