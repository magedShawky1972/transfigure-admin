import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";

interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  status: string;
}

interface BrandSuppliersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName: string;
}

const BrandSuppliersDialog = ({ open, onOpenChange, brandId, brandName }: BrandSuppliersDialogProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, brandId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [suppliersRes, linkedRes] = await Promise.all([
        supabase.from("suppliers").select("id, supplier_code, supplier_name, status").eq("status", "active").order("supplier_name"),
        supabase.from("brand_suppliers").select("supplier_id").eq("brand_id", brandId),
      ]);

      if (suppliersRes.error) throw suppliersRes.error;
      if (linkedRes.error) throw linkedRes.error;

      setSuppliers(suppliersRes.data || []);
      const linked = new Set((linkedRes.data || []).map((r: any) => r.supplier_id));
      setSelectedIds(new Set(linked));
      setInitialIds(new Set(linked));
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (supplierId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toAdd = [...selectedIds].filter((id) => !initialIds.has(id));
      const toRemove = [...initialIds].filter((id) => !selectedIds.has(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("brand_suppliers")
          .delete()
          .eq("brand_id", brandId)
          .in("supplier_id", toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map((supplier_id) => ({ brand_id: brandId, supplier_id }));
        const { error } = await supabase.from("brand_suppliers").insert(rows);
        if (error) throw error;
      }

      toast({ title: t("common.success"), description: "Suppliers updated successfully" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      s.supplier_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Suppliers for: {brandName}</DialogTitle>
          <DialogDescription>Select which suppliers can deliver this brand</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ScrollArea className="h-[300px] border rounded-md p-2">
            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No suppliers found</p>
            ) : (
              filtered.map((supplier) => (
                <label
                  key={supplier.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(supplier.id)}
                    onCheckedChange={() => handleToggle(supplier.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{supplier.supplier_name}</p>
                    <p className="text-xs text-muted-foreground">{supplier.supplier_code}</p>
                  </div>
                </label>
              ))
            )}
          </ScrollArea>
        )}

        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} supplier(s) selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandSuppliersDialog;
