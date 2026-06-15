import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { AlertCircle } from "lucide-react";

interface NewBrand {
  brand_name: string;
}

interface BrandType {
  id: string;
  type_name: string;
  type_code: string;
}

interface BrandTypeSelectionDialogProps {
  open: boolean;
  newBrands: NewBrand[];
  onConfirm: (selections: { brand_name: string; brand_type_id: string }[]) => void;
  onCancel: () => void;
}

export const BrandTypeSelectionDialog = ({
  open,
  newBrands,
  onConfirm,
  onCancel,
}: BrandTypeSelectionDialogProps) => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [brandTypes, setBrandTypes] = useState<BrandType[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadBrandTypes();
    }
  }, [open]);

  const loadBrandTypes = async () => {
    const { data, error } = await supabase
      .from("brand_type")
      .select("id, type_name, type_code")
      .eq("status", "active")
      .order("type_name");

    if (error) {
      toast({
        title: isAr ? "خطأ في تحميل أنواع الماركات" : "Error loading brand types",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setBrandTypes(data || []);
  };

  const handleSelection = (brandName: string, brandTypeId: string) => {
    setSelections(prev => ({
      ...prev,
      [brandName]: brandTypeId,
    }));
  };

  const handleConfirm = () => {
    // Validate all brands have a selection
    const missingSelections = newBrands.filter(
      brand => !selections[brand.brand_name]
    );

    if (missingSelections.length > 0) {
      toast({
        title: isAr ? "اختيارات ناقصة" : "Missing selections",
        description: isAr ? "يرجى اختيار نوع ماركة لكل الماركات" : "Please select a brand type for all brands",
        variant: "destructive",
      });
      return;
    }

    const result = newBrands.map(brand => ({
      brand_name: brand.brand_name,
      brand_type_id: selections[brand.brand_name],
    }));

    onConfirm(result);
  };

  const allSelected = newBrands.every(brand => selections[brand.brand_name]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            {isAr ? "تم اكتشاف ماركات جديدة" : "New Brands Detected"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "الماركات التالية غير موجودة في قاعدة البيانات. يرجى اختيار نوع ماركة لكل منها للمتابعة. سيتم إنشاء أكواد الماركات تلقائيًا بناءً على اختياراتك."
              : "The following brands are not in the database. Please select a brand type for each brand to continue. Brand codes will be generated automatically based on your selections."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {newBrands.map((brand) => (
            <div key={brand.brand_name} className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="flex-1">
                <Label className="text-base font-medium">{brand.brand_name}</Label>
              </div>
              <div className="w-64">
                <Select
                  value={selections[brand.brand_name] || ""}
                  onValueChange={(value) => handleSelection(brand.brand_name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isAr ? "اختر نوع الماركة..." : "Select brand type..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {brandTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.type_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {isAr ? "إلغاء الرفع" : "Cancel Upload"}
          </Button>
          <Button onClick={handleConfirm} disabled={!allSelected || isLoading}>
            {isAr ? "متابعة الرفع" : "Continue Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
