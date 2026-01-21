import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const CostCenterSetup = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/cost-center-setup");
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [filteredCostCenters, setFilteredCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cost_center_code: "",
    cost_center_name: "",
    cost_center_name_ar: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    if (hasAccess) {
      fetchCostCenters();
    }
  }, [hasAccess]);

  useEffect(() => {
    filterCostCenters();
  }, [costCenters, searchQuery]);

  const fetchCostCenters = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .order("cost_center_code");

      if (error) throw error;
      setCostCenters(data || []);
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterCostCenters = () => {
    let filtered = [...costCenters];
    if (searchQuery) {
      filtered = filtered.filter(
        (cc) =>
          cc.cost_center_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cc.cost_center_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (cc.cost_center_name_ar && cc.cost_center_name_ar.includes(searchQuery))
      );
    }
    setFilteredCostCenters(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const costCenterData = {
        cost_center_code: formData.cost_center_code,
        cost_center_name: formData.cost_center_name,
        cost_center_name_ar: formData.cost_center_name_ar || null,
        description: formData.description || null,
        is_active: formData.is_active,
        updated_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from("cost_centers")
          .update(costCenterData)
          .eq("id", editingId);

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم التحديث" : "Updated",
          description: language === "ar" ? "تم تحديث مركز التكلفة بنجاح" : "Cost center updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("cost_centers")
          .insert([{ ...costCenterData, created_by: user.id }]);

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم الحفظ" : "Saved",
          description: language === "ar" ? "تم إضافة مركز التكلفة بنجاح" : "Cost center added successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchCostCenters();
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (costCenter: CostCenter) => {
    setFormData({
      cost_center_code: costCenter.cost_center_code,
      cost_center_name: costCenter.cost_center_name,
      cost_center_name_ar: costCenter.cost_center_name_ar || "",
      description: costCenter.description || "",
      is_active: costCenter.is_active,
    });
    setEditingId(costCenter.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف مركز التكلفة هذا؟" : "Are you sure you want to delete this cost center?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("cost_centers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف مركز التكلفة بنجاح" : "Cost center deleted successfully",
      });

      fetchCostCenters();
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    resetForm();
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      cost_center_code: "",
      cost_center_name: "",
      cost_center_name_ar: "",
      description: "",
      is_active: true,
    });
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {language === "ar" ? "مراكز التكلفة" : "Cost Centers"}
        </h1>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة مركز تكلفة" : "Add Cost Center"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "ar" ? "بحث..." : "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الرمز" : "Code"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم بالعربية" : "Arabic Name"}</TableHead>
                  <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredCostCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد مراكز تكلفة" : "No cost centers found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCostCenters.map((cc) => (
                    <TableRow key={cc.id}>
                      <TableCell className="font-mono">{cc.cost_center_code}</TableCell>
                      <TableCell>{cc.cost_center_name}</TableCell>
                      <TableCell>{cc.cost_center_name_ar || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{cc.description || "-"}</TableCell>
                      <TableCell>
                        <Badge className={cc.is_active ? "bg-green-500" : "bg-gray-500"}>
                          {cc.is_active 
                            ? (language === "ar" ? "نشط" : "Active")
                            : (language === "ar" ? "غير نشط" : "Inactive")
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(cc)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(cc.id)}>
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (language === "ar" ? "تعديل مركز التكلفة" : "Edit Cost Center")
                : (language === "ar" ? "إضافة مركز تكلفة جديد" : "Add New Cost Center")
              }
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cost_center_code">
                {language === "ar" ? "رمز مركز التكلفة" : "Cost Center Code"} *
              </Label>
              <Input
                id="cost_center_code"
                value={formData.cost_center_code}
                onChange={(e) => setFormData({ ...formData, cost_center_code: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_center_name">
                {language === "ar" ? "اسم مركز التكلفة" : "Cost Center Name"} *
              </Label>
              <Input
                id="cost_center_name"
                value={formData.cost_center_name}
                onChange={(e) => setFormData({ ...formData, cost_center_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_center_name_ar">
                {language === "ar" ? "الاسم بالعربية" : "Arabic Name"}
              </Label>
              <Input
                id="cost_center_name_ar"
                value={formData.cost_center_name_ar}
                onChange={(e) => setFormData({ ...formData, cost_center_name_ar: e.target.value })}
                dir="rtl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {language === "ar" ? "الوصف" : "Description"}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">
                {language === "ar" ? "نشط" : "Active"}
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId
                  ? (language === "ar" ? "تحديث" : "Update")
                  : (language === "ar" ? "إضافة" : "Add")
                }
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CostCenterSetup;
