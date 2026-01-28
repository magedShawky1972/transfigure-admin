import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, ArrowUp, ArrowDown, Save, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobPosition {
  id: string;
  position_name: string;
  position_name_ar: string | null;
  department_id: string | null;
  is_active: boolean;
  position_level: number | null;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  employee_number: string;
  job_position_id: string | null;
}

interface PositionHierarchyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string | null;
  departmentName: string;
  language: string;
  onRefresh?: () => void;
}

const PositionHierarchyDialog = ({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  language,
  onRefresh,
}: PositionHierarchyDialogProps) => {
  const { toast } = useToast();
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedLevels, setEditedLevels] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (open && departmentId) {
      fetchPositions();
    }
  }, [open, departmentId]);

  const fetchPositions = async () => {
    if (!departmentId) return;
    setLoading(true);
    try {
      const [posRes, empRes] = await Promise.all([
        supabase
          .from("job_positions")
          .select("id, position_name, position_name_ar, department_id, is_active, position_level")
          .eq("department_id", departmentId)
          .eq("is_active", true)
          .order("position_level", { ascending: true, nullsFirst: false })
          .order("position_name"),
        supabase
          .from("employees")
          .select("id, first_name, last_name, first_name_ar, last_name_ar, employee_number, job_position_id")
          .eq("department_id", departmentId)
          .eq("employment_status", "active"),
      ]);

      if (posRes.error) throw posRes.error;
      if (empRes.error) throw empRes.error;

      setPositions(posRes.data || []);
      setEmployees(empRes.data || []);
      
      // Initialize edited levels
      const levels = new Map<string, number>();
      (posRes.data || []).forEach((pos) => {
        levels.set(pos.id, pos.position_level ?? 0);
      });
      setEditedLevels(levels);
    } catch (error) {
      console.error("Error fetching positions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeesForPosition = (positionId: string) => {
    return employees.filter((e) => e.job_position_id === positionId);
  };

  const getEmployeeName = (emp: Employee) => {
    if (language === "ar" && emp.first_name_ar) {
      return `${emp.first_name_ar} ${emp.last_name_ar || ""}`.trim();
    }
    return `${emp.first_name} ${emp.last_name}`.trim();
  };

  const handleLevelChange = (positionId: string, newLevel: number) => {
    setEditedLevels((prev) => {
      const newMap = new Map(prev);
      newMap.set(positionId, Math.max(0, newLevel));
      return newMap;
    });
  };

  const moveUp = (positionId: string) => {
    const currentLevel = editedLevels.get(positionId) ?? 0;
    if (currentLevel > 0) {
      handleLevelChange(positionId, currentLevel - 1);
    }
  };

  const moveDown = (positionId: string) => {
    const currentLevel = editedLevels.get(positionId) ?? 0;
    handleLevelChange(positionId, currentLevel + 1);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Array.from(editedLevels.entries()).map(([id, level]) => ({
        id,
        position_level: level,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("job_positions")
          .update({ position_level: update.position_level })
          .eq("id", update.id);
        if (error) throw error;
      }

      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم تحديث مستويات الوظائف" : "Position levels updated",
      });
      
      onRefresh?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Sort positions by edited level
  const sortedPositions = [...positions].sort((a, b) => {
    const levelA = editedLevels.get(a.id) ?? 0;
    const levelB = editedLevels.get(b.id) ?? 0;
    return levelA - levelB;
  });

  // Group positions by level
  const positionsByLevel = new Map<number, JobPosition[]>();
  sortedPositions.forEach((pos) => {
    const level = editedLevels.get(pos.id) ?? 0;
    if (!positionsByLevel.has(level)) {
      positionsByLevel.set(level, []);
    }
    positionsByLevel.get(level)!.push(pos);
  });

  const levels = Array.from(positionsByLevel.keys()).sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {language === "ar" ? `هرم الوظائف: ${departmentName}` : `Position Hierarchy: ${departmentName}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "ar" ? "لا توجد وظائف في هذا القسم" : "No positions in this department"}
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {levels.map((level) => (
                  <div key={level} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-medium">
                        {language === "ar" ? `المستوى ${level}` : `Level ${level}`}
                      </Badge>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2 ps-4">
                      {positionsByLevel.get(level)?.map((position) => {
                        const posEmployees = getEmployeesForPosition(position.id);
                        const currentLevel = editedLevels.get(position.id) ?? 0;
                        
                        return (
                          <div
                            key={position.id}
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveUp(position.id)}
                                disabled={currentLevel === 0}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveDown(position.id)}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {language === "ar" && position.position_name_ar
                                    ? position.position_name_ar
                                    : position.position_name}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {posEmployees.length}
                                </Badge>
                              </div>
                              {posEmployees.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {posEmployees.slice(0, 3).map((e) => getEmployeeName(e)).join(", ")}
                                  {posEmployees.length > 3 && ` +${posEmployees.length - 3}`}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">
                                {language === "ar" ? "المستوى" : "Level"}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={currentLevel}
                                onChange={(e) => handleLevelChange(position.id, parseInt(e.target.value) || 0)}
                                className="w-16 h-8 text-center"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 me-2" />
                {saving
                  ? language === "ar" ? "جاري الحفظ..." : "Saving..."
                  : language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PositionHierarchyDialog;
