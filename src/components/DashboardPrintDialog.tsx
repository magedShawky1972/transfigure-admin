import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { Printer } from "lucide-react";

export interface PrintSection {
  key: string;
  label: string;
  labelAr: string;
  enabled: boolean;
}

interface DashboardPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: PrintSection[];
  onPrint: (selectedSections: string[]) => void;
}

export const DashboardPrintDialog = ({
  open,
  onOpenChange,
  sections,
  onPrint,
}: DashboardPrintDialogProps) => {
  const { language } = useLanguage();
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.enabled).map(s => s.key))
  );

  const handleToggle = (key: string) => {
    const newSelected = new Set(selectedSections);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedSections(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedSections(new Set(sections.filter(s => s.enabled).map(s => s.key)));
  };

  const handleDeselectAll = () => {
    setSelectedSections(new Set());
  };

  const handlePrint = () => {
    onPrint(Array.from(selectedSections));
    onOpenChange(false);
  };

  const enabledSections = sections.filter(s => s.enabled);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {language === "ar" ? "طباعة لوحة المعلومات" : "Print Dashboard"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {language === "ar" 
              ? "اختر الأقسام التي تريد طباعتها:" 
              : "Select the sections you want to print:"}
          </p>
          
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {language === "ar" ? "تحديد الكل" : "Select All"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              {language === "ar" ? "إلغاء الكل" : "Deselect All"}
            </Button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {enabledSections.map((section) => (
              <div key={section.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={section.key}
                  checked={selectedSections.has(section.key)}
                  onCheckedChange={() => handleToggle(section.key)}
                />
                <label
                  htmlFor={section.key}
                  className="text-sm font-medium cursor-pointer flex-1"
                >
                  {language === "ar" ? section.labelAr : section.label}
                </label>
              </div>
            ))}
          </div>

          {enabledSections.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {language === "ar" 
                ? "لا توجد أقسام متاحة للطباعة" 
                : "No sections available for printing"}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
          <Button 
            onClick={handlePrint} 
            disabled={selectedSections.size === 0}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            {language === "ar" ? "طباعة" : "Print"} ({selectedSections.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
